/**
 * GET /api/studio/jobs/[jobId]/status
 *
 * Polls the current status of an async generation job.
 *
 * Flow:
 *  1. Authenticate user
 *  2. Look up asset record by jobId (Supabase assets table)
 *  3. Verify caller owns the asset
 *  4. If status is already "ready" or "failed" — return cached result immediately
 *  5. If status is "pending" — call provider pollJobStatus()
 *  6. If provider returns success — update asset record to "ready" + store URL
 *  7. If provider returns error  — update asset record to "failed"
 *  8. Return current status to client
 *
 * The client should poll every 3–5 seconds for async jobs (Kling, Seedance, etc.).
 * Sync providers (LTX/FCS) will never appear as "pending" here — they complete
 * in the generate route.
 *
 * Response:
 *   200 { success: true, data: { jobId, status, url?, modelKey, studio, assetId } }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 NOT_OWNER
 *   404 JOB_NOT_FOUND
 *   502 PROVIDER_ERROR — provider poll failed
 */

import type { NextRequest }    from "next/server";
import { requireAuthUser }     from "@/lib/supabase/server";
import { supabaseAdmin }       from "@/lib/supabase/admin";
import { pollAndUpdateJob }    from "@/lib/api/studio-dispatch";
import { getAssetByJobId, updateAssetStatus } from "@/lib/storage/metadata";
import { logProviderCost }     from "@/lib/providers/core/cost-logger";
import {
  ok, unauthorized, jobNotFound, notOwner, providerErr, serverErr,
} from "@/lib/api/route-utils";

/**
 * Maximum time a job may remain in "pending" state before we auto-resolve it
 * as failed and refund the reserved credits.
 *
 * This acts as a safety net for jobs whose in-flight polling was interrupted
 * by a server restart or cold-start. The next client poll after this deadline
 * triggers the resolution so the user is never stuck with a frozen card.
 *
 * 60 minutes covers the longest plausible provider queue (Kling 4K video).
 */
const PENDING_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const { jobId } = await params;

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? unauthorized();
  const userId = user!.id;

  // ── Lookup asset record ──────────────────────────────────────────────────────
  const asset = await getAssetByJobId(supabaseAdmin, jobId);
  if (!asset) return jobNotFound(jobId);

  // ── Ownership check ─────────────────────────────────────────────────────────
  if (asset.user_id !== userId) {
    return notOwner();
  }

  // ── Return immediately if already terminal ──────────────────────────────────
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

  // ── Timeout guard — auto-fail stale pending jobs ─────────────────────────────
  // If a job has been pending beyond PENDING_TIMEOUT_MS the provider almost
  // certainly dropped it (or our in-flight polling was killed by a server
  // restart). Resolve it now so the user's card updates and credits are returned.
  if (asset.status === "pending") {
    const ageMs = Date.now() - new Date(asset.created_at).getTime();
    if (ageMs > PENDING_TIMEOUT_MS) {
      const timeoutMsg =
        "Generation timed out — provider did not respond within the polling window. Credits refunded.";

      try {
        await updateAssetStatus(supabaseAdmin, asset.id, "failed", undefined, timeoutMsg);

        // Issue credit refund if the job had a cost
        const creditCost = asset.credits_cost ?? 0;
        if (creditCost > 0) {
          await supabaseAdmin.rpc("refund_credits", {
            p_user_id:    userId,
            p_amount:     creditCost,
            p_description: `Timeout refund [${asset.studio}/${asset.model_key}] job=${asset.job_id}`,
          });
        }
      } catch (timeoutErr) {
        // Log but continue — return failed status even if DB write partially failed
        console.error("[jobs/status] timeout auto-resolve failed:", timeoutErr);
      }

      return ok({
        jobId:    asset.job_id,
        assetId:  asset.id,
        status:   "error",
        error:    timeoutMsg,
        modelKey: asset.model_key,
        studio:   asset.studio,
      });
    }
  }

  // ── Poll provider for live status ────────────────────────────────────────────
  if (!asset.external_job_id) {
    // No external job ID means the job never left the platform — return as pending
    return ok({
      jobId:    asset.job_id,
      assetId:  asset.id,
      status:   "pending",
      modelKey: asset.model_key,
      studio:   asset.studio,
    });
  }

  try {
    const polled = await pollAndUpdateJob(
      asset.model_key,
      asset.external_job_id,
      asset.id,
    );

    // ── Provider cost logging ───────────────────────────────────────────────
    // Log on first terminal resolution only (pending → success | error).
    // Re-polls of already-terminal assets are returned early above (line 63),
    // so reaching here means this IS the first resolution for this job.
    if (polled.status === "success" || polled.status === "error") {
      void logProviderCost({
        assetId:        asset.id,
        modelKey:       asset.model_key,
        studio:         asset.studio,
        userId,
        status:         polled.status === "success" ? "success" : "failed",
        failureReason:  polled.status === "error" ? polled.error : undefined,
        generationParams: {
          ...(asset.duration_seconds ? { durationSeconds: asset.duration_seconds } : {}),
          ...(asset.aspect_ratio     ? { aspectRatio:     asset.aspect_ratio }     : {}),
        },
      });
    }

    return ok({
      jobId:    asset.job_id,
      assetId:  asset.id,
      status:   polled.status,
      url:      polled.url,
      error:    polled.error,
      modelKey: asset.model_key,
      studio:   asset.studio,
    });
  } catch (err) {
    console.error("[/api/studio/jobs/[jobId]/status]", err);
    return providerErr(
      err instanceof Error ? err.message : "Failed to retrieve job status from provider."
    );
  }
}
