/**
 * Character Studio — Seedream Identity Provider
 *
 * Thin wrapper around the Image Studio Seedream V5 provider, re-registered
 * under studio: "character" for initial AI Influencer candidate generation.
 *
 * WHY THIS EXISTS:
 *   fal-ai/instant-character is image-to-image only — every candidate inherits
 *   facial DNA from a seed image. Even with a demographic seed pool, diversity
 *   across candidates is limited by the seed.
 *
 *   Seedream V5 is a true text-to-image model. Routing initial "casting" through
 *   it gives the prompt composer full creative latitude: bone structure, ethnicity,
 *   gender, age, and aesthetic are all driven by language, not by seed image DNA.
 *
 * ARCHITECTURE:
 *   - modelKey:  "seedream-v5-identity" (distinct from "seedream-v5" in Image Studio)
 *   - studio:    "character" (required for model-integrity guard + asset tracking)
 *   - Delegates all fal.ai API calls to seedreamV5Provider (same endpoint, same auth)
 *   - createJob() overrides modelKey + studioType in the returned ZJob so assets
 *     are stored with studio="character" in the assets table
 *
 * REVERSIBILITY:
 *   To revert to Instant Character, change DEFAULT_MODEL_KEY in generate/route.ts
 *   back to "instant-character". This file can stay registered; it will simply not
 *   be called.
 *
 * FUTURE USE:
 *   Once Instant Character is used for reference-based identity workflows (packs,
 *   refinement), this file will co-exist: Seedream for casting, Instant Character
 *   for locked-identity pack generation.
 */

import { seedreamV5Provider } from "../image/seedream";
import type { ZProvider, ZProviderInput, ZJob, ValidationResult } from "../core/types";

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seedream V5 re-registered as a character studio provider.
 *
 * This is a thin delegation wrapper — all fal.ai communication, polling,
 * and cancellation are handled by the base seedreamV5Provider. Only the
 * routing metadata (studio, modelKey, studioType) is overridden.
 */
export const seedreamIdentityProvider: ZProvider = {
  // ── Override routing metadata ───────────────────────────────────────────────
  ...seedreamV5Provider,
  modelKey:    "seedream-v5-identity",
  studio:      "character",
  displayName: "Seedream Identity",

  // ── Validate: text-only, no image seed in casting mode ─────────────────────
  // Casting is pure text-to-image. imageUrl is never expected here.
  // (If image-guided casting is needed later, add a separate provider.)
  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    if (!input.prompt || input.prompt.trim().length < 3) {
      errors.push("Prompt must be at least 3 characters.");
    }
    // Casting mode: reject image seeds — this provider is text-to-image only.
    // Reference images are used POST-lock via instant-character, not here.
    if (input.imageUrl) {
      errors.push(
        "Seedream Identity (casting mode) does not accept a seed image. " +
        "Image-guided generation is available post-lock via Instant Character.",
      );
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  // ── createJob: delegate to base, then override routing metadata in ZJob ─────
  async createJob(input: ZProviderInput): Promise<ZJob> {
    // Delegate the actual fal.ai HTTP call to the base provider.
    // The base seedreamV5Provider correctly submits to fal-ai/seedream endpoint.
    const baseJob = await seedreamV5Provider.createJob(input);

    // Override the routing metadata so assets table records studio="character".
    // The fal.ai request and polling URLs are unaffected — they live in
    // externalJobId + providerMeta, which we carry through unchanged.
    return {
      ...baseJob,
      modelKey:   "seedream-v5-identity",
      studioType: "character",
    };
  },

  // ── All other methods delegate to base ──────────────────────────────────────
  // getJobStatus, cancelJob, normalizeOutput, handleWebhook, estimateCost,
  // getCapabilities are all inherited from the spread above.
  // Note: estimateCost() returns 15 cr base (same as seedream-v5) — this
  // matches the credit_model_costs row seeded in migration 047.
};
