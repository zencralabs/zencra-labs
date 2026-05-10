/**
 * GET /api/workflows/[runId]/status
 *
 * Phase 3A — Workflow run status endpoint for the universal polling engine.
 *
 * Queried by job-polling.ts when studio === "workflow". Designed to be
 * compatible with the same response shape the polling engine expects from
 * the universal studio-dispatch status route.
 *
 * ─── Current usage ────────────────────────────────────────────────────────────
 *
 *   CDv2 generation is synchronous (GPT Image 2). The polling engine is wired
 *   but normally never fires — CDv2Shell calls registerJob() + completeJob()
 *   immediately after dispatch. This endpoint exists for crash-recovery:
 *
 *     1. User submits a CDv2 generation.
 *     2. Server process dies mid-execution (workflow_runs row left in "running").
 *     3. Phase 2D stale detector eventually marks it "failed" and refunds credits.
 *     4. If the client page-refreshes before the cron fires, GET /api/jobs/pending
 *        returns the "running" row (Phase 3A Source 3).
 *     5. The polling engine starts polling this endpoint.
 *     6. Either the row transitions to "failed" (cron) and this endpoint returns
 *        that terminal status, or it resolves "completed" with URLs.
 *
 * ─── Response shape ───────────────────────────────────────────────────────────
 *
 *   Matches the {success, data} envelope that job-polling.ts already handles
 *   for the universal studio-dispatch status route.
 *
 *   200 { success: true, data: { jobId, status, url?, error? } }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN  — run does not belong to this user
 *   404 NOT_FOUND  — no run with this ID
 *
 * ─── Status mapping ───────────────────────────────────────────────────────────
 *
 *   workflow_runs.status → polling engine status
 *   "running"            → "processing"
 *   "completed"          → "completed"  (with url from first step's resultUrls)
 *   "failed"             → "failed"     (with error from error_message)
 *   "cancelled"          → "cancelled"
 */

import type { NextRequest }  from "next/server";
import { requireAuthUser }   from "@/lib/supabase/server";
import { supabaseAdmin }     from "@/lib/supabase/admin";
import { ok, unauthorized }  from "@/lib/api/route-utils";
import { logger }            from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Status normalisation ─────────────────────────────────────────────────────

type WorkflowDbStatus = "running" | "completed" | "failed" | "cancelled";

/** Maps workflow_runs.status → GenerationStatus understood by job-polling.ts */
function normalizeWorkflowStatus(dbStatus: string): string {
  switch (dbStatus as WorkflowDbStatus) {
    case "running":   return "processing";
    case "completed": return "completed";
    case "failed":    return "failed";
    case "cancelled": return "cancelled";
    default:          return "processing"; // unknown — keep polling
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } },
): Promise<Response> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? unauthorized();
  const userId = user!.id;

  const { runId } = params;

  // ── Fetch workflow run ────────────────────────────────────────────────────────
  const { data: run, error: runError } = await supabaseAdmin
    .from("workflow_runs")
    .select("id, user_id, status, error_message")
    .eq("id", runId)
    .single();

  if (runError || !run) {
    logger.warn("workflow-status", `run not found: ${runId}`);
    return Response.json(
      { success: false, error: "Workflow run not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // ── Ownership check ───────────────────────────────────────────────────────────
  if (run.user_id !== userId) {
    logger.warn("workflow-status", `ownership mismatch run=${runId} user=${userId}`);
    return Response.json(
      { success: false, error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const status = normalizeWorkflowStatus(run.status ?? "running");

  // ── For completed runs — collect result URLs from steps ───────────────────────
  let url: string | undefined;
  if (run.status === "completed") {
    const { data: steps } = await supabaseAdmin
      .from("workflow_steps")
      .select("output_payload")
      .eq("run_id", runId)
      .eq("status", "completed")
      .order("step_index", { ascending: true });

    if (steps && steps.length > 0) {
      // Aggregate all resultUrls from all completed steps in order
      const allUrls: string[] = [];
      for (const step of steps) {
        const payload = step.output_payload as { resultUrls?: string[] } | null;
        const stepUrls = payload?.resultUrls ?? [];
        allUrls.push(...stepUrls);
      }
      url = allUrls[0]; // Primary URL — first result across all steps
    }
  }

  return ok({
    jobId:  runId,
    status,
    url,
    error: run.status === "failed" || run.status === "cancelled"
      ? (run.error_message ?? "Workflow run failed")
      : undefined,
  });
}
