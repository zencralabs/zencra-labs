/**
 * POST /api/studio/video/generate
 *
 * Dispatches a video generation job through the provider orchestrator.
 * Feature-flagged: requires Video Studio to be enabled via ZENCRA_FLAG_VIDEO_ENABLED.
 *
 * Supported models (Phase 1 active):
 *   kling-30-omni, kling-30, kling-motion-control,
 *   seedance-20, seedance-20-fast, seedance-15
 *
 * All video providers are async (polling). The route returns immediately with
 * status "pending" and a jobId. The client polls /api/studio/jobs/[jobId]/status.
 *
 * Request body:
 *   { modelKey, prompt, imageUrl?, endImageUrl?, aspectRatio?, durationSeconds?,
 *     negativePrompt?, seed?, providerParams? }
 *
 * Response:
 *   202 { success: true, data: { jobId, externalJobId, status: "pending", assetId } }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 FEATURE_DISABLED
 *   400 INVALID_INPUT
 *   402 INSUFFICIENT_CREDITS
 *   404 MODEL_NOT_FOUND
 *   502 PROVIDER_ERROR
 */

import { requireAuthUser }           from "@/lib/supabase/server";
import { guardStudio }               from "@/lib/api/feature-gate";
import { studioDispatch, StudioDispatchError, dispatchErrorStatus }
                                     from "@/lib/api/studio-dispatch";
import { accepted, invalidInput, serverErr, parseBody, requireField }
                                     from "@/lib/api/route-utils";
import { checkStudioRateLimit, checkIpStudioRateLimit, getClientIp }
                                     from "@/lib/security/rate-limit";
import { checkEntitlement, consumeTrialUsage }
                                     from "@/lib/billing/entitlement";
import { assertModelRouteIntegrity, ProviderMismatchError }
                                     from "@/lib/providers/core/model-integrity";
import { CharacterOrchestrator }     from "@/lib/character";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const rateLimitError = await checkStudioRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  const clientIp = getClientIp(req);
  const ipRateLimitError = await checkIpStudioRateLimit(clientIp);
  if (ipRateLimitError) return ipRateLimitError;

  // ── Feature gate ────────────────────────────────────────────────────────────
  const gate = guardStudio("video");
  if (gate) return gate;

  // ── Billing entitlement ─────────────────────────────────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, "video");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json({ success: false, error: err.message, code: err.code }, { status: dispatchErrorStatus(err.code) });
    }
    console.error("[/api/studio/video/generate] entitlement check failed:", err);
    return serverErr();
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const { value: modelKey, fieldError: mkErr } = requireField(body!, "modelKey");
  if (mkErr) return mkErr;

  // ── Model integrity ──────────────────────────────────────────────────────────
  try {
    assertModelRouteIntegrity(modelKey!, "video");
  } catch (err) {
    if (err instanceof ProviderMismatchError) return invalidInput(err.detail);
    return serverErr();
  }

  const { value: prompt, fieldError: pErr } = requireField(body!, "prompt");
  if (pErr) return pErr;

  const imageUrl          = typeof body!.imageUrl          === "string" ? body!.imageUrl          : undefined;
  const endImageUrl       = typeof body!.endImageUrl       === "string" ? body!.endImageUrl       : undefined;
  const referenceVideoUrl = typeof body!.referenceVideoUrl === "string" ? body!.referenceVideoUrl : undefined;
  const aspectRatio       = typeof body!.aspectRatio       === "string" ? body!.aspectRatio       : undefined;
  const negativePrompt = typeof body!.negativePrompt === "string" ? body!.negativePrompt : undefined;
  const seed           = typeof body!.seed           === "number" ? body!.seed           : undefined;
  const providerParams = typeof body!.providerParams === "object" && body!.providerParams !== null
    ? body!.providerParams as Record<string, unknown>
    : undefined;

  // Character Studio context — optional pass-through fields
  const character_id = typeof body!.character_id === "string" ? body!.character_id : undefined;
  const soul_id      = typeof body!.soul_id      === "string" ? body!.soul_id      : undefined;
  const mode         = typeof body!.mode         === "string" ? body!.mode         : undefined;

  // durationSeconds — validate range 1–120
  let durationSeconds: number | undefined;
  if (body!.durationSeconds !== undefined) {
    const d = Number(body!.durationSeconds);
    if (!Number.isFinite(d) || d < 1 || d > 120) {
      return Response.json(
        { success: false, error: "durationSeconds must be between 1 and 120.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    durationSeconds = d;
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  try {
    const { job, assetId } = await studioDispatch({
      userId,
      ip:              clientIp,
      studio:          "video",
      modelKey:        modelKey!,
      prompt:          prompt!,
      imageUrl,
      endImageUrl,
      referenceVideoUrl,
      aspectRatio,
      durationSeconds,
      negativePrompt,
      seed,
      providerParams,
    });

    // ── Character job linking (non-blocking fire-and-forget) ──────────────────
    if (character_id) {
      void CharacterOrchestrator.linkJobToCharacter(job.id, character_id, soul_id, mode);
    }

    // ── Trial usage consumption (fire-and-forget) ─────────────────────────────
    if (entitlement.path === "trial" && entitlement.trialEndsAt) {
      void consumeTrialUsage(userId, "video", entitlement.trialEndsAt);
    }

    return accepted({
      jobId:            job.id,
      externalJobId:    job.externalJobId,
      status:           job.status,
      assetId,
      estimatedCredits: job.estimatedCredits,
    });
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      const status = dispatchErrorStatus(err.code);
      return Response.json({ success: false, error: err.message, code: err.code }, { status });
    }
    console.error("[/api/studio/video/generate]", err);
    return serverErr();
  }
}
