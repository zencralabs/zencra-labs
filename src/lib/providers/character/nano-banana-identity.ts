/**
 * Character Studio — Nano Banana Pro Identity Provider
 *
 * Multi-reference identity-sheet provider that routes post-lock pack generation
 * through Nano Banana Pro's generative multi-image conditioning.
 *
 * WHY THIS EXISTS:
 *   Instant Character (fal-ai/instant-character) accepts imageUrls[] in the dispatch
 *   call but silently ignores all but the first URL — it is architecturally single-
 *   reference. This means the Identity Chain's growing-memory accumulation
 *   ([canonical] → [canonical, shot1] → [canonical, shot1, shot2] …) has no effect
 *   on actual generation quality with that provider.
 *
 *   Nano Banana Pro accepts up to 14 reference URLs and applies generative
 *   multi-image conditioning across all of them. Routing identity-sheet generation
 *   through NB Pro makes the growing-memory chain semantically meaningful for the
 *   first time — each shot genuinely sees all prior confirmed outputs as references.
 *
 * ARCHITECTURE:
 *   - modelKey:  "nano-banana-pro-identity" (distinct namespace from image studio + casting)
 *   - studio:    "character"
 *   - Delegates all NB API calls to nanoBananaProProvider
 *   - createJob() BRIDGES the imageUrls gap:
 *       identity-chain.ts dispatches { imageUrls: referenceChainUrls } (top-level)
 *       nano-banana.ts resolveReferenceUrls() reads input.providerParams?.referenceUrls
 *       This provider injects input.imageUrls → providerParams.referenceUrls before
 *       delegating, so the growing chain actually reaches the NB Pro API payload.
 *
 * IDENTITY CONTRACT:
 *   - imageUrl is REQUIRED (canonical reference — always ref[0])
 *   - imageUrls[] carries the full growing chain (canonical + prior confirmed outputs)
 *   - prompt is required
 *   - Reference count is capped upstream at MAX_REFERENCES (5) in identity-chain.ts
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 *   NB Pro multi-reference is generative blending, NOT IP-Adapter hard identity locking.
 *   Identity reinforcement strength increases as the chain accumulates more confirmed
 *   outputs referencing the same face, but it is probabilistic — not deterministic.
 *   Empirical quality testing is required to validate consistency across the 5-shot chain.
 *
 * REVERSIBILITY:
 *   To revert to Instant Character: change DEFAULT_MODEL_KEY in packs/route.ts back
 *   to "instant-character". This file stays registered; it will simply not be called.
 *
 * CREDITS:
 *   8 cr per shot (matches nano-banana-pro-casting, same base cost tier).
 *   credit_model_costs row: nano-banana-pro-identity, studio=character, base_credits=8.
 */

import { nanoBananaProProvider } from "../image/nano-banana";
import type { ZProvider, ZProviderInput, ZJob, ValidationResult } from "../core/types";

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nano Banana Pro re-registered as a character studio identity provider.
 *
 * This is a thin delegation wrapper — all NB API communication, polling,
 * and cancellation are handled by the base nanoBananaProProvider. Only the
 * routing metadata (studio, modelKey, studioType) is overridden, plus the
 * critical imageUrls→providerParams.referenceUrls bridge in createJob().
 */
export const nanoBananaIdentityProvider: ZProvider = {
  // ── Override routing metadata ───────────────────────────────────────────────
  ...nanoBananaProProvider,
  modelKey:    "nano-banana-pro-identity",
  studio:      "character",
  displayName: "Nano Banana Pro Identity",

  // ── Validate: requires canonical reference image (image-to-image identity mode) ──
  // Identity-sheet generation is always image-conditioned. imageUrl is mandatory —
  // it carries the canonical reference URL, which is always ref[0] in the chain.
  // Unlike casting mode (text-only), this provider REQUIRES an imageUrl.
  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    if (!input.prompt || input.prompt.trim().length < 3) {
      errors.push("Prompt must be at least 3 characters.");
    }
    if (!input.imageUrl) {
      errors.push(
        "Nano Banana Pro Identity requires a canonical reference image (imageUrl). " +
        "The canonical asset URL must be resolved to a permanent Supabase Storage URL " +
        "before identity-sheet generation can begin.",
      );
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  // ── createJob: bridge imageUrls gap, then delegate to base provider ─────────
  //
  // The bridge:
  //   identity-chain.ts dispatches studioDispatch({ imageUrls: referenceChainUrls })
  //   studio-dispatch.ts maps this to providerInput.imageUrls (top-level)
  //   nano-banana.ts resolveReferenceUrls() reads input.providerParams?.referenceUrls[]
  //   → Without this bridge, the growing chain never reaches the NB Pro API payload.
  //
  // By injecting input.imageUrls into input.providerParams.referenceUrls here,
  // resolveReferenceUrls() finds the full growing reference array and sends it
  // as imageUrls in the NB Pro API request body — enabling true multi-reference
  // generative conditioning across all confirmed prior shots.
  //
  // If imageUrls is empty or absent, fall back to [imageUrl] (canonical only).
  // This ensures Shot 1 (which has no prior confirmed outputs) still works correctly.
  async createJob(input: ZProviderInput): Promise<ZJob> {
    // Build the reference array: prefer imageUrls[] (full growing chain),
    // fall back to [imageUrl] (canonical only, for Shot 1 before any confirmed outputs).
    const growingChain: string[] =
      input.imageUrls && input.imageUrls.length > 0
        ? input.imageUrls
        : input.imageUrl
          ? [input.imageUrl]
          : [];

    // Bridge: inject growing chain into providerParams.referenceUrls so
    // resolveReferenceUrls() in nano-banana.ts picks it up and forwards
    // the full array to the NB Pro API as imageUrls: growingChain.
    const enrichedInput: ZProviderInput = {
      ...input,
      providerParams: {
        ...input.providerParams,
        ...(growingChain.length > 0 ? { referenceUrls: growingChain } : {}),
      },
    };

    // Delegate the actual NB Pro API call to the base provider.
    // nanoBananaProProvider uses the /api/v1/nanobanana/generate-pro endpoint
    // with aspectRatio, resolution, referenceUrls, and callBackUrl already wired.
    const baseJob = await nanoBananaProProvider.createJob(enrichedInput);

    // Override routing metadata so assets table records studio="character"
    // and the correct modelKey for credit billing and Activity Center display.
    return {
      ...baseJob,
      modelKey:   "nano-banana-pro-identity",
      studioType: "character",
    };
  },

  // ── All other methods delegate to base ──────────────────────────────────────
  // getJobStatus, cancelJob, normalizeOutput, handleWebhook, estimateCost,
  // getCapabilities are all inherited from the spread above.
  // Note: estimateCost() is stubbed in nanoBananaProProvider (sacred rule).
  // All billing flows through credit_model_costs row: nano-banana-pro-identity (8 cr).
};
