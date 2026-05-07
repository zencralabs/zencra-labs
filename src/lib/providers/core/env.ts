/**
 * Zencra Provider Environment Configuration
 *
 * Centralized, namespaced env variable loading for all provider families.
 * Every provider imports its config from here — never from process.env directly.
 *
 * Rules:
 *   - All provider credentials are isolated per family
 *   - Missing required keys throw a clear, actionable error
 *   - Missing optional keys return undefined (callers handle gracefully)
 *   - No credentials are logged or exposed in error messages
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `[zencra-providers] Missing required environment variable: ${key}. ` +
      `See .env.example for setup instructions.`
    );
  }
  return val;
}

function optional(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENAI — GPT Image (gpt-image-1 + gpt-image-2)
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenAIEnv {
  apiKey: string;
  /** Exact model string sent to OpenAI for gpt-image-1 generations. */
  model: string;
  /** Exact model string sent to OpenAI for gpt-image-2 generations.
   *  Set GPT_IMAGE_2_MODEL_ID once OpenAI publishes the confirmed API string.
   *  Default "gpt-image-2" matches the expected upstream identifier. */
  model2: string;
}

export function getOpenAIEnv(): OpenAIEnv {
  return {
    apiKey: required("OPENAI_API_KEY"),
    model:  optional("GPT_IMAGE_MODEL_ID",   "gpt-image-1.5") as string,
    model2: optional("GPT_IMAGE_2_MODEL_ID",  "gpt-image-2") as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NANO BANANA
// ─────────────────────────────────────────────────────────────────────────────

export interface NanoBananaEnv {
  apiKey: string;
  baseUrl: string;
  callbackUrl: string;
  /**
   * Nano Banana 2 generation endpoint path (relative to baseUrl).
   * Default: /api/v1/nanobanana/generate  (same as Standard — confirmed working).
   * Override via NANO_BANANA_NB2_ENDPOINT if the reseller docs specify a dedicated path.
   * Example: NANO_BANANA_NB2_ENDPOINT=/api/v1/nanobanana/generate-pro
   */
  nb2Endpoint: string;
}

export function getNanoBananaEnv(): NanoBananaEnv {
  return {
    apiKey:      required("NANO_BANANA_API_KEY"),
    baseUrl:     optional("NANO_BANANA_API_BASE_URL", "https://api.nanobananaapi.ai") as string,
    // Correct webhook path: /api/webhooks/studio/nano-banana
    // Set NANO_BANANA_CALLBACK_URL in .env.local/.env.production to override.
    callbackUrl: optional(
      "NANO_BANANA_CALLBACK_URL",
      `${optional("NEXT_PUBLIC_SITE_URL", "https://zencralabs.com")}/api/webhooks/studio/nano-banana`
    ) as string,
    // NB2 endpoint — defaults to the standard route (proven working).
    // Set NANO_BANANA_NB2_ENDPOINT if your reseller account has a dedicated path
    // e.g. /api/v1/nanobanana/generate-v2 or /api/v1/nanobanana/generate-pro
    nb2Endpoint: optional(
      "NANO_BANANA_NB2_ENDPOINT",
      "/api/v1/nanobanana/generate"
    ) as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FAL.AI — Seedream, Flux Kontext, FLUX Character
// ─────────────────────────────────────────────────────────────────────────────

export interface FalEnv {
  apiKey: string;
}

export function getFalEnv(): FalEnv {
  return {
    apiKey: required("FAL_KEY"),
  };
}

// fal.ai model IDs (can be overridden via env)
// Default values are the exact upstream fal.ai endpoint strings — never Zencra aliases.
export const FAL_MODEL_IDS = {
  // Seedream (ByteDance / Dreamina, via fal.ai queue)
  // fal-ai/seedream     → Seedream v5 text-to-image (primary quality model)
  // fal-ai/seedream/edit → Seedream v5 edit / image-to-image (Lite fast+edit tier)
  // fal-ai/seedream/v4.5 → Seedream 4.5 legacy (disabled — kept for reference)
  seedreamV5:      optional("FAL_MODEL_SEEDREAM_V5",      "fal-ai/seedream") as string,
  seedreamV5Lite:  optional("FAL_MODEL_SEEDREAM_V5_LITE", "fal-ai/seedream/edit") as string,
  // Seedream 4.5 — text-to-image AND edit (image_urls[] array param distinguishes edit vs t2i).
  // Correct endpoint: fal-ai/bytedance/seedream/v4.5 (NOT fal-ai/seedream/v4.5 — that 404s).
  seedream45:      optional("FAL_MODEL_SEEDREAM_45",      "fal-ai/bytedance/seedream/v4.5") as string,
  // Same model endpoint for edit path — kept as a separate key so it can be overridden independently.
  seedream45Edit:  optional("FAL_MODEL_SEEDREAM_45_EDIT", "fal-ai/bytedance/seedream/v4.5") as string,
  // Black Forest Labs FLUX via fal.ai queue
  // FLUX.1 Kontext [pro] — production model (Image Studio + context editing)
  fluxKontext:   optional("FAL_MODEL_FLUX_KONTEXT",    "fal-ai/flux-pro/kontext") as string,
  // FLUX.1 Pro — Character Studio identity creation
  fluxCharacter: optional("FAL_MODEL_FLUX_CHARACTER",  "fal-ai/flux-pro") as string,
  // FLUX.2 — Phase 2 coming-soon. Endpoint is a placeholder; update when BFL publishes.
  // Do NOT route any live generation here until flux-2-image status === "active".
  flux2:         optional("FAL_MODEL_FLUX_2",          "fal-ai/flux-2/dev") as string,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// KLING AI
// ─────────────────────────────────────────────────────────────────────────────

export interface KlingEnv {
  apiKey: string;
  baseUrl: string;
}

export function getKlingEnv(): KlingEnv {
  return {
    apiKey:  required("KLING_API_KEY"),
    baseUrl: optional("KLING_BASE_URL", "https://api-singapore.klingai.com") as string,
  };
}

// Kling model IDs — exact upstream API model strings accepted by api.klingai.com.
// Confirmed from official Kling API capability tables (2026-04-27):
//   Kling Video 3.0 Omni  → kling-v3-omni
//   Kling Video 3.0       → kling-v3
//   Motion Control        → kling-v3 (same model; endpoint distinguishes operation)
//   Kling 2.6             → kling-v2-6
//   Kling 2.5 Turbo       → kling-v2-5-turbo  ← was incorrectly "kling-v2-5"
export const KLING_MODEL_IDS = {
  omni:          optional("KLING_MODEL_OMNI",           "kling-v3-omni")    as string,
  v30:           optional("KLING_MODEL_V30",             "kling-v3")         as string,
  motionControl: optional("KLING_MODEL_MOTION_CONTROL",  "kling-v3")         as string,
  v26:           optional("KLING_MODEL_V26",             "kling-v2-6")       as string,
  v25:           optional("KLING_MODEL_V25",             "kling-v2-5-turbo") as string,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// BYTEPLUS / SEEDANCE
// ─────────────────────────────────────────────────────────────────────────────

export interface BytePlusEnv {
  apiKey: string;
  baseUrl: string;
}

export function getBytePlusEnv(): BytePlusEnv {
  return {
    apiKey:  required("BYTEPLUS_API_KEY"),
    baseUrl: optional(
      "SEEDANCE_BASE_URL",
      "https://ark.ap-southeast.bytepluses.com/api/v3"
    ) as string,
  };
}

// Seedance model IDs — exact BytePlus ModelArk endpoint model strings.
// v20:     Seedance 2.0          → dreamina-seedance-2-0-260128
// v20Fast: Seedance 2.0 Express  → dreamina-seedance-2-0-fast-260128 (speed tier/endpoint label)
// v15:     Seedance 1.5 Pro      → MUST be set via SEEDANCE_15_MODEL_ID (no public default)
export const SEEDANCE_MODEL_IDS = {
  v20:      optional("SEEDANCE_MODEL_ID",       "dreamina-seedance-2-0-260128") as string,
  v20Fast:  optional("SEEDANCE_FAST_MODEL_ID",  "dreamina-seedance-2-0-fast-260128") as string,
  v15:      optional("SEEDANCE_15_MODEL_ID",    "") as string,  // no default — must be set explicitly
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RUNWAY ML
// ─────────────────────────────────────────────────────────────────────────────

export interface RunwayEnv {
  apiKey: string;
  baseUrl: string;
}

export function getRunwayEnv(): RunwayEnv {
  return {
    apiKey:  required("RUNWAY_API_KEY"),
    baseUrl: optional("RUNWAY_BASE_URL", "https://api.runwayml.com") as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ELEVENLABS
// ─────────────────────────────────────────────────────────────────────────────

export interface ElevenLabsEnv {
  apiKey: string;
  baseUrl: string;
}

export function getElevenLabsEnv(): ElevenLabsEnv {
  return {
    apiKey:  required("ELEVENLABS_API_KEY"),
    baseUrl: optional("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io") as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KITS AI — Phase 2
// ─────────────────────────────────────────────────────────────────────────────

export interface KitsEnv {
  apiKey: string;
  baseUrl: string;
}

export function getKitsEnv(): KitsEnv {
  return {
    apiKey:  required("KITS_API_KEY"),
    baseUrl: optional("KITS_BASE_URL", "https://arpeggi.io/api/kits/v1") as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STABILITY AI — Character refinement
// ─────────────────────────────────────────────────────────────────────────────

export interface StabilityEnv {
  apiKey: string;
  baseUrl: string;
}

export function getStabilityEnv(): StabilityEnv {
  return {
    apiKey:  required("STABILITY_API_KEY"),
    baseUrl: optional("STABILITY_BASE_URL", "https://api.stability.ai") as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UGC PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatifyEnv {
  apiKey: string;
  apiId: string;
  baseUrl: string;
}

export function getCreatifyEnv(): CreatifyEnv {
  return {
    apiKey:  required("CREATIFY_API_KEY"),
    apiId:   required("CREATIFY_API_ID"),
    baseUrl: optional("CREATIFY_BASE_URL", "https://api.creatify.ai") as string,
  };
}

export interface ArcadsEnv {
  apiKey: string;
  baseUrl: string;
}

export function getArcadsEnv(): ArcadsEnv {
  return {
    apiKey:  required("ARCADS_API_KEY"),
    baseUrl: optional("ARCADS_BASE_URL", "https://api.arcads.ai") as string,
  };
}

export interface HeyGenUGCEnv {
  apiKey: string;
  baseUrl: string;
}

export function getHeyGenUGCEnv(): HeyGenUGCEnv {
  return {
    apiKey:  required("HEYGEN_API_KEY"),
    baseUrl: optional("HEYGEN_BASE_URL", "https://api.heygen.com") as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FCS — Future Cinema Studio (LTX-2.3 via fal.ai)
//
// FCS routes through fal.ai using the shared FAL_KEY (same as Seedream / Flux).
// LTX-2.3 endpoints are synchronous: POST https://fal.run/{model} blocks and
// returns the video URL directly. No polling or webhook needed.
//
// model keys match credit_model_costs seed:
//   fcs_ltx23_director → fal-ai/ltx-video-2.3          (Cine Director, 1080p)
//   fcs_ltx23_pro      → fal-ai/ltx-video-2.3/lightning (Cine Pro,      720p)
//
// Naming rule: NEVER expose "LTX", "Lightricks", or version numbers to the UI.
// All user-facing labels are cinematic only (Cine Director / Cine Pro).
// ─────────────────────────────────────────────────────────────────────────────

export const FCS_FAL_MODEL_IDS = {
  /** Cine Director — 1080p, 8 s, 24 fps, 60 credits */
  director: optional(
    "FAL_MODEL_FCS_DIRECTOR",
    "fal-ai/ltx-video-2.3"
  ) as string,
  /** Cine Pro — 720p, 6 s, 24 fps, 45 credits */
  pro: optional(
    "FAL_MODEL_FCS_PRO",
    "fal-ai/ltx-video-2.3/lightning"
  ) as string,
} as const;

// FAL_KEY is shared — use the existing getFalEnv() for FCS.
// No separate env section needed.

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE (storage) — shared across providers
// ─────────────────────────────────────────────────────────────────────────────

export interface SupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

export function getSupabaseEnv(): SupabaseEnv {
  return {
    url:            required("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATIVE DIRECTOR — Text Intelligence Model
//
// Used by brief-parser.ts, concept-engine.ts, and brief/improve route.
// Aliased here so the model can be swapped in one place across all CD services.
// Never hardcode a model string in individual service files.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal alias for the OpenAI model used in Creative Director text tasks
 * (brief parsing, concept generation, field improvement).
 * Override via CREATIVE_DIRECTOR_TEXT_MODEL env var.
 * Default: "gpt-4o"
 */
export const CREATIVE_DIRECTOR_TEXT_MODEL: string =
  optional("CREATIVE_DIRECTOR_TEXT_MODEL", "gpt-4o") as string;
