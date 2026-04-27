/**
 * POST /api/studio/video/sequence/generate
 *
 * Orchestrates multi-shot sequence generation.
 *
 * Flow:
 *   1. Auth + rate limit
 *   2. Load sequence + shots from DB (validates ownership)
 *   3. Resolve ALL @handles across ALL shot prompts in ONE pass
 *   4. Build globalIdentityContext
 *   5. Run continuity engine → resolved prompts + effective start frames
 *   6. Persist resolved_prompt + identity_context to each video_shots row
 *   7. Set sequence_status = "generating"
 *   8. Dispatch first N shots (maxConcurrentShots = 2) via shot-generator
 *   9. Update dispatched shots with job_id + shot_status = "dispatching"
 *  10. Return immediately: { sequenceId, shots: [{ id, jobId, status }] }
 *
 * Remaining shots stay "pending". Client calls:
 *   POST /api/studio/video/sequence/advance
 * when a shot completes, which dispatches the next queued shot.
 *
 * Request body:
 *   { sequence_id: string }
 *
 * Response 202:
 *   {
 *     success: true,
 *     data: {
 *       sequenceId: string,
 *       shots: Array<{
 *         id: string,
 *         shot_number: number,
 *         jobId: string | null,     // null for queued shots
 *         assetId: string | null,
 *         status: "dispatching" | "pending"
 *       }>
 *     }
 *   }
 */

import { NextResponse }   from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }  from "@/lib/supabase/admin";
import {
  invalidInput,
  serverErr,
  apiErr,
  parseBody,
} from "@/lib/api/route-utils";
import {
  checkStudioRateLimit,
  checkIpStudioRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { resolveInfluencerHandles } from "@/lib/ai-influencer/handle-resolver";
import { applyContinuity } from "@/lib/video/continuity-engine";
import type { GlobalIdentityContext } from "@/lib/video/continuity-engine";
import type { InfluencerIdentityContext } from "@/lib/ai-influencer/handle-resolver";
import { generateShot }  from "@/lib/video/shot-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Maximum shots dispatched concurrently. Remaining shots queue as "pending". */
const MAX_CONCURRENT_SHOTS = 2;

export async function POST(req: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const rateLimitError = await checkStudioRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  const clientIp      = getClientIp(req);
  const ipRateLimit   = await checkIpStudioRateLimit(clientIp);
  if (ipRateLimit) return ipRateLimit;

  // ── Parse body ──────────────────────────────────────────────────────────────
  const parsed = await parseBody(req);
  if (parsed.parseError) return parsed.parseError;

  const { sequence_id } = parsed.body as { sequence_id: string };
  if (!sequence_id) return invalidInput("sequence_id is required");

  // ── Load sequence + shots ───────────────────────────────────────────────────
  const { data: sequence, error: seqErr } = await supabaseAdmin
    .from("video_sequences")
    .select(`
      *,
      video_shots (
        id, shot_number, prompt,
        start_frame_url, end_frame_url,
        motion_control, continuity_disabled, shot_status,
        transition_type, composition_type
      )
    `)
    .eq("id", sequence_id)
    .eq("user_id", userId)
    .single();

  if (seqErr || !sequence) {
    return apiErr("JOB_NOT_FOUND", "Sequence not found", 404);
  }

  if (sequence.sequence_status === "generating") {
    return invalidInput("This sequence is already generating");
  }

  const shots = (sequence.video_shots as Array<{
    id: string;
    shot_number: number;
    prompt: string;
    start_frame_url: string | null;
    end_frame_url: string | null;
    motion_control: Record<string, unknown> | null;
    continuity_disabled: boolean;
    shot_status: string;
    // DB returns string — cast to union at point of use (validated by check constraint)
    transition_type:  "cut_to" | "match_action" | "continue_motion" | null;
    composition_type: "reveal" | "close_up" | "wide_establishing" | "reaction_shot" | "over_the_shoulder" | null;
  }>).sort((a, b) => a.shot_number - b.shot_number);

  if (shots.length === 0) {
    return invalidInput("Sequence has no shots");
  }

  // ── Steps 3–6: Resolve handles, run continuity engine, persist resolved prompts
  //
  // Wrapped in a single try/catch: if any of these throw (handle resolver DB
  // error, continuity engine crash, or persist failure), every shot is marked
  // "failed" with the error reason and the sequence is set to "failed".
  // Without this guard, shots stay "pending" forever and the sequence never
  // transitions out of "generating", making the failure invisible.
  let resolvedShots: ReturnType<typeof applyContinuity>;
  try {
    // Combine all prompts into one string for a single resolver call,
    // then collect the identity contexts.
    const combinedPrompt = shots.map(s => s.prompt).join(" ");
    const resolved       = await resolveInfluencerHandles({ userId, prompt: combinedPrompt });

    const globalCtx: GlobalIdentityContext = {
      resolvedContexts: resolved.influencerContexts,
      contextByHandle:  new Map(
        resolved.influencerContexts.map(c => [c.handle, c])
      ),
      primaryContext: resolved.primaryContext,
    };

    // ── Step 5: Run continuity engine ─────────────────────────────────────────
    resolvedShots = applyContinuity(shots, globalCtx);

    // ── Step 6: Persist resolved_prompt + identity_context to DB ──────────────
    const persistPromises = resolvedShots.map(rs =>
      supabaseAdmin
        .from("video_shots")
        .update({
          resolved_prompt:  rs.resolved_prompt,
          identity_context: rs.identity_context.length > 0 ? rs.identity_context : null,
        })
        .eq("sequence_id", sequence_id)
        .eq("shot_number",  rs.shot_number)
    );
    await Promise.all(persistPromises);
  } catch (preDispatchErr) {
    const msg = preDispatchErr instanceof Error
      ? preDispatchErr.message
      : "Pre-dispatch setup failed — unknown error";

    console.error("[generate] pre-dispatch error:", msg);

    // Mark every shot as failed with the error reason
    await Promise.all(
      shots.map(s =>
        supabaseAdmin
          .from("video_shots")
          .update({ shot_status: "failed", error_message: msg })
          .eq("id", s.id)
      )
    );

    // Fail the sequence so the client gets a terminal state
    await supabaseAdmin
      .from("video_sequences")
      .update({ sequence_status: "failed" })
      .eq("id", sequence_id);

    return serverErr(msg);
  }

  // ── Step 7: Set sequence status to generating ───────────────────────────────
  await supabaseAdmin
    .from("video_sequences")
    .update({ sequence_status: "generating" })
    .eq("id", sequence_id);

  // ── Step 8: Dispatch first N shots ─────────────────────────────────────────
  const toDispatch = resolvedShots.slice(0, MAX_CONCURRENT_SHOTS);
  const queued     = resolvedShots.slice(MAX_CONCURRENT_SHOTS);

  const dispatchResults: Array<{
    id: string;
    shot_number: number;
    jobId: string | null;
    assetId: string | null;
    status: "dispatching" | "pending" | "failed";
    error?: string;
  }> = [];

  // Dispatch first N shots in parallel
  await Promise.all(
    toDispatch.map(async rs => {
      const shotRow = shots.find(s => s.shot_number === rs.shot_number)!;
      try {
        const result = await generateShot({
          userId,
          sequenceId:      sequence_id,
          shot:            rs,
          modelId:         sequence.model_id,
          aspectRatio:     sequence.aspect_ratio,
          durationSeconds: sequence.duration_seconds,
          ip:              clientIp,
        });

        // Update shot with job linkage.
        // NOTE: job_id column is UUID — we write assetId (UUID) not jobId (zjob_... format)
        // which would fail the UUID constraint silently. The client still receives the
        // zjob_... jobId from this route's response for polling, sourced from result.jobId.
        const { error: shotUpdateErr } = await supabaseAdmin
          .from("video_shots")
          .update({
            job_id:      result.assetId ?? null,  // UUID — satisfies column constraint
            asset_id:    result.assetId ?? null,
            shot_status: "dispatching",
          })
          .eq("id", shotRow.id);

        if (shotUpdateErr) {
          console.error(
            "[generate] failed to persist job linkage for shot",
            shotRow.id,
            shotUpdateErr.message,
          );
        }

        dispatchResults.push({
          id:          shotRow.id,
          shot_number: rs.shot_number,
          jobId:       result.jobId,
          assetId:     result.assetId ?? null,
          status:      "dispatching",
        });
      } catch (err) {
        // Capture ALL Error types, not only StudioDispatchError.
        // Generic fallback is intentionally distinct so we can spot it in logs.
        const msg = err instanceof Error
          ? err.message
          : "Generation failed — unknown error";

        const { error: failUpdateErr } = await supabaseAdmin
          .from("video_shots")
          .update({ shot_status: "failed", error_message: msg })
          .eq("id", shotRow.id);

        if (failUpdateErr) {
          console.error(
            "[generate] failed to persist error_message for shot",
            shotRow.id,
            failUpdateErr.message,
          );
        }

        dispatchResults.push({
          id:          shotRow.id,
          shot_number: rs.shot_number,
          jobId:       null,
          assetId:     null,
          status:      "failed",
          error:       msg,
        });
      }
    })
  );

  // Queued shots stay as "pending" — the advance endpoint will dispatch them
  for (const rs of queued) {
    const shotRow = shots.find(s => s.shot_number === rs.shot_number)!;
    dispatchResults.push({
      id:          shotRow.id,
      shot_number: rs.shot_number,
      jobId:       null,
      assetId:     null,
      status:      "pending",
    });
  }

  // Sort by shot_number for clean response
  dispatchResults.sort((a, b) => a.shot_number - b.shot_number);

  return NextResponse.json(
    {
      success: true,
      data: {
        sequenceId: sequence_id,
        shots:      dispatchResults,
      },
    },
    { status: 202 }
  );
}
