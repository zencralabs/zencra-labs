// ─────────────────────────────────────────────────────────────────────────────
// Influencer Seed Selector
//
// Picks the best seed image URL for fal-ai/instant-character based on the
// influencer's demographic profile.
//
// WHY THIS EXISTS:
//   fal-ai/instant-character is image-to-image, not text-only. Every candidate
//   inherits facial DNA from its seed image. One global seed → all influencers
//   look like variations of the same person with different outfits.
//
// RESOLUTION ORDER (per candidate):
//   1. Exact match:   INFLUENCER_SEED_{GENDER}_{REGION}_{CANDIDATE+1}  (alternate per-candidate)
//   2. Exact match:   INFLUENCER_SEED_{GENDER}_{REGION}
//   3. Gender-only:   INFLUENCER_SEED_{GENDER}_DEFAULT_{CANDIDATE+1}   (alternate per-candidate)
//   4. Gender-only:   INFLUENCER_SEED_{GENDER}_DEFAULT
//   5. Global:        INSTANT_CHARACTER_SEED_IMAGE_URL
//   6. Hard fallback: built-in URL (temporary — replace via env var)
//
// ENV VAR PATTERN:
//   INFLUENCER_SEED_FEMALE_SOUTH_ASIAN_INDIAN        (primary seed, female, South Asian Indian)
//   INFLUENCER_SEED_FEMALE_SOUTH_ASIAN_INDIAN_2      (alternate seed for candidate 2+)
//   INFLUENCER_SEED_MALE_AFRICAN_AMERICAN            (primary seed, male, African American)
//   INFLUENCER_SEED_FEMALE_DEFAULT                   (gender fallback, any region)
//   INFLUENCER_SEED_MALE_DEFAULT                     (gender fallback, any region)
//   INFLUENCER_SEED_NEUTRAL_DEFAULT                  (non-binary / androgynous fallback)
//
// SEED REQUIREMENTS:
//   - Must be publicly accessible URLs (no auth headers — fal.ai fetches directly)
//   - Must be hosted on a reliable CDN (Supabase Storage public bucket recommended)
//   - Should be neutral expression, clean background, head+shoulders framing
//   - Should represent the target demographic authentically
//
// ADDING NEW SEEDS:
//   1. Upload portrait to Supabase Storage → influencer-seeds/ bucket (public)
//   2. Add env var to Vercel + .env.local
//   3. No code change needed — the resolver picks it up automatically
// ─────────────────────────────────────────────────────────────────────────────

import type { AIInfluencerProfile } from "./types";

// ── Gender normalization ──────────────────────────────────────────────────────

type GenderKey = "FEMALE" | "MALE" | "NEUTRAL";

function normalizeGender(gender: string | null | undefined): GenderKey {
  if (!gender) return "FEMALE"; // Model's default prior — best soft fallback
  const g = gender.toLowerCase().trim();
  if (g === "male") return "MALE";
  if (g === "female") return "FEMALE";
  // Non-binary, Androgynous, or any other value → neutral seed pool
  return "NEUTRAL";
}

// ── Ethnicity/Region key normalization ────────────────────────────────────────
// Converts region keys like "south-asian-indian" → "SOUTH_ASIAN_INDIAN"
// to match the env var naming convention.

function normalizeRegionKey(region: string | null | undefined): string | null {
  if (!region) return null;
  const key = region.toLowerCase().trim();
  // Exclude "mixed-ethnicity" from exact seed matching — use gender default instead
  if (key === "mixed-ethnicity") return null;
  return key.toUpperCase().replace(/-/g, "_");
}

// ── Env var reader ────────────────────────────────────────────────────────────

function readEnvSeed(key: string): string | undefined {
  const val = process.env[key];
  return val && val.trim().length > 0 ? val.trim() : undefined;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Selects the best demographic seed image for fal-ai/instant-character.
 *
 * Returns a seed URL appropriate for the influencer's gender + ethnicity.
 * Each candidate index can receive a different seed to maximize face diversity
 * within a casting session.
 *
 * Returns `undefined` only if no seed env var is set AND no hard fallback exists
 * (should never happen in production — INSTANT_CHARACTER_SEED_IMAGE_URL is required).
 */
export function selectInfluencerSeed(
  profile: AIInfluencerProfile,
  candidateIndex: number = 0,
): string | undefined {
  const genderKey = normalizeGender(profile.gender);
  const regionKey = normalizeRegionKey(profile.ethnicity_region);

  // ── Pass 1: Exact demographic match (gender + region) ────────────────────
  if (regionKey) {
    // Try alternate seed for this candidate (adds face diversity within region)
    if (candidateIndex > 0) {
      const altExact = readEnvSeed(
        `INFLUENCER_SEED_${genderKey}_${regionKey}_${candidateIndex + 1}`
      );
      if (altExact) return altExact;
    }

    const exact = readEnvSeed(`INFLUENCER_SEED_${genderKey}_${regionKey}`);
    if (exact) return exact;
  }

  // ── Pass 2: Gender-only fallback ─────────────────────────────────────────
  if (candidateIndex > 0) {
    const altGender = readEnvSeed(
      `INFLUENCER_SEED_${genderKey}_DEFAULT_${candidateIndex + 1}`
    );
    if (altGender) return altGender;
  }

  const genderDefault = readEnvSeed(`INFLUENCER_SEED_${genderKey}_DEFAULT`);
  if (genderDefault) return genderDefault;

  // ── Pass 3: Global default ────────────────────────────────────────────────
  const globalDefault = readEnvSeed("INSTANT_CHARACTER_SEED_IMAGE_URL");
  if (globalDefault) return globalDefault;

  // ── Pass 4: Hard fallback ─────────────────────────────────────────────────
  // Should not be reached in production if INSTANT_CHARACTER_SEED_IMAGE_URL is set.
  // Replace this URL by setting INFLUENCER_SEED_FEMALE_DEFAULT in Vercel env.
  return "https://www.zencralabs.com/showcase/login/gpt-image-2.webp";
}

/**
 * Returns a server-safe log label for the resolved seed.
 * Never logs the full URL — it could expose CDN patterns or signed URLs.
 *
 * Example: "seed[exact] gender=FEMALE region=SOUTH_ASIAN_INDIAN candidate=2"
 */
export function seedResolutionLabel(
  profile: AIInfluencerProfile,
  candidateIndex: number,
  resolvedUrl: string | undefined,
): string {
  const genderKey = normalizeGender(profile.gender);
  const regionKey = normalizeRegionKey(profile.ethnicity_region) ?? "AUTO";

  // Determine which resolution pass succeeded
  let source = "fallback";
  if (resolvedUrl) {
    const exactKey = regionKey !== "AUTO"
      ? `INFLUENCER_SEED_${genderKey}_${regionKey}`
      : null;
    const genderKey2 = `INFLUENCER_SEED_${genderKey}_DEFAULT`;
    const globalKey  = "INSTANT_CHARACTER_SEED_IMAGE_URL";

    if (exactKey && process.env[exactKey] === resolvedUrl) {
      source = "exact";
    } else if (process.env[genderKey2] === resolvedUrl) {
      source = "gender-default";
    } else if (process.env[globalKey] === resolvedUrl) {
      source = "global-default";
    } else {
      source = "hard-fallback";
    }
  }

  return `seed[${source}] gender=${genderKey} region=${regionKey} candidate=${candidateIndex}`;
}

// ── Seed pool status (used in admin/debug endpoints) ─────────────────────────

export interface SeedPoolStatus {
  genderKey: GenderKey;
  regionKey:  string | null;
  resolvedSource: "exact" | "gender-default" | "global-default" | "hard-fallback" | "missing";
  hasExact:       boolean;
  hasGenderDefault: boolean;
  hasGlobal:      boolean;
}

export function inspectSeedPool(profile: AIInfluencerProfile): SeedPoolStatus {
  const genderKey = normalizeGender(profile.gender);
  const regionKey = normalizeRegionKey(profile.ethnicity_region);

  const hasExact        = regionKey
    ? !!readEnvSeed(`INFLUENCER_SEED_${genderKey}_${regionKey}`)
    : false;
  const hasGenderDefault = !!readEnvSeed(`INFLUENCER_SEED_${genderKey}_DEFAULT`);
  const hasGlobal        = !!readEnvSeed("INSTANT_CHARACTER_SEED_IMAGE_URL");

  let resolvedSource: SeedPoolStatus["resolvedSource"] = "hard-fallback";
  if (hasExact)         resolvedSource = "exact";
  else if (hasGenderDefault) resolvedSource = "gender-default";
  else if (hasGlobal)   resolvedSource = "global-default";

  return {
    genderKey,
    regionKey,
    resolvedSource,
    hasExact,
    hasGenderDefault,
    hasGlobal,
  };
}
