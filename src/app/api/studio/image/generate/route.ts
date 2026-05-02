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
import { resolveInfluencerHandles, injectIdentityIntoPrompt }
                                     from "@/lib/ai-influencer/handle-resolver";

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

  // ── Character mode validation ────────────────────────────────────────────────
  const VALID_CHARACTER_MODES = ['base', 'lookbook', 'refine', 'scene', 'upscale', 'motion'] as const;
  type CharacterMode = typeof VALID_CHARACTER_MODES[number];

  if (mode && !VALID_CHARACTER_MODES.includes(mode as CharacterMode)) {
    return Response.json(
      { success: false, error: `Invalid character mode. Allowed: ${VALID_CHARACTER_MODES.join(', ')}`, code: 'INVALID_CHARACTER_MODE' },
      { status: 400 }
    );
  }

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

  // ── AI Influencer @handle resolution ─────────────────────────────────────────
  // If the prompt contains any @Handle tokens, ALL of them must resolve to an
  // active influencer with a complete identity lock.  If any handle is missing
  // or lacks an identity lock the request is rejected — we never fall back to a
  // random generation when the user explicitly requested an identity.
  const rawHandles = [
    ...new Set(
      [...prompt!.matchAll(/@([a-zA-Z][a-zA-Z0-9_]{0,30})/g)]
        .map(m => m[1].toLowerCase())
        .filter(h => !/^img\d+$/i.test(h) && !/^image\d+$/i.test(h)),
    ),
  ];

  let resolvedPrompt       = prompt!;
  let dispatchImageUrl     = imageUrl;
  let dispatchProviderParams = providerParams;

  if (rawHandles.length > 0) {
    let resolved: Awaited<ReturnType<typeof resolveInfluencerHandles>>;
    try {
      resolved = await resolveInfluencerHandles({ userId, prompt: prompt! });
    } catch (err) {
      console.error("[/api/studio/image/generate] handle resolution threw:", err);
      return serverErr();
    }

    // Determine which handles were not resolved
    const resolvedSet      = new Set(resolved.influencerContexts.map(c => c.handle));
    const unresolvedHandles = rawHandles.filter(h => !resolvedSet.has(h));

    if (unresolvedHandles.length > 0) {
      const list   = unresolvedHandles.map(h => `@${h}`).join(", ");
      const plural = unresolvedHandles.length > 1;
      return invalidInput(
        `The influencer handle${plural ? "s" : ""} ${list} ${plural ? "were" : "was"} not found or ${plural ? "do" : "does"} not have an identity lock set up yet. ` +
        `Make sure the AI Influencer is active and has completed identity training before using it in a prompt.`
      );
    }

    // All handles resolved — inject identity anchor and optionally attach canonical asset
    if (resolved.hasInfluencers && resolved.primaryContext) {
      const ctx = resolved.primaryContext;
      resolvedPrompt = injectIdentityIntoPrompt(resolved.cleanedPrompt, ctx);

      // Attach canonical asset only when:
      //   1. The model supports at least one reference image
      //   2. The user has NOT already provided any reference image (user ref takes priority)
      const caps          = getModelCapabilities(modelKey!);
      const userHasImgRef = typeof imageUrl === "string" && imageUrl.length > 0;
      const userHasNbRefs = Array.isArray(providerParams?.referenceUrls) &&
                            (providerParams!.referenceUrls as unknown[]).length > 0;

      if (caps.maxReferenceImages > 0 && !userHasImgRef && !userHasNbRefs && ctx.canonical_asset_url) {
        if (modelKey === "gpt-image-1") {
          dispatchImageUrl = ctx.canonical_asset_url;
        } else {
          // Nano Banana family — prepend canonical to referenceUrls
          dispatchProviderParams = {
            ...(providerParams ?? {}),
            referenceUrls: [ctx.canonical_asset_url],
          };
        }
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
      prompt:        resolvedPrompt,
      negativePrompt,
      imageUrl:      dispatchImageUrl,
      aspectRatio,
      seed,
      providerParams: dispatchProviderParams,
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
