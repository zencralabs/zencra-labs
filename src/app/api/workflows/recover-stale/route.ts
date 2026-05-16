/**
 * GET /api/workflows/recover-stale
 *
 * Phase 2D — Vercel Cron handler for stale workflow run recovery.
 *
 * ── Schedule ──────────────────────────────────────────────────────────────────
 *   Configured in vercel.json: every 15 minutes  ("* /15 * * * *" without the space)
 *
 * ── What this does ────────────────────────────────────────────────────────────
 *   1. Verifies the request is from Vercel Cron via CRON_SECRET.
 *   2. Queries workflow_runs for rows stuck in "pending"/"running" for > 5 min.
 *   3. For each stale run, calls recoverStaleWorkflowRun() which:
 *      a. Atomically transitions the row to "failed" (only if still pending/running)
 *      b. Refunds the reserved credits to the user's balance
 *   4. Continues processing remaining runs even if one recovery fails.
 *   5. Returns a JSON summary for Vercel's cron log viewer.
 *
 * ── Stale threshold ───────────────────────────────────────────────────────────
 *   5 minutes — matches STALE_THRESHOLD_MS.workflow in job-polling.ts.
 *   GPT Image 2 typically completes in 30-60 seconds. Any run still
 *   pending/running after 5 minutes is definitively crashed.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 *   If the cron fires twice before the first run completes:
 *     - Both invocations query the same stale runs.
 *     - recoverStaleWorkflowRun() guards with .in("status", ["pending","running"]).
 *     - The second invocation's UPDATE matches zero rows → recovered=false → no refund.
 *   Double-refund is impossible.
 *
 * ── Auth ──────────────────────────────────────────────────────────────────────
 *   Vercel automatically injects:  Authorization: Bearer ${CRON_SECRET}
 *   This route returns 401 if:
 *     - CRON_SECRET env var is not set (fail closed — never open without the secret)
 *     - The header is absent
 *     - The header value does not match CRON_SECRET
 *
 * ── Safety bounds ─────────────────────────────────────────────────────────────
 *   - LIMIT 50 per invocation (prevents function timeout on backlog)
 *   - Only touches workflow_runs — never modifies provider state, UI, or other tables
 *   - Never calls a provider API
 *   - No migrations included (schema already exists from Phase 2A)
 */

import { supabaseAdmin }           from "@/lib/supabase/admin";
import { recoverStaleWorkflowRun } from "@/lib/workflows/workflow-engine";
import { logger }                  from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Runs older than this threshold are eligible for stale recovery. */
const STALE_THRESHOLD_MINUTES = 5;

/** Maximum runs to recover per cron invocation. Prevents function timeout. */
const RECOVERY_BATCH_LIMIT = 50;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  // ── 1. Cron authorization ───────────────────────────────────────────────────
  // CRON_SECRET is required. If it is not set in the environment, fail closed
  // (return 401) — an unguarded cron endpoint is a denial-of-service risk.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error("recover-stale", "CRON_SECRET env var is not set — failing closed");
    return Response.json(
      { success: false, error: "Cron endpoint not configured" },
      { status: 401 },
    );
  }

  const authHeader     = req.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${cronSecret}`;
  if (authHeader !== expectedHeader) {
    logger.warn("recover-stale", "Unauthorized cron request — bad or missing Authorization header");
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // ── 2. Query stale runs ─────────────────────────────────────────────────────
  // The partial index idx_workflow_runs_status WHERE status IN ('pending','running')
  // ensures this query is efficient even on large tables.
  const staleThreshold = new Date(
    Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: staleRuns, error: queryErr } = await supabaseAdmin
    .from("workflow_runs")
    .select("id, user_id, credit_reserved, credit_used, created_at, status")
    .in("status", ["pending", "running"])
    .lt("created_at", staleThreshold)
    .order("created_at", { ascending: true })
    .limit(RECOVERY_BATCH_LIMIT);

  if (queryErr) {
    logger.error("recover-stale", "Failed to query stale workflow runs", { error: queryErr.message });
    return Response.json(
      { success: false, error: `DB query failed: ${queryErr.message}` },
      { status: 500 },
    );
  }

  if (!staleRuns || staleRuns.length === 0) {
    logger.info("recover-stale", "No stale workflow runs found");
    return Response.json({
      success:         true,
      checked:         0,
      recovered:       0,
      refundedCredits: 0,
      errors:          0,
      runIds:          [],
    });
  }

  logger.info("recover-stale", `Found ${staleRuns.length} stale run(s) to process`);

  // ── 3. Recover each stale run ───────────────────────────────────────────────
  let recoveredCount = 0;
  let totalRefunded  = 0;
  let errorCount     = 0;
  const recoveredIds: string[] = [];

  for (const run of staleRuns) {
    const runId           = run.id              as string;
    const userId          = run.user_id         as string;
    const creditReserved  = (run.credit_reserved as number)    ?? 0;
    // credit_used is NULL for runs that never reached terminal state — treat as 0
    const creditUsedSoFar = (run.credit_used as number | null) ?? 0;

    try {
      const result = await recoverStaleWorkflowRun(
        runId,
        userId,
        creditReserved,
        creditUsedSoFar,
      );

      if (result.error) {
        // DB error during recovery — log and continue with remaining runs
        logger.error("recover-stale", "Recovery error for run", {
          runId,
          userId,
          error: result.error,
        });
        errorCount++;
        continue;
      }

      if (result.recovered) {
        recoveredCount++;
        totalRefunded += result.refundedCredits;
        recoveredIds.push(runId);
        logger.info("recover-stale", "Run recovered", {
          runId,
          userId,
          creditReserved,
          creditUsedSoFar,
          refundedCredits: result.refundedCredits,
        });
      } else {
        // Already terminal — idempotency guard fired, no double-refund.
        logger.info("recover-stale", "Run already terminal — skipped", { runId });
      }
    } catch (unexpectedErr) {
      // Unexpected throw — log and continue so other runs are not blocked
      logger.error("recover-stale", "Unexpected error recovering run", {
        runId,
        error: String(unexpectedErr),
      });
      errorCount++;
    }
  }

  // ── 4. Return summary ───────────────────────────────────────────────────────
  const summary = {
    success:         true,
    checked:         staleRuns.length,
    recovered:       recoveredCount,
    refundedCredits: totalRefunded,
    errors:          errorCount,
    runIds:          recoveredIds,
  };

  logger.info("recover-stale", "Recovery complete", summary);

  return Response.json(summary);
}
