/**
 * POST /api/workflows/recover-stale
 *
 * Stale-run recovery endpoint for the Zencra Workflow Engine (Phase 2D).
 *
 * Scans `workflow_runs` for rows that are stuck in `status = 'running'`
 * with no recent activity (updated_at older than the staleness threshold)
 * and no `completed_at`. These are runs that started but never terminated —
 * typically due to an unhandled provider crash, cold-start kill, or network
 * partition between the engine and the provider.
 *
 * For each stale run the recovery action is:
 *   1. Mark status → 'failed', set completed_at, write a recovery error message.
 *   2. Calculate the unreleased credit remainder:
 *        refund = credit_reserved - credit_used - credit_released
 *   3. If refund > 0, call the `refund_credits` RPC to return the credits to
 *      the user's balance and write a credit_transactions audit row.
 *   4. Update credit_released on the run row to reflect the refund.
 *
 * The operation is fully idempotent — repeated calls only affect rows that are
 * still stuck in `running`. Rows already in `completed` or `failed` are never
 * touched.
 *
 * Auth (dual-mode):
 *   • Vercel Cron:  `Authorization: Bearer <CRON_SECRET>` (env var CRON_SECRET)
 *   • Manual admin: Standard admin JWT (role = 'admin' in profiles table)
 *
 * Returns:
 *   200 { ok: true, recovered: N, creditsReleased: N, runIds: string[] }
 *   401/403 if neither auth passes
 *
 * Vercel Cron is wired in vercel.json — see project root.
 */

import { supabaseAdmin }                        from "@/lib/supabase/admin";
import { requireAdmin }                         from "@/lib/auth/admin-gate";
import { logger }                               from "@/lib/logger";
import { emitSecurityEvent, resolveShieldMode } from "@/lib/security/events";
import type { JobEvent }                        from "@/lib/security/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Config ──────────────────────────────────────────────────────────────────

/** Runs older than this (in minutes) with no update are considered stale. */
const STALE_THRESHOLD_MINUTES = 15;

/** Maximum rows processed per invocation — guards against runaway loops. */
const MAX_RECOVER_PER_CALL = 100;

const RECOVERY_ERROR = "Recovered by stale-run detector — run exceeded inactivity threshold.";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the request carries a valid CRON_SECRET Bearer token.
 * If CRON_SECRET is not set the cron path is disabled (safe default).
 */
function isCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;

  const token = auth.slice(7);
  // Constant-time comparison is not available in the edge, but this route is
  // nodejs runtime so we keep it simple with ===. The cron secret is a
  // high-entropy random value — length-equality first avoids trivial leaks.
  return token.length === cronSecret.length && token === cronSecret;
}

// ─── Credit release ───────────────────────────────────────────────────────────

async function releaseStaleCredits(
  userId:        string,
  amount:        number,
  workflowRunId: string,
): Promise<void> {
  if (amount <= 0) return;

  const { error } = await supabaseAdmin.rpc("refund_credits", {
    p_user_id:       userId,
    p_amount:        amount,
    p_description:   `Stale-run recovery — ${amount} cr returned (run=${workflowRunId})`,
    p_generation_id: workflowRunId,
  });

  if (error) {
    logger.error("recover-stale", `refund_credits failed run=${workflowRunId} amount=${amount}: ${error.message}`);
  } else {
    logger.info("recover-stale", `refund_credits ok run=${workflowRunId} amount=${amount}`);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // ── Auth — accept cron secret OR admin JWT ──────────────────────────────────
  const cron = isCronRequest(req);

  if (!cron) {
    // Fall through to admin gate
    const { adminError } = await requireAdmin(req);
    if (adminError) return adminError;
  }

  // ── Find stale runs ─────────────────────────────────────────────────────────
  const thresholdIso = new Date(
    Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: staleRuns, error: queryError } = await supabaseAdmin
    .from("workflow_runs")
    .select("id, user_id, credit_reserved, credit_used, credit_released, updated_at")
    .eq("status", "running")
    .is("completed_at", null)
    .lt("updated_at", thresholdIso)
    .limit(MAX_RECOVER_PER_CALL);

  if (queryError) {
    logger.error("recover-stale", `query failed: ${queryError.message}`);
    return Response.json(
      { ok: false, error: "Failed to query stale runs", detail: queryError.message },
      { status: 500 },
    );
  }

  if (!staleRuns || staleRuns.length === 0) {
    logger.info("recover-stale", "no stale runs found");
    return Response.json({ ok: true, recovered: 0, creditsReleased: 0, runIds: [] });
  }

  logger.info("recover-stale", `found ${staleRuns.length} stale run(s) to recover`);

  // ── Recover each run ────────────────────────────────────────────────────────
  const recoveredIds:   string[] = [];
  let   totalCreditsReleased = 0;

  for (const run of staleRuns) {
    const refund = Math.max(
      0,
      (run.credit_reserved ?? 0) - (run.credit_used ?? 0) - (run.credit_released ?? 0),
    );
    const nowIso = new Date().toISOString();

    // Mark the run as failed — idempotent because we only selected 'running' rows.
    const { error: updateError } = await supabaseAdmin
      .from("workflow_runs")
      .update({
        status:          "failed",
        error_message:   RECOVERY_ERROR,
        completed_at:    nowIso,
        // Reflect the refund in the run's accounting columns so used + released == reserved.
        credit_released: (run.credit_released ?? 0) + refund,
      })
      .eq("id", run.id)
      .eq("status", "running"); // extra guard — skip if status changed between query and update

    if (updateError) {
      logger.error("recover-stale", `update failed run=${run.id}: ${updateError.message}`);
      // Continue processing the other runs — don't abort on partial failure.
      continue;
    }

    // Release unused credits to the user's balance.
    if (refund > 0 && run.user_id) {
      await releaseStaleCredits(run.user_id, refund, run.id);
      totalCreditsReleased += refund;
    }

    recoveredIds.push(run.id);
    logger.info(
      "recover-stale",
      `recovered run=${run.id} user=${run.user_id} refund=${refund}cr`,
    );

    // Shield: emit job.stale.detected — fire-and-forget, non-blocking.
    // Persists to security_events_log in observe/enforce mode.
    // Appears in /hub Security Monitor → Abuse Signals and admin security-summary.
    const staleAgeMs = run.updated_at
      ? Date.now() - new Date(run.updated_at as string).getTime()
      : STALE_THRESHOLD_MINUTES * 60 * 1000; // floor estimate if updated_at missing
    const staleMinutes = Math.round(staleAgeMs / 60_000);
    const mode = resolveShieldMode();
    const ev: Omit<JobEvent, "timestamp"> = {
      rule:         "job.stale.detected",
      severity:     "warning",
      threshold: {
        metric:          "workflow_run_age_minutes",
        configuredValue: STALE_THRESHOLD_MINUTES,
        observedValue:   staleMinutes,
        unit:            "minutes",
      },
      actionTaken:  mode !== "dry-run" ? "alerted" : "logged_only",
      actionReason: `Stale workflow run recovered — run=${run.id} user=${run.user_id ?? "unknown"} age=${staleMinutes}min refund=${refund}cr`,
      mode,
      jobId:        run.id,
      userId:       run.user_id ?? undefined,
      staleAgeMs,
    };
    void emitSecurityEvent(ev);
  }

  return Response.json({
    ok:             true,
    recovered:      recoveredIds.length,
    creditsReleased: totalCreditsReleased,
    runIds:         recoveredIds,
  });
}
