/**
 * src/lib/studio/image-model-config.ts
 *
 * Shared image model dock configuration — single source of truth.
 *
 * Consumed by:
 *   - Image Studio     (src/app/studio/image/page.tsx)
 *   - Creative Director v2 (src/components/studio/creative-director-v2/PromptDock.tsx)
 *
 * Keys are CANONICAL MODEL KEYS — the same strings used in:
 *   MODEL_BASE_CREDITS, MODEL_CAPABILITIES, credit_model_costs.model_key.
 *
 * Image Studio maps its legacy UI ID "dalle3" → "gpt-image-1" via MODEL_TO_KEY
 * before looking up config here. Creative Director uses selectedModel directly
 * (already canonical keys).
 *
 * ─── PROVIDER LEAKAGE RULE ────────────────────────────────────────────────────
 * Labels are Zencra semantic vocabulary only (Fast / Cinematic / Standard / Ultra).
 * apiValues are the strings sent through the orchestration layer.
 * For gpt-image-1 specifically, apiValues are "low" | "medium" | "high" because
 * those are passed directly to the OpenAI API — but they are NEVER shown in UI labels.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AspectRatio =
  | "Auto"
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:5"
  | "5:4"
  | "3:4"
  | "4:3"
  | "2:3"
  | "3:2"
  | "21:9"
  | "8:1";

export type ResolutionQuality = "1K" | "2K" | "4K";

/**
 * A selectable quality tier for a model.
 *
 * gpt-image-2:  apiValue = "fast" | "cinematic"
 * gpt-image-1:  apiValue = "low" | "medium" | "high"  (OpenAI legacy; never shown in label)
 * seedream-4-5: apiValue = "2K" | "4K"                (resolution-as-quality)
 *
 * creditMultiplier is informational only — the engine reads from DB quality_multipliers.
 */
export interface QualityOption {
  label:            string;
  apiValue:         string;
  creditMultiplier: number;
  desc?:            string;
  isDefault?:       boolean;
}

export type QualityDisplayMode = "segmented" | "chips";

export interface ModelDockConfig {
  /** User-facing name — should match getDisplayModelName() output */
  name:               string;
  /** Whether the model is live for generation */
  available:          boolean;
  /** "Coming soon" — shown in picker, blocks selection */
  soon?:              boolean;
  /**
   * Performance-tier quality options.
   * Present on: gpt-image-2, gpt-image-1, seedream-4-5.
   * Mutually exclusive with allowedQualities.
   */
  qualityOptions?:    QualityOption[];
  /** How to render qualityOptions: segmented inline toggle or chips */
  qualityDisplayMode?: QualityDisplayMode;
  /**
   * Resolution-tier quality options (legacy NB / Seedream v5 pattern).
   * Present on: nano-banana-*, seedream-v5, flux models.
   * Mutually exclusive with qualityOptions.
   */
  allowedQualities?:  ResolutionQuality[];
  /** Ordered AR list for the dock AR picker. "Auto" → omit aspectRatio from payload. */
  aspectRatios:       AspectRatio[];
  /**
   * True for async job-based providers (NB family) and transform-only models (flux-kontext).
   * When true: count selector shows 2×/4× as disabled, not hidden.
   * Keep in sync with backend generate route clamp.
   */
  batchLocked:        boolean;
}

// ── Per-model configuration ───────────────────────────────────────────────────

export const IMAGE_MODEL_CONFIGS: Record<string, ModelDockConfig> = {

  // ── GPT Image ────────────────────────────────────────────────────────────────

  "gpt-image-2": {
    name:      "GPT Image 2",
    available: true,
    qualityOptions: [
      { label: "Fast",      apiValue: "fast",      creditMultiplier: 1.0,   desc: "Quick generation",  },
      { label: "Cinematic", apiValue: "cinematic", creditMultiplier: 3.667, desc: "Premium quality", isDefault: true },
    ],
    qualityDisplayMode: "segmented",
    // 10-ratio set: gpt-image-2 API enforces ≤ 3:1 aspect — extreme ARs excluded.
    aspectRatios: ["1:1", "16:9", "9:16", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "21:9"],
    batchLocked: false,
  },

  "gpt-image-1": {
    name:      "GPT Image 1.5",
    available: true,
    // apiValues are OpenAI quality strings (low/medium/high) — not shown to users.
    // Labels use Zencra vocabulary: Fast / Standard / Ultra.
    qualityOptions: [
      { label: "Fast",     apiValue: "low",    creditMultiplier: 1.0,  desc: "Faster"   },
      { label: "Standard", apiValue: "medium", creditMultiplier: 1.25, desc: "Balanced" },
      { label: "Ultra",    apiValue: "high",   creditMultiplier: 1.75, desc: "Highest"  },
    ],
    qualityDisplayMode: "segmented",
    // Collapsed 4-ratio set: gpt-image-1 maps all landscape/portrait internally.
    aspectRatios: ["1:1", "16:9", "9:16", "4:5"],
    batchLocked: false,
  },

  // ── Nano Banana ──────────────────────────────────────────────────────────────

  "nano-banana-2": {
    name:             "Nano Banana 2",
    available:        true,
    // Step 0 safety lock: NB2 adapter ignores quality and sends fixed ~1K dimensions.
    // Restore ["1K","2K","4K"] only after API research confirms higher-res support.
    allowedQualities: ["1K"],
    // 7-ratio set confirmed in playground. "Auto" → no AR sent → NB2 server default.
    aspectRatios: ["Auto", "1:1", "4:5", "5:4", "9:16", "16:9", "8:1"],
    batchLocked:  true,  // async job API: 1 job = 1 image
  },

  "nano-banana-pro": {
    name:             "Nano Banana Pro",
    available:        true,
    allowedQualities: ["1K", "2K", "4K"],
    // "Auto" → omit aspectRatio → model picks dimensions.
    aspectRatios: ["Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "21:9"],
    batchLocked:  true,
  },

  "nano-banana-standard": {
    name:             "Nano Banana",
    available:        true,
    allowedQualities: ["1K"],
    // 10 concrete options, no Auto.
    aspectRatios: ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "21:9"],
    batchLocked:  true,
  },

  // ── Seedream ─────────────────────────────────────────────────────────────────

  "seedream-v5": {
    name:             "Seedream v5 Lite",
    available:        true,
    allowedQualities: ["1K"],
    aspectRatios:     ["1:1", "16:9", "9:16", "4:5"],
    batchLocked:      false,
  },

  "seedream-4-5": {
    name:      "Seedream 4.5",
    available: true,
    // apiValues are resolution strings → seedream.ts maps to fal.ai image_size.
    qualityOptions: [
      { label: "2K Standard", apiValue: "2K", creditMultiplier: 1.25, desc: "auto_2K · balanced" },
      { label: "4K Ultra",    apiValue: "4K", creditMultiplier: 1.75, desc: "auto_4K · highest"  },
    ],
    qualityDisplayMode: "chips",
    aspectRatios:       ["1:1", "16:9", "9:16", "4:5"],
    batchLocked:        false,
  },

  // ── Flux ─────────────────────────────────────────────────────────────────────

  "flux-kontext": {
    // Shown in CD as "Flux.2 Flex". Transform/edit model — batching not meaningful.
    name:             "Flux.2 Flex",
    available:        true,
    allowedQualities: ["1K"],
    aspectRatios:     ["1:1", "16:9", "9:16", "4:5"],
    batchLocked:      true,
  },

  "flux-2-image": {
    // Shown in CD as "Flux.2 Pro"
    name:             "Flux.2 Pro",
    available:        false,
    soon:             true,
    allowedQualities: ["1K"],
    aspectRatios:     ["1:1", "16:9", "9:16", "4:5"],
    batchLocked:      true,
  },

  "flux-2-max": {
    // Shown in CD as "Flux.2 Max"
    name:             "Flux.2 Max",
    available:        false,
    soon:             true,
    allowedQualities: ["1K"],
    aspectRatios:     ["1:1", "16:9", "9:16", "4:5"],
    batchLocked:      true,
  },
};

// ── Derived exports ───────────────────────────────────────────────────────────

/**
 * Set of model keys that cannot produce more than 1 image per generation.
 * Async job-based providers (NB family) and transform-only models (flux-kontext).
 *
 * Previously defined inline in image/page.tsx — now derived from batchLocked.
 * Keep in sync with backend generate route clamp.
 */
export const BATCH_LOCKED_MODEL_KEYS: ReadonlySet<string> = new Set(
  Object.entries(IMAGE_MODEL_CONFIGS)
    .filter(([, cfg]) => cfg.batchLocked)
    .map(([key]) => key)
);

// ── Safe accessors ─────────────────────────────────────────────────────────────

/** Returns config for a model key, or null if not found. */
export function getModelDockConfig(modelKey: string): ModelDockConfig | null {
  return IMAGE_MODEL_CONFIGS[modelKey] ?? null;
}

/**
 * Default quality apiValue for a model.
 *   qualityOptions models → option with isDefault:true, or first option.
 *   allowedQualities models → first resolution tier (lowest cost).
 *   null → model has no quality concept.
 */
export function getDefaultQuality(modelKey: string): string | null {
  const cfg = IMAGE_MODEL_CONFIGS[modelKey];
  if (!cfg) return null;
  if (cfg.qualityOptions) {
    const def = cfg.qualityOptions.find((q) => q.isDefault) ?? cfg.qualityOptions[0];
    return def?.apiValue ?? null;
  }
  if (cfg.allowedQualities) return cfg.allowedQualities[0] ?? null;
  return null;
}

/**
 * Default aspect ratio for a model.
 * Skips "Auto" — returns the first concrete ratio.
 */
export function getDefaultAspectRatio(modelKey: string): string {
  const cfg = IMAGE_MODEL_CONFIGS[modelKey];
  if (!cfg) return "1:1";
  const first = cfg.aspectRatios[0];
  return first === "Auto" ? (cfg.aspectRatios[1] ?? "1:1") : first;
}

/**
 * Maximum batch count for a model.
 * Returns 1 for batch-locked models, 4 for all others.
 * UI count pickers should clamp to this — batch-locked options show as disabled.
 */
export function getMaxBatchCount(modelKey: string): 1 | 4 {
  return IMAGE_MODEL_CONFIGS[modelKey]?.batchLocked ? 1 : 4;
}
