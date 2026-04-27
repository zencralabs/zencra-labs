/**
 * POST /api/studio/video/sequence/advance
 *
 * Advances the queue for a sequence after a shot completes.
 *
 * Client calls this when polling a shot's jobId returns status "done" or "failed".
 * This endpoint:
 *   1. Validates the completed shot belongs to the caller's sequence
 *   2. Updates the completed/failed shot's status in video_shots
 *   3. Increments completed_shots on video_sequences (for done shots)
 *   4. Dispatches the next pending shot (if any)
 *   5. Updates sequence_status to "completed" | "partial" | "failed" if no shots remain
 *
 * Queue advancement happens server-side — the client is not a scheduler.
 * The client simply reports what happened to a job, and this endpoint decides what's next.
 *
 * Request body:
 *   {
 *     sequence_id: string,
 *     shot_id:     string,
 *     job_result:  "done" | "failed",
 *     asset_id?:   string   // populated by client from job status response on "done"
 *   }
 *
 * Response 200:
 *   {
 *     success: true,
 *     data: {
 *       sequenceStatus: string,
 *       nextShot: { id, shot_number, jobId, assetId, status } | null
 *     }
 *   }
 */

import { NextResponse }    from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }   from "@/lib/supabase/admin";
import {
  ok,
  invalidInput,
  apiErr,
  serverErr,
  parseBody,
} from "@/lib/api/route-utils";
import { generateShot } from "@/lib/video/shot-generator";
import { StudioDispatchError } from "@/lib/api/studio-dispatch";
import { getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Parse body ──────────────────────────────────────────────────────────────
  const parsed = await parseBody(req);
  if (parsed.parseError) return parsed.parseError;

  const { sequence_id, shot_id, job_result, asset_id, error_message } = parsed.body as {
    sequence_id:    string;
    shot_id:        string;
    job_result:     "done" | "failed";
    asset_id?:      string;
    /** Client-supplied error reason — written to video_shots.error_message on failure */
    error_message?: string;
  };

  if (!sequence_id) return invalidInput("sequence_id is required");
  if (!shot_id)     return invalidInput("shot_id is required");
  if (job_result !== "done" && job_result !== "failed") {
    return invalidInput("job_result must be 'done' or 'failed'");
  }

  const clientIp = getClientIp(req);

  // ── Load sequence (ownership check) ─────────────────────────────────────────
  const { data: sequence, error: seqErr } = await supabaseAdmin
    .from("video_sequences")
    .select("id, user_id, model_id, aspect_ratio, duration_seconds, sequence_status, total_shots, completed_shots")
    .eq("id", sequence_id)
    .eq("user_id", userId)
    .single();

  if (seqErr || !sequence) {
    return apiErr("JOB_NOT_FOUND", "Sequence not found", 404);
  }

  // ── Update the completed/failed shot ────────────────────────────────────────
  const newShotStatus = job_result === "done" ? "done" : "failed";

  const { error: updateErr } = await supabaseAdmin
    .from("video_shots")
    .update({
      shot_status: newShotStatus,
      ...(job_result === "done" && asset_id ? { asset_id } : {}),
      // Persist the client-supplied error reason on failure.
      // Falls back to a generic message so error_message is never silently null.
      ...(job_result === "failed"
        ? { error_message: error_message?.trim() || "Generation failed" }
        : {}),
    })
    .eq("id", shot_id)
    .eq("sequence_id", sequence_id);

  if (updateErr) {
    console.error("[advance] shot update error:", updateErr.message);
    return serverErr("Failed to update shot status");
  }

  // ── Increment completed_shots for "done" shots ───────────────────────────────
  const newCompleted = job_result === "done"
    ? (sequence.completed_shots + 1)
    : sequence.completed_shots;

  // ── Atomically claim the next pending shot ──────────────────────────────────
  //
  // Uses a PostgreSQL function with FOR UPDATE SKIP LOCKED to prevent two
  // concurrent advance requests from selecting the same pending shot.
  // If two shots complete simultaneously, each advance call races for the lock;
  // one wins and claims shot N, the other either claims shot N+1 or returns null.
  // No double-dispatch. No duplicate jobs.
  const { data: claimedRows } = await supabaseAdmin
    .rpc("claim_next_sequence_shot", { p_sequence_id: sequence_id });

  const claimedShot = (claimedRows as Array<{
    id: string;
    shot_number: number;
    prompt: string;
    resolved_prompt: string | null;
    start_frame_url: string | null;
    end_frame_url: string | null;
    motion_control: Record<string, unknown> | null;
    continuity_disabled: boolean;
  }> | null)?.[0] ?? null;

  let nextShotResult: {
    id: string;
    shot_number: number;
    jobId: string | null;
    assetId: string | null;
    status: string;
  } | null = null;

  // ── Dispatch the claimed shot if one was available ──────────────────────────
  // claimedShot is already set to shot_status='dispatching' in the DB by the
  // atomic claim function. We now dispatch it and write back the job/asset IDs.
  if (claimedShot) {
    try {
      const resolvedShotInput = {
        shot_number:               claimedShot.shot_number,
        resolved_prompt:           claimedShot.resolved_prompt ?? claimedShot.prompt,
        effective_start_frame_url: claimedShot.start_frame_url ?? null,
        end_frame_url:             claimedShot.end_frame_url ?? null,
        motion_control:            claimedShot.motion_control ?? null,
        identity_context:          [],
      };

      const result = await generateShot({
        userId,
        sequenceId:      sequence_id,
        shot:            resolvedShotInput,
        modelId:         sequence.model_id,
        aspectRatio:     sequence.aspect_ratio,
        durationSeconds: sequence.duration_seconds,
        ip:              clientIp,
      });

      // Write job + asset IDs — shot_status already 'dispatching' from claim
      await supabaseAdmin
        .from("video_shots")
        .update({
          job_id:   result.jobId,
          asset_id: result.assetId ?? null,
        })
        .eq("id", claimedShot.id);

      nextShotResult = {
        id:          claimedShot.id,
        shot_number: claimedShot.shot_number,
        jobId:       result.jobId,
        assetId:     result.assetId ?? null,
        status:      "dispatching",
      };
    } catch (err) {
      const msg = err instanceof StudioDispatchError
        ? err.message
        : "Generation failed — please try again";

      await supabaseAdmin
        .from("video_shots")
        .update({ shot_status: "failed", error_message: msg })
        .eq("id", claimedShot.id);

      nextShotResult = {
        id:          claimedShot.id,
        shot_number: claimedShot.shot_number,
        jobId:       null,
        assetId:     null,
        status:      "failed",
      };
    }
  }

  // ── Determine new sequence status ────────────────────────────────────────────
  // Check remaining shots after this update
  const { data: remainingShots } = await supabaseAdmin
    .from("video_shots")
    .select("shot_status")
    .eq("sequence_id", sequence_id);

  let newSequenceStatus = "generating";
  if (remainingShots) {
    const statuses    = remainingShots.map(s => s.shot_status as string);
    const hasPending  = statuses.some(s => s === "pending" || s === "dispatching" || s === "generating");
    const hasDone     = statuses.some(s => s === "done");
    const hasFailed   = statuses.some(s => s === "failed");

    if (!hasPending) {
      if (hasFailed && hasDone)  newSequenceStatus = "partial";
      else if (hasFailed)        newSequenceStatus = "failed";
      else                       newSequenceStatus = "completed";
    }
  }

  // ── Update sequence ──────────────────────────────────────────────────────────
  await supabaseAdmin
    .from("video_sequences")
    .update({
      completed_shots:  newCompleted,
      sequence_status:  newSequenceStatus,
    })
    .eq("id", sequence_id);

  return ok({
    sequenceStatus: newSequenceStatus,
    nextShot:       nextShotResult,
  });
}
