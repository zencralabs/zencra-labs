/**
 * Provider Router
 *
 * Deterministic, no-randomness provider/model selection for Creative Director.
 * Maps brief signals and user overrides to Zencra's internal model keys.
 *
 * Priority order:
 * 1. providerOverride (explicit user choice)
 * 2. textRenderingIntent heavy → openai gpt-image-1
 * 3. Luxury / Cinematic style or Landing Hero → nano-banana-pro
 * 4. speedPriority → seedream
 * 5. Editorial / Fantasy / Streetwear → flux-kontext
 * 6. conceptRecommendation (AI suggestion, if provider supported)
 * 7. Default → openai gpt-image-1
 */

import { FAL_MODEL_IDS } from "@/lib/providers/core/env";
import type { CDProviderDecision } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER INPUT
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderRouterInput {
  textRenderingIntent?: string;
  realismVsDesign?: number;
  stylePreset?: string;
  projectType?: string;
  speedPriority?: boolean;
  providerOverride?: string | null;
  modelOverride?: string | null;
  conceptRecommendation?: CDProviderDecision | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORTED PROVIDERS (internal registry)
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_PROVIDERS = new Set(["openai", "nano-banana", "seedream", "flux"]);

// Style presets that map to nano-banana (luxury / cinematic)
const NANO_BANANA_PRESETS = new Set([
  "luxury",
  "cinematic",
  "high-end",
  "fashion",
  "premium",
  "editorial-luxury",
]);

// Style presets that map to flux (editorial / artistic)
const FLUX_PRESETS = new Set([
  "editorial",
  "fantasy",
  "streetwear",
  "artistic",
  "avant-garde",
  "underground",
]);

// Project types that benefit from nano-banana
const NANO_BANANA_PROJECT_TYPES = new Set([
  "landing hero",
  "hero image",
  "brand campaign",
  "lifestyle campaign",
]);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ROUTING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * selectCreativeProvider — Deterministic provider/model selection.
 *
 * Returns a CDProviderDecision with provider name, model key (matching
 * the existing provider registry), and a human-readable reason.
 */
export function selectCreativeProvider(
  input: ProviderRouterInput
): CDProviderDecision {
  const styleLower = input.stylePreset?.toLowerCase() ?? "";
  const typeLower = input.projectType?.toLowerCase() ?? "";

  // ── Priority 1: Explicit provider override ────────────────────────────────
  if (input.providerOverride) {
    return buildDecision(
      input.providerOverride,
      input.modelOverride ?? defaultModelForProvider(input.providerOverride),
      "User-specified provider override"
    );
  }

  // ── Priority 2: Text-heavy intent → openai for best text accuracy ─────────
  const textIntent = input.textRenderingIntent ?? "";
  if (
    textIntent === "poster_text" ||
    textIntent === "ad_text" ||
    textIntent === "typography_first"
  ) {
    return buildDecision(
      "openai",
      "gpt-image-1",
      `Text rendering intent "${textIntent}" requires OpenAI gpt-image-1 for best accuracy`
    );
  }

  // ── Priority 3: Luxury/Cinematic style or Landing Hero project ────────────
  if (NANO_BANANA_PRESETS.has(styleLower) || NANO_BANANA_PROJECT_TYPES.has(typeLower)) {
    return buildDecision(
      "nano-banana",
      "nano-banana-pro",
      `Style "${input.stylePreset ?? input.projectType}" benefits from Nano Banana Pro for cinematic quality`
    );
  }

  // ── Priority 4: Speed priority → seedream ────────────────────────────────
  if (input.speedPriority) {
    const seedreamModel = FAL_MODEL_IDS.seedreamV5;
    return buildDecision(
      "seedream",
      seedreamModel,
      "Speed priority enabled — routing to Seedream for fastest turnaround"
    );
  }

  // ── Priority 5: Editorial/Fantasy/Streetwear → flux ──────────────────────
  if (FLUX_PRESETS.has(styleLower)) {
    const fluxModel = FAL_MODEL_IDS.fluxKontext;
    return buildDecision(
      "flux",
      fluxModel,
      `Style "${input.stylePreset}" routes to Flux Kontext for artistic control`
    );
  }

  // ── Priority 6: Concept AI recommendation (if provider is supported) ──────
  if (
    input.conceptRecommendation &&
    SUPPORTED_PROVIDERS.has(input.conceptRecommendation.provider)
  ) {
    const rec = input.conceptRecommendation;
    return buildDecision(
      rec.provider,
      resolveModelKey(rec.provider, rec.model),
      `Concept AI recommendation: ${rec.reason}`
    );
  }

  // ── Priority 7: Default → openai gpt-image-1 ─────────────────────────────
  return buildDecision(
    "openai",
    "gpt-image-1",
    "Default provider — OpenAI gpt-image-1 for reliable, high-quality output"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildDecision(
  provider: string,
  model: string,
  reason: string
): CDProviderDecision {
  return { provider, model, reason };
}

/**
 * defaultModelForProvider — Returns the default model key for a given provider.
 * Maps to Zencra's internal model keys used in the existing provider registry.
 */
function defaultModelForProvider(provider: string): string {
  switch (provider.toLowerCase()) {
    case "openai":
      return "gpt-image-1";
    case "nano-banana":
      return "nano-banana-pro";
    case "seedream":
      return FAL_MODEL_IDS.seedreamV5;
    case "flux":
      return FAL_MODEL_IDS.fluxKontext;
    default:
      return "gpt-image-1"; // Safe fallback
  }
}

/**
 * resolveModelKey — Maps a provider + raw model name to Zencra's internal key.
 * When the concept recommends a model, ensure it's a valid internal model key.
 */
function resolveModelKey(provider: string, rawModel: string): string {
  const provLower = provider.toLowerCase();
  const modelLower = rawModel.toLowerCase();

  if (provLower === "openai") {
    return "gpt-image-1";
  }

  if (provLower === "nano-banana") {
    if (modelLower.includes("pro")) return "nano-banana-pro";
    if (modelLower.includes("2") || modelLower.includes("nb2")) return "nano-banana-2";
    return "nano-banana-standard";
  }

  if (provLower === "seedream") {
    // Use env-configured model IDs
    if (modelLower.includes("v4") || modelLower.includes("4.5")) {
      return FAL_MODEL_IDS.seedream45;
    }
    return FAL_MODEL_IDS.seedreamV5;
  }

  if (provLower === "flux") {
    return FAL_MODEL_IDS.fluxKontext;
  }

  // Unknown provider — return as-is and let registry handle it
  return rawModel;
}
