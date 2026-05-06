/**
 * POST /api/studio/jobs/[jobId]/cancel
 *
 * Cancels a pending async generation job.
 *
 * Flow:
 *  1. Authenticate user
 *  2. Look up asset record by jobId
 *  3. Verify caller owns the asset
 *  4. If already terminal (ready/failed/deleted) — return 400
 *  5. Call provider.cancelJob() via orchestrator's getRegisteredProvider()
 *  6. Update asset record status → "failed" (cancelled is treated as failed)
 *  7. Attempt credit rollback via CreditHooks
 *
 * Note: Not all providers support cancellation. If a provider's cancelJob()
 * is a no-op (e.g., sync providers), the asset record is still marked failed
 * and credits are rolled back. The provider call is best-effort.
 *
 * Response:
 *   200 { success: true, data: { jobId, status: "cancelled" } }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 NOT_OWNER
 *   404 JOB_NOT_FOUND
 *   400 INVALID_INPUT — job is already in a terminal state
 */

import type { NextRequest }       from "next/server";
import { requireAuthUser }        from "@/lib/supabase/server";
import { supabaseAdmin }          from "@/lib/supabase/admin";
import { ensureProvidersRegistered } from "@/lib/providers/startup";
import { getRegisteredProvider }  from "@/lib/providers/core/orchestrator";
import { getAssetByJobId, updateAssetStatus } from "@/lib/storage/metadata";
import {
  ok, invalidInput, jobNotFound, notOwner, serverErr,
} from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const { jobId } = await params;

  ensureProvidersRegistered();

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? ok({ jobId, status: "error" });
  const userId = user!.id;

  // ── Lookup asset record ──────────────────────────────────────────────────────
  const asset = await getAssetByJobId(supabaseAdmin, jobId);
  if (!asset) return jobNotFound(jobId);

  // ── Ownership check ─────────────────────────────────────────────────────────
  if (asset.user_id !== userId) {
    return notOwner();
  }

  // ── Terminal state guard ─────────────────────────────────────────────────────
  if (asset.status === "ready" || asset.status === "failed" || asset.status === "deleted") {
    return invalidInput(
      `Job "${jobId}" is already in a terminal state (${asset.status}) and cannot be cancelled.`
    );
  }

  // ── Cancel at provider ───────────────────────────────────────────────────────
  if (asset.external_job_id) {
    try {
      const provider = getRegisteredProvider(asset.model_key);
      if (provider) {
        // Best-effort — sync providers no-op here, async providers may cancel
        await provider.cancelJob(asset.external_job_id);
      }
    } catch (cancelErr) {
      // Non-fatal — provider cancel failed but we still mark the local record
      console.warn("[/api/studio/jobs/[jobId]/cancel] Provider cancel failed:", cancelErr);
    }
  }

  // ── Update asset record ──────────────────────────────────────────────────────
  try {
    await updateAssetStatus(supabaseAdmin, asset.id, "failed");
  } catch (err) {
    console.error("[/api/studio/jobs/[jobId]/cancel] Asset update failed:", err);
    return serverErr("Failed to update job record.");
  }

  // ── Credit rollback ──────────────────────────────────────────────────────────
  // NOTE: buildCreditHooks()._reserved is an in-memory Map scoped to the dispatch
  // request. Rebuilding hooks here would produce an empty Map → 0 credits refunded.
  // Instead, read credits_cost directly from the persisted asset record and call
  // refund_credits — the same pattern used by the timeout auto-resolve path.
  try {
    const creditCost = asset.credits_cost ?? 0;
    if (creditCost > 0) {
      const { error: refundErr } = await supabaseAdmin.rpc("refund_credits", {
        p_user_id:     userId,
        p_amount:      creditCost,
        p_description: `Cancel refund [${asset.studio}/${asset.model_key}] job=${jobId}`,
      });
      if (refundErr) {
        console.error("[/api/studio/jobs/[jobId]/cancel] refund_credits RPC error:", refundErr.message);
      }
    }
  } catch (creditErr) {
    // Non-fatal — log and continue, refunds can be reconciled manually
    console.error("[/api/studio/jobs/[jobId]/cancel] Credit rollback failed:", creditErr);
  }

  return ok({ jobId, status: "cancelled" });
}
