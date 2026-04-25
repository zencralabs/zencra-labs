/**
 * POST /api/studio/image/generate
 *
 * Dispatches an image generation job through the provider orchestrator.
 * Feature-flagged: requires Image Studio to be enabled via ZENCRA_FLAG_IMAGE_ENABLED.
 *
 * Supported models (Phase 1 active):
 *   gpt-image-1, nano-banana-standard, nano-banana-pro, nano-banana-2,
 *   seedream-v5, seedream-4-5, flux-kontext
 *
 * Request body:
 *   { modelKey, prompt, negativePrompt?, imageUrl?, aspectRatio?, seed?, providerParams? }
 *
 * Response (sync result — image ready immediately):
 *   202 { success: true, data: { jobId, status, url, assetId, estimatedCredits } }
 *
 * Response (async result — unlikely for image but handled):
 *   202 { success: true, data: { jobId, status: "pending", assetId } }
 *
 * Errors:
 *   401 UNAUTHORIZED   — missing or invalid Bearer token
 *   403 FEATURE_DISABLED — studio flag is off
 *   400 INVALID_INPUT  — missing modelKey or prompt
 *   402 INSUFFICIENT_CREDITS
 *   404 MODEL_NOT_FOUND
 *   502 PROVIDER_ERROR
 */

import { requireAuthUser }           from "@/lib/supabase/server";
import { guardStudio }               from "@/lib/api/feature-gate";
import { studioDispatch, StudioDispatchError, dispatchErrorStatus }
                                     from "@/lib/api/studio-dispatch";
import { accepted, invalidInput, serverErr, providerErr, parseBody, requireField }
                                     from "@/lib/api/route-utils";
import { checkStudioRateLimit, checkIpStudioRateLimit, getClientIp }
                                     from "@/lib/security/rate-limit";
import { checkEntitlement, consumeTrialUsage }
                                     from "@/lib/billing/entitlement";
import { assertModelRouteIntegrity, ProviderMismatchError }
                                     from "@/lib/providers/core/model-integrity";
import { getModelCapabilities }       from "@/lib/studio/model-capabilities";
import { apiErr }                     from "@/lib/api/route-utils";
import { CharacterOrchestrator }      from "@/lib/character";

// Runtime key presence check — runs once per cold start, not per request
if (!process.env.OPENAI_API_KEY) {
  console.error("[image-generate] OPENAI_API_KEY is NOT set — image generation will fail with 401");
} else {
  console.log("[image-generate] OPENAI_API_KEY present ✓ (length:", process.env.OPENAI_API_KEY.length, ")");
}

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
  const gate = guardStudio("image");
  if (gate) return gate;

  // ── Billing entitlement ─────────────────────────────────────────────────────
  let entitlement: Awaited<ReturnType<typeof checkEntitlement>>;
  try {
    entitlement = await checkEntitlement(userId, "image");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json({ success: false, error: err.message, code: err.code }, { status: dispatchErrorStatus(err.code) });
    }
    console.error("[/api/studio/image/generate] entitlement check failed:", err);
    return serverErr();
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const { value: modelKey, fieldError: mkErr } = requireField(body!, "modelKey");
  if (mkErr) return mkErr;

  // ── Model integrity ──────────────────────────────────────────────────────────
  // Validates: exists in registry, active, belongs to image studio, has providerFamily.
  // Catches studio mismatch (e.g. video model sent to image route) before credits reserve.
  try {
    assertModelRouteIntegrity(modelKey!, "image");
  } catch (err) {
    if (err instanceof ProviderMismatchError) return invalidInput(err.detail);
    return serverErr();
  }

  const { value: prompt, fieldError: pErr } = requireField(body!, "prompt");
  if (pErr) return pErr;

  // Optional fields
  const negativePrompt = typeof body!.negativePrompt === "string" ? body!.negativePrompt : undefined;
  const imageUrl       = typeof body!.imageUrl       === "string" ? body!.imageUrl       : undefined;
  const aspectRatio    = typeof body!.aspectRatio    === "string" ? body!.aspectRatio    : undefined;
  const seed           = typeof body!.seed           === "number" ? body!.seed           : undefined;
  const providerParams = typeof body!.providerParams === "object" && body!.providerParams !== null
    ? body!.providerParams as Record<string, unknown>
    : undefined;

  // Character Studio context — optional pass-through fields
  const character_id = typeof body!.character_id === "string" ? body!.character_id : undefined;
  const soul_id      = typeof body!.soul_id      === "string" ? body!.soul_id      : undefined;
  const mode         = typeof body!.mode         === "string" ? body!.mode         : undefined;

  // ── Reference image cap ──────────────────────────────────────────────────────
  // Enforce server-side cap before any credit reserve or DB write.
  // Cap comes from MODEL_CAPABILITIES (product-configured, not provider hard limits).
  if (providerParams) {
    const refs = providerParams.referenceUrls;
    if (Array.isArray(refs) && refs.length > 0) {
      const cap = getModelCapabilities(modelKey!);
      if (refs.length > cap.maxReferenceImages) {
        return apiErr(
          "TOO_MANY_REFERENCE_IMAGES",
          `Too many reference images: ${refs.length} provided, maximum is ${cap.maxReferenceImages} for model "${modelKey}". ${cap.uploadCapLabel}.`,
          400
        );
      }
    }
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  try {
    const { job, assetId } = await studioDispatch({
      userId,
      ip:            clientIp,
      studio:        "image",
      modelKey:      modelKey!,
      prompt:        prompt!,
      negativePrompt,
      imageUrl,
      aspectRatio,
      seed,
      providerParams,
    });

    // ── Character job linking (non-blocking fire-and-forget) ──────────────────
    if (character_id) {
      void CharacterOrchestrator.linkJobToCharacter(job.id, character_id, soul_id, mode);
    }

    // ── Trial usage consumption (fire-and-forget) ─────────────────────────────
    if (entitlement.path === "trial" && entitlement.trialEndsAt) {
      void consumeTrialUsage(userId, "image", entitlement.trialEndsAt);
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
    console.error("[/api/studio/image/generate]", err);
    // Surface sanitized provider messages (e.g. 401, 429, content policy) — never expose raw API bodies.
    // gpt-image.ts sanitizeOpenAIError() already scrubs the message before throwing.
    if (err instanceof Error && err.message) return providerErr(err.message);
    return serverErr();
  }
}
