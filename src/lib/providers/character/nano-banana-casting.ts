/**
 * Character Studio — Nano Banana Pro Casting Provider
 *
 * Thin wrapper around the Image Studio Nano Banana Pro provider,
 * re-registered under studio: "character" for AI Influencer candidate generation.
 *
 * WHY THIS EXISTS:
 *   Nano Banana Pro is a true text-to-image model (unlike Instant Character which
 *   is image-to-image only). Routing initial "casting" through it gives the prompt
 *   composer full creative latitude — bone structure, ethnicity, gender, age, and
 *   aesthetic are all driven by language, not inherited from a seed image.
 *
 *   Compared to Seedream V5 (the previous casting engine), NB Pro:
 *     - Uses the same polling architecture (task-based async) ✅
 *     - Returns the same URL shape (resultImageUrl via successFlag) ✅
 *     - Supports aspectRatio "2:3" (portrait, our casting default) ✅
 *     - Is cheaper per candidate (12 cr vs 15 cr) ✅
 *     - Does NOT send reference images during casting (diversity mode) ✅
 *
 * ARCHITECTURE:
 *   - modelKey:  "nano-banana-pro-casting" (distinct from "nano-banana-pro" in Image Studio)
 *   - studio:    "character" (required for model-integrity guard + asset tracking)
 *   - Delegates all NB API calls to nanoBananaProProvider (same endpoint, same auth)
 *   - createJob() overrides modelKey + studioType in the returned ZJob so assets
 *     are stored with studio="character" in the assets table
 *
 * REVERSIBILITY:
 *   To revert to Seedream V5: change DEFAULT_MODEL_KEY in generate/route.ts back
 *   to "seedream-v5-identity". This file can stay registered; it will simply not
 *   be called.
 *
 * FUTURE USE:
 *   Once the casting engine is locked and identity packs are generated via
 *   Instant Character, this file will co-exist:
 *     - NB Pro Casting → initial candidate generation (this file)
 *     - Instant Character → post-lock pack generation (instant-character.ts)
 *
 * CREDITS:
 *   12 cr per candidate (matches nano-banana-pro in Image Studio).
 *   credit_model_costs row: nano-banana-pro-casting, studio=character, base_credits=12.
 */

import { nanoBananaProProvider } from "../image/nano-banana";
import type { ZProvider, ZProviderInput, ZJob, ValidationResult } from "../core/types";

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nano Banana Pro re-registered as a character studio casting provider.
 *
 * This is a thin delegation wrapper — all NB API communication, polling,
 * and cancellation are handled by the base nanoBananaProProvider. Only the
 * routing metadata (studio, modelKey, studioType) is overridden.
 */
export const nanoBananaCastingProvider: ZProvider = {
  // ── Override routing metadata ───────────────────────────────────────────────
  ...nanoBananaProProvider,
  modelKey:    "nano-banana-pro-casting",
  studio:      "character",
  displayName: "Nano Banana Pro Casting",

  // ── Validate: text-only, no image seed in casting mode ─────────────────────
  // Casting is pure text-to-image. imageUrl is never expected here.
  // Reference images are used POST-lock via instant-character, not here.
  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    if (!input.prompt || input.prompt.trim().length < 3) {
      errors.push("Prompt must be at least 3 characters.");
    }
    // Casting mode: reject image seeds — this provider is text-to-image only.
    if (input.imageUrl) {
      errors.push(
        "Nano Banana Pro Casting (casting mode) does not accept a seed image. " +
        "Image-guided generation is available post-lock via Instant Character.",
      );
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  // ── createJob: delegate to base, then override routing metadata in ZJob ─────
  async createJob(input: ZProviderInput): Promise<ZJob> {
    // Delegate the actual NB Pro API call to the base provider.
    // nanoBananaProProvider uses the /api/v1/nanobanana/generate-pro endpoint
    // with aspectRatio, resolution, and callBackUrl already wired correctly.
    const baseJob = await nanoBananaProProvider.createJob(input);

    // Override the routing metadata so assets table records studio="character".
    // The NB API request, task ID, and polling path are all unaffected —
    // they live in externalJobId + providerMeta, carried through unchanged.
    return {
      ...baseJob,
      modelKey:   "nano-banana-pro-casting",
      studioType: "character",
    };
  },

  // ── All other methods delegate to base ──────────────────────────────────────
  // getJobStatus, cancelJob, normalizeOutput, handleWebhook, estimateCost,
  // getCapabilities are all inherited from the spread above.
  // Note: estimateCost() is stubbed in nanoBananaProProvider (sacred rule).
  // All billing flows through credit_model_costs row: nano-banana-pro-casting (12 cr).
};
