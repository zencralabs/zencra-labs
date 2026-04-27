/**
 * Shot Generator — Single-Shot Dispatch Utility
 *
 * This is the shared pipeline utility for the cinematic sequencing system.
 * It wraps studioDispatch with sequence-aware context for a single resolved shot.
 *
 * IMPORTANT: This does NOT bypass studioDispatch. It calls studioDispatch with
 * full context — billing, idempotency, credit deduction, audit logging, and
 * asset persistence all happen inside studioDispatch as normal.
 *
 * The sequence route calls this utility per shot. All credit and concurrent
 * job limits (MAX_CONCURRENT_JOBS = 3) are enforced at the studioDispatch level.
 *
 * Usage:
 *   const result = await generateShot({
 *     userId,
 *     sequenceId,
 *     shot: resolvedShot,
 *     modelId: "kling-30-omni",
 *     aspectRatio: "16:9",
 *     durationSeconds: 5,
 *     ip,
 *   });
 *   // result.jobId — poll via /api/studio/jobs/[jobId]/status
 *   // result.assetId — DB asset record (status: pending)
 */

import { studioDispatch } from "@/lib/api/studio-dispatch";
import type { StudioDispatchError } from "@/lib/api/studio-dispatch";
import type { ShotResolved } from "./continuity-engine";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateShotInput {
  userId:          string;
  sequenceId:      string;
  shot:            ShotResolved;
  modelId:         string;        // catalog model id, e.g. "kling-30-omni"
  aspectRatio:     string;        // e.g. "16:9"
  durationSeconds: number;        // e.g. 5
  /** Client IP for audit logging — pass from the original request */
  ip?:             string;
}

export interface GenerateShotResult {
  /** studioDispatch job ID — poll via /api/studio/jobs/[jobId]/status */
  jobId:    string;
  /** DB asset ID — created immediately as pending, updated on completion */
  assetId:  string | undefined;
  /** Initial job status — will be "pending" for async providers (Kling, Seedance) */
  status:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatches a single resolved shot through the full Zencra generation pipeline.
 *
 * Passes the continuity engine's resolved_prompt and effective_start_frame_url
 * directly into studioDispatch. The sequence/shot relationship is stored in
 * providerParams so it can be written to the shot record after dispatch.
 */
export async function generateShot(
  input: GenerateShotInput,
): Promise<GenerateShotResult> {
  const { userId, sequenceId, shot, modelId, aspectRatio, durationSeconds, ip } = input;

  // Determine operation type from available frames
  // studioDispatch→orchestrator will infer the operation from inputs,
  // but being explicit here makes the intent clear in logs.
  const hasStartFrame = !!shot.effective_start_frame_url;
  const hasEndFrame   = !!shot.end_frame_url;

  const result = await studioDispatch({
    userId,
    studio:   "video",
    modelKey: modelId,

    // Resolved prompt from continuity engine — fully constructed, ready to send
    prompt: shot.resolved_prompt,

    // Frame inputs — effective_start_frame has carry-forward already applied
    imageUrl:    hasStartFrame ? shot.effective_start_frame_url! : undefined,
    endImageUrl: hasEndFrame   ? shot.end_frame_url!             : undefined,

    aspectRatio,
    durationSeconds,

    // Motion control — passed as providerParams for Kling camera_control
    providerParams: {
      ...(shot.motion_control ? { cameraControl: shot.motion_control } : {}),
      // Sequence linkage — used by sequence/advance route and shot status updates
      sequenceId,
      shotNumber: shot.shot_number,
    },

    ip,
  });

  return {
    jobId:   result.job.id,
    assetId: result.assetId,
    status:  result.job.status,
  };
}
