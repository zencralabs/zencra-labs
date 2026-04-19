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
import { getAssetByJobId }     from "@/lib/storage/metadata";
import {
  ok, unauthorized, jobNotFound, notOwner, providerErr, serverErr,
} from "@/lib/api/route-utils";

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
