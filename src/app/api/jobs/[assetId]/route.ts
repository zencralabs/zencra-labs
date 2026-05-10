/**
 * DELETE /api/jobs/[assetId]?studio=<StudioType>
 *
 * Permanently deletes a failed generation record from the database.
 * Called by the Zencra Activity Center when the user confirms deletion
 * of a failed/stale/cancelled generation card.
 *
 * ─── Routing by studio ───────────────────────────────────────────────────────
 *
 *   lipsync  → generations   table  (assetId is the generation row id)
 *   workflow → workflow_runs table  (assetId is the run id)
 *   all else → assets         table  (assetId is the asset row id)
 *
 * ─── Safety guards ───────────────────────────────────────────────────────────
 *
 *   • Auth + ownership required for every path
 *   • Refuses to delete records in "ready" / "completed" state — this
 *     endpoint is ONLY for failed, stale, cancelled, or refunded jobs.
 *     Successful generations must be managed through the gallery (DELETE
 *     /api/assets/[assetId]).
 *   • Credits are NOT touched — any refunds were applied at failure time
 *     by the credit reservation system or recover-stale cron.
 *
 * ─── Response ────────────────────────────────────────────────────────────────
 *
 *   200 { success: true, deleted: assetId }
 *   400 BAD_REQUEST   — missing / invalid studio param
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN     — record belongs to another user
 *   404 NOT_FOUND     — no record with this id
 *   409 CONFLICT      — record is in a successful state (refuse to delete)
 *   500 SERVER_ERROR
 */

import type { NextRequest } from "next/server";
import { requireAuthUser }  from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { ok, unauthorized } from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Successful statuses that must NOT be deleted via this endpoint ────────────

const ASSETS_SAFE_STATUSES    = new Set(["ready"]);
const WORKFLOW_SAFE_STATUSES  = new Set(["completed"]);
const LIPSYNC_SAFE_STATUSES   = new Set(["completed"]);

// ─── Route handler ────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
): Promise<Response> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? unauthorized();
  const userId = user!.id;

  const { assetId } = await params;

  // ── Studio param ─────────────────────────────────────────────────────────────
  const studio = req.nextUrl.searchParams.get("studio") ?? "";
  if (!studio) {
    return Response.json(
      { success: false, error: "Missing required query param: studio", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  // ─── Route to correct table ──────────────────────────────────────────────────

  if (studio === "lipsync") {
    return deleteLipSync(assetId, userId);
  }

  if (studio === "workflow") {
    return deleteWorkflowRun(assetId, userId);
  }

  // Default: assets table (image, video, audio, character, ugc, fcs, …)
  return deleteAsset(assetId, userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// assets table
// ─────────────────────────────────────────────────────────────────────────────

async function deleteAsset(assetId: string, userId: string): Promise<Response> {
  const { data, error: fetchErr } = await supabaseAdmin
    .from("assets")
    .select("id, user_id, status")
    .eq("id", assetId)
    .single();

  if (fetchErr || !data) {
    return Response.json(
      { success: false, error: "Asset not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (data.user_id !== userId) {
    return Response.json(
      { success: false, error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (ASSETS_SAFE_STATUSES.has(data.status)) {
    return Response.json(
      {
        success: false,
        error:   "Cannot delete a completed generation. Use the gallery to manage successful assets.",
        code:    "CONFLICT",
      },
      { status: 409 },
    );
  }

  const { error: deleteErr } = await supabaseAdmin
    .from("assets")
    .delete()
    .eq("id", assetId);

  if (deleteErr) {
    console.error("[jobs/delete] assets delete failed:", deleteErr.message);
    return Response.json(
      { success: false, error: "Failed to delete asset", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  return ok({ deleted: assetId });
}

// ─────────────────────────────────────────────────────────────────────────────
// generations table (lipsync)
// ─────────────────────────────────────────────────────────────────────────────

async function deleteLipSync(genId: string, userId: string): Promise<Response> {
  const { data, error: fetchErr } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, status")
    .eq("id", genId)
    .single();

  if (fetchErr || !data) {
    return Response.json(
      { success: false, error: "Generation not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (data.user_id !== userId) {
    return Response.json(
      { success: false, error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (LIPSYNC_SAFE_STATUSES.has(data.status)) {
    return Response.json(
      {
        success: false,
        error:   "Cannot delete a completed lip sync generation.",
        code:    "CONFLICT",
      },
      { status: 409 },
    );
  }

  const { error: deleteErr } = await supabaseAdmin
    .from("generations")
    .delete()
    .eq("id", genId);

  if (deleteErr) {
    console.error("[jobs/delete] generations delete failed:", deleteErr.message);
    return Response.json(
      { success: false, error: "Failed to delete generation", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  return ok({ deleted: genId });
}

// ─────────────────────────────────────────────────────────────────────────────
// workflow_runs table (Creative Director v2)
// ─────────────────────────────────────────────────────────────────────────────

async function deleteWorkflowRun(runId: string, userId: string): Promise<Response> {
  const { data, error: fetchErr } = await supabaseAdmin
    .from("workflow_runs")
    .select("id, user_id, status")
    .eq("id", runId)
    .single();

  if (fetchErr || !data) {
    return Response.json(
      { success: false, error: "Workflow run not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (data.user_id !== userId) {
    return Response.json(
      { success: false, error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  if (WORKFLOW_SAFE_STATUSES.has(data.status)) {
    return Response.json(
      {
        success: false,
        error:   "Cannot delete a completed workflow run.",
        code:    "CONFLICT",
      },
      { status: 409 },
    );
  }

  const { error: deleteErr } = await supabaseAdmin
    .from("workflow_runs")
    .delete()
    .eq("id", runId);

  if (deleteErr) {
    console.error("[jobs/delete] workflow_runs delete failed:", deleteErr.message);
    return Response.json(
      { success: false, error: "Failed to delete workflow run", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }

  return ok({ deleted: runId });
}
