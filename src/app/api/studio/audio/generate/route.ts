/**
 * POST /api/studio/audio/generate
 *
 * Dispatches an audio generation job (TTS / voice cloning) through the orchestrator.
 * Feature-flagged: requires Audio Studio to be enabled via ZENCRA_FLAG_AUDIO_ENABLED.
 *
 * Supported models (Phase 1 active):
 *   elevenlabs
 *
 * ElevenLabs TTS is synchronous — responds immediately with audio URL.
 *
 * Request body:
 *   { modelKey, prompt, voiceId?, providerParams? }
 *
 *   prompt  — the text to synthesize
 *   voiceId — ElevenLabs voice ID (optional; defaults to provider default)
 *
 * Response:
 *   202 { success: true, data: { jobId, status, url, assetId, estimatedCredits } }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 FEATURE_DISABLED
 *   400 INVALID_INPUT — prompt or modelKey missing
 *   402 INSUFFICIENT_CREDITS
 *   502 PROVIDER_ERROR
 */

import { requireAuthUser }           from "@/lib/supabase/server";
import { guardStudio }               from "@/lib/api/feature-gate";
import { studioDispatch, StudioDispatchError, dispatchErrorStatus }
                                     from "@/lib/api/studio-dispatch";
import { accepted, invalidInput, serverErr, parseBody, requireField }
                                     from "@/lib/api/route-utils";
import { checkStudioRateLimit }      from "@/lib/security/rate-limit";
import { checkEntitlement, consumeTrialUsage, consumeFreeUsage }
                                     from "@/lib/billing/entitlement";
import { assertModelRouteIntegrity, ProviderMismatchError }
                                     from "@/lib/providers/core/model-integrity";

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

  // ── Feature gate ────────────────────────────────────────────────────────────
  const gate = guardStudio("audio");
  if (gate) return gate;

  // ── Billing entitlement ─────────────────────────────────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, "audio");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json({ success: false, error: err.message, code: err.code }, { status: dispatchErrorStatus(err.code) });
    }
    console.error("[/api/studio/audio/generate] entitlement check failed:", err);
    return serverErr();
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const { value: modelKey, fieldError: mkErr } = requireField(body!, "modelKey");
  if (mkErr) return mkErr;

  // ── Model integrity ──────────────────────────────────────────────────────────
  try {
    assertModelRouteIntegrity(modelKey!, "audio");
  } catch (err) {
    if (err instanceof ProviderMismatchError) return invalidInput(err.detail);
    return serverErr();
  }

  const { value: prompt, fieldError: pErr } = requireField(body!, "prompt");
  if (pErr) return pErr;

  const voiceId      = typeof body!.voiceId      === "string" ? body!.voiceId      : undefined;
  const providerParams = typeof body!.providerParams === "object" && body!.providerParams !== null
    ? body!.providerParams as Record<string, unknown>
    : undefined;

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  try {
    const { job, assetId } = await studioDispatch({
      userId,
      studio:   "audio",
      modelKey: modelKey!,
      prompt:   prompt!,
      voiceId,
      providerParams,
    });

    // ── Trial usage consumption (fire-and-forget) ─────────────────────────────
    if (entitlement.path === "trial" && entitlement.trialEndsAt) {
      void consumeTrialUsage(userId, "audio", entitlement.trialEndsAt);
    }

    // ── Free-tier usage consumption (fire-and-forget) ─────────────────────────
    if (entitlement.path === "free") {
      void consumeFreeUsage(userId, "audio");
    }

    return accepted({
      jobId:            job.id,
      externalJobId:    job.externalJobId,
      status:           job.status,
      url:              job.result?.url,
      assetId,
      estimatedCredits: job.estimatedCredits,
    });
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      const status = dispatchErrorStatus(err.code);
      return Response.json({ success: false, error: err.message, code: err.code }, { status });
    }
    console.error("[/api/studio/audio/generate]", err);
    return serverErr();
  }
}
