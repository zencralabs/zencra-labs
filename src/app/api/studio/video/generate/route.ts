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
import { resolveInfluencerHandles, injectIdentityIntoPrompt }
                                     from "@/lib/ai-influencer/handle-resolver";

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

  let   imageUrl          = typeof body!.imageUrl          === "string" ? body!.imageUrl          : undefined;
  const endImageUrl       = typeof body!.endImageUrl       === "string" ? body!.endImageUrl       : undefined;
  const referenceVideoUrl = typeof body!.referenceVideoUrl === "string" ? body!.referenceVideoUrl : undefined;
  const useIdentityStartFrame = body!.useIdentityStartFrame === true;
  // motionControl — prompt-layer cinematic movement instruction.
  // preset: one of the MOTION_PRESET_PROMPTS keys (or "none" / absent = no injection).
  // customNote: optional free-text rider appended after the preset instruction.
  const motionControl = (typeof body!.motionControl === "object" && body!.motionControl !== null)
    ? body!.motionControl as { preset?: string; customNote?: string }
    : undefined;
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

  // ── Character mode validation ────────────────────────────────────────────────
  const VALID_CHARACTER_MODES = ['base', 'lookbook', 'refine', 'scene', 'upscale', 'motion'] as const;
  type CharacterMode = typeof VALID_CHARACTER_MODES[number];

  if (mode && !VALID_CHARACTER_MODES.includes(mode as CharacterMode)) {
    return Response.json(
      { success: false, error: `Invalid character mode. Allowed: ${VALID_CHARACTER_MODES.join(', ')}`, code: 'INVALID_CHARACTER_MODE' },
      { status: 400 }
    );
  }

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

  // ── AI Influencer @handle resolution ─────────────────────────────────────────
  // If the prompt contains any @Handle tokens, ALL of them must resolve to an
  // active influencer with a complete identity lock.  Any unresolved handle
  // blocks generation entirely — no silent fallback, no random generation.
  //
  // Video identity uses prompt-only injection (no canonical asset attachment).
  // The injected anchor adds a temporal consistency line on top of the standard
  // identity phrase to maintain face/identity across all video frames.
  const rawHandles = [
    ...new Set(
      [...prompt!.matchAll(/@([a-zA-Z][a-zA-Z0-9_]{0,30})/g)].map(m => m[1].toLowerCase())
    ),
  ];

  let resolvedPrompt = prompt!;

  if (rawHandles.length > 0) {
    let resolved: Awaited<ReturnType<typeof resolveInfluencerHandles>>;
    try {
      resolved = await resolveInfluencerHandles({ userId, prompt: prompt! });
    } catch (err) {
      console.error("[/api/studio/video/generate] handle resolution threw:", err);
      return serverErr();
    }

    // Determine which handles were not resolved
    const resolvedSet       = new Set(resolved.influencerContexts.map(c => c.handle));
    const unresolvedHandles = rawHandles.filter(h => !resolvedSet.has(h));

    if (unresolvedHandles.length > 0) {
      const list   = unresolvedHandles.map(h => `@${h}`).join(", ");
      const plural = unresolvedHandles.length > 1;
      return invalidInput(
        `The influencer handle${plural ? "s" : ""} ${list} ${plural ? "were" : "was"} not found or ` +
        `${plural ? "do" : "does"} not have an identity lock set up yet. ` +
        `Make sure the AI Influencer is active and has completed identity training before using it in a prompt.`
      );
    }

    // All handles resolved — inject identity anchor + video temporal consistency
    if (resolved.hasInfluencers && resolved.primaryContext) {
      const ctx = resolved.primaryContext;
      // Standard identity anchor (shared with Image Studio)
      resolvedPrompt = injectIdentityIntoPrompt(resolved.cleanedPrompt, ctx);
      // Video-specific temporal consistency line — appended after the anchor
      resolvedPrompt +=
        " Maintain the same face, identity, age, skin tone, and facial structure consistently" +
        " across every frame of the video. Do not morph, blend, swap, or drift the identity during motion.";

      // ── End-frame identity constraint (Phase 2) ────────────────────────────
      // Only injected when the user has supplied an explicit end frame image.
      // Enforces that the end frame is the same person — not a different
      // character, not a different face, not a blend or morph.
      if (endImageUrl) {
        resolvedPrompt +=
          " End frame must show the same person as the start frame." +
          " Do not change the face, identity, age, or facial structure in the end frame.";
      }

      // ── Identity start frame (Phase 2) ─────────────────────────────────────
      // User explicitly opted in — silent fallback is not acceptable here.
      // If canonical_asset_url is missing, block and tell the user why.
      if (useIdentityStartFrame && !imageUrl && !referenceVideoUrl) {
        if (!ctx.canonical_asset_url) {
          return invalidInput(
            `Start frame identity is not ready for @${ctx.displayName}. Please finish identity selection first.`,
          );
        }
        imageUrl = ctx.canonical_asset_url;
      }
    }
  }

  // ── Prompt construction order (maintained here) ───────────────────────────────
  // 1. User prompt (raw)
  // 2. Identity anchor phrase — injectIdentityIntoPrompt()
  // 3. Temporal consistency line — "Maintain the same face…" (when @handle present)
  // 4. End-frame identity constraint — "End frame must show the same person…" (when endImageUrl + @handle)
  // 5. Identity start-frame fallback resolved (imageUrl set to canonical_asset_url above)
  // 6. Motion instruction — cinematic direction from motionControl.preset ← HERE
  // 7. Motion frame relationship — start/end frame anchors ← HERE
  // 8. Identity-safe motion rule — character consistency during motion ← HERE
  //
  // FUTURE: Story Mode (multi-shot) — when implemented, insert AFTER step 8:
  // "This is scene [N] of [total]. The character @handle must match exactly across
  //  all scenes: same costume, lighting context, and emotional arc continuity."

  const MOTION_PRESET_PROMPTS: Record<string, string> = {
    cinematic_push: "Camera slowly pushes in toward the subject with a smooth cinematic dolly movement.",
    orbit:          "Camera performs a slow, smooth orbital arc around the subject.",
    walk_forward:   "Subject walks naturally forward toward the camera with fluid, grounded motion.",
    handheld:       "Subtle handheld camera movement with organic, naturally stabilized shake.",
    slow_drift:     "Gentle, slow camera drift across the scene.",
    reveal:         "Camera begins close on a detail and slowly pulls back to reveal the full scene.",
  };

  if (motionControl?.preset && motionControl.preset !== "none") {
    const motionLine = MOTION_PRESET_PROMPTS[motionControl.preset];
    if (motionLine) {
      // Step 6 — motion direction
      resolvedPrompt += ` ${motionLine}`;

      // Step 7 — frame relationship: anchor motion to start/end frames when present
      if (imageUrl) {
        resolvedPrompt += " Motion begins from the start frame composition.";
      }
      if (endImageUrl) {
        resolvedPrompt += " Use the end frame as the final composition target while preserving identity.";
      }

      // Step 8 — identity-safe motion rule (only when @handle is present)
      if (rawHandles.length > 0) {
        resolvedPrompt +=
          " The same character must remain visually consistent during all motion." +
          " Do not change face, hairstyle, age, skin tone, body type, or identity." +
          " Do not introduce new faces or blend identities.";
      }

      // Optional free-text rider (e.g. from future Director Panel)
      if (motionControl.customNote) {
        resolvedPrompt += ` ${motionControl.customNote}`;
      }
    }
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  try {
    const { job, assetId } = await studioDispatch({
      userId,
      ip:              clientIp,
      studio:          "video",
      modelKey:        modelKey!,
      prompt:          resolvedPrompt,
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
