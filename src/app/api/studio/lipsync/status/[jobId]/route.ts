/**
 * GET /api/studio/lipsync/status/[jobId]
 *
 * Polls the current status of a Lip Sync Studio job.
 *
 * Flow:
 *  1. Authenticate user
 *  2. Look up asset record by jobId (assets table)
 *  3. Verify caller owns the asset
 *  4. If status is terminal ("ready" | "failed") — return cached result
 *  5. Timeout guard — auto-fail jobs pending for more than 60 minutes
 *  6. Poll proAdapter.getJobStatus(externalJobId)
 *  7. If completed — call proAdapter.getResult() to fetch video URL
 *  8. Mirror video to Supabase storage, update asset to "ready"
 *  9. If failed — update asset, refund credits
 * 10. Return current status to client
 *
 * Client should poll every 3–5 seconds.
 *
 * Response:
 *   200 { success: true, data: { jobId, assetId, status, url?, error? } }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 NOT_OWNER
 *   404 JOB_NOT_FOUND
 *   502 PROVIDER_ERROR
 */

import type { NextRequest }    from "next/server";
import { requireAuthUser }     from "@/lib/supabase/server";
import { supabaseAdmin }       from "@/lib/supabase/admin";
import { proAdapter }          from "@/lib/providers/lipsync/pro";
import { getAssetByJobId, updateAssetStatus }
                               from "@/lib/storage/metadata";
import { mirrorVideoToStorage } from "@/lib/storage/upload";
import {
  ok, unauthorized, jobNotFound, notOwner, providerErr, serverErr,
} from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENDING_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

export async function GET(
  req:     NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const { jobId } = await params;

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? unauthorized();
  const userId = user!.id;

  // ── Lookup asset ─────────────────────────────────────────────────────────────
  const asset = await getAssetByJobId(supabaseAdmin, jobId);
  if (!asset) return jobNotFound(jobId);

  // ── Ownership check ─────────────────────────────────────────────────────────
  if (asset.user_id !== userId) return notOwner();

  // ── Terminal short-circuit ───────────────────────────────────────────────────
  if (asset.status === "ready" || asset.status === "failed" || asset.status === "deleted") {
    return ok({
      jobId:    asset.job_id,
      assetId:  asset.id,
      status:   asset.status === "ready" ? "success" : asset.status,
      url:      asset.url ?? undefined,
      modelKey: asset.model_key,
      studio:   asset.studio,
    });
  }

  // ── Timeout guard ────────────────────────────────────────────────────────────
  if (asset.status === "pending") {
    const ageMs = Date.now() - new Date(asset.created_at).getTime();
    if (ageMs > PENDING_TIMEOUT_MS) {
      const timeoutMsg = "Lip sync timed out — provider did not respond within the polling window. Credits refunded.";

      try {
        await updateAssetStatus(supabaseAdmin, asset.id, "failed", undefined, timeoutMsg);

        const creditCost = asset.credits_cost ?? 0;
        if (creditCost > 0) {
          await supabaseAdmin.rpc("refund_credits", {
            p_user_id:     userId,
            p_amount:      creditCost,
            p_description: `Timeout refund [lipsync/sync-lipsync-v3] job=${asset.job_id}`,
          });
        }
      } catch (timeoutErr) {
        console.error("[lipsync/status] timeout auto-resolve failed:", timeoutErr);
      }

      return ok({
        jobId:   asset.job_id,
        assetId: asset.id,
        status:  "error",
        error:   timeoutMsg,
        modelKey: asset.model_key,
        studio:   asset.studio,
      });
    }
  }

  // ── No external job ID — still queuing ───────────────────────────────────────
  if (!asset.external_job_id) {
    return ok({
      jobId:    asset.job_id,
      assetId:  asset.id,
      status:   "pending",
      modelKey: asset.model_key,
      studio:   asset.studio,
    });
  }

  // ── Poll Sync Labs v3 ────────────────────────────────────────────────────────
  try {
    const polled = await proAdapter.getJobStatus(asset.external_job_id);

    if (polled.status === "failed") {
      const failMsg = polled.failureReason ?? "Lip sync provider returned a failure.";
      await updateAssetStatus(supabaseAdmin, asset.id, "failed", undefined, failMsg);

      // Credit refund
      const creditCost = asset.credits_cost ?? 0;
      if (creditCost > 0) {
        const { error: refundErr } = await supabaseAdmin.rpc("refund_credits", {
          p_user_id:     userId,
          p_amount:      creditCost,
          p_description: `Failure refund [lipsync/sync-lipsync-v3] job=${asset.job_id}`,
        });
        if (refundErr) {
          console.error("[lipsync/status] refund_credits failed:", refundErr.message);
        }
      }

      return ok({
        jobId:   asset.job_id,
        assetId: asset.id,
        status:  "error",
        error:   failMsg,
        modelKey: asset.model_key,
        studio:   asset.studio,
      });
    }

    if (polled.status === "completed" && proAdapter.getResult) {
      // Fetch the output video URL from the provider
      let videoUrl: string;
      try {
        const result = await proAdapter.getResult(asset.external_job_id);
        videoUrl = result.videoUrl;
      } catch (resultErr) {
        console.error("[lipsync/status] getResult failed:", resultErr);
        const errMsg = resultErr instanceof Error ? resultErr.message : "Failed to retrieve lip sync result.";
        await updateAssetStatus(supabaseAdmin, asset.id, "failed", undefined, errMsg);
        return ok({
          jobId:   asset.job_id,
          assetId: asset.id,
          status:  "error",
          error:   errMsg,
          modelKey: asset.model_key,
          studio:   asset.studio,
        });
      }

      // Mirror video to Supabase storage (best-effort)
      let finalUrl = videoUrl;
      try {
        const mirrored = await mirrorVideoToStorage(videoUrl, asset.id);
        if (mirrored?.url) finalUrl = mirrored.url;
      } catch (mirrorErr) {
        console.warn("[lipsync/status] mirrorVideoToStorage failed (using provider URL):", mirrorErr);
      }

      await updateAssetStatus(supabaseAdmin, asset.id, "ready", finalUrl);

      return ok({
        jobId:   asset.job_id,
        assetId: asset.id,
        status:  "success",
        url:     finalUrl,
        modelKey: asset.model_key,
        studio:   asset.studio,
      });
    }

    // Still in queue / processing
    return ok({
      jobId:   asset.job_id,
      assetId: asset.id,
      status:  polled.status === "queued" ? "pending" : "pending",
      modelKey: asset.model_key,
      studio:   asset.studio,
    });

  } catch (err) {
    console.error("[/api/studio/lipsync/status]", err);
    return providerErr(
      err instanceof Error ? err.message : "Failed to retrieve lip sync status from provider."
    );
  }
}
