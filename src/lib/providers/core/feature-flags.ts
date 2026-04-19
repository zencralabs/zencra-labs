/**
 * Zencra Feature Flags
 *
 * Phase gates and coming-soon toggles for the provider system.
 * All studio routing and provider dispatch logic checks these flags
 * before calling any provider.
 *
 * Runtime sources (in priority order):
 *   1. ZENCRA_FLAGS_* environment variables (per-flag overrides)
 *   2. Phase defaults (hardcoded per the master build order)
 *
 * Flag naming convention:  ZENCRA_FLAG_{STUDIO}_{KEY}
 * e.g.  ZENCRA_FLAG_FCS_ENABLED=true
 */

import type { ProviderFamily, StudioType } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// FLAG DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface FeatureFlags {
  // ── Studio-level gates ─────────────────────────────────────────────────────
  imageStudioEnabled:      boolean;
  videoStudioEnabled:      boolean;
  audioStudioEnabled:      boolean;
  characterStudioEnabled:  boolean;   // backend ready; UI not yet built
  ugcStudioEnabled:        boolean;   // backend ready; UI not yet built
  fcsEnabled:              boolean;   // Future Cinema Studio — default false

  // ── Phase 1 image providers ────────────────────────────────────────────────
  gptImageEnabled:         boolean;   // replaces dalle
  nanoBananaEnabled:       boolean;
  seedreamEnabled:         boolean;
  fluxKontextEnabled:      boolean;

  // ── Phase 1 video providers ────────────────────────────────────────────────
  kling30OmniEnabled:      boolean;
  kling30Enabled:          boolean;
  klingMotionControlEnabled: boolean;
  seedance20Enabled:       boolean;
  seedance20FastEnabled:   boolean;
  seedance15Enabled:       boolean;

  // ── Phase 1 audio providers ────────────────────────────────────────────────
  elevenLabsEnabled:       boolean;

  // ── Phase 2 gates (all false until Phase 2 launch) ────────────────────────
  phase2ImageEnabled:      boolean;
  phase2VideoEnabled:      boolean;
  kitsEnabled:             boolean;   // Phase 2 audio

  // ── Character Studio provider gates ───────────────────────────────────────
  fluxCharacterEnabled:    boolean;
  stabilityEnabled:        boolean;
  motionAbstractionEnabled: boolean;

  // ── UGC provider gates ─────────────────────────────────────────────────────
  creatifyEnabled:         boolean;
  arcadsEnabled:           boolean;
  heygenUgcEnabled:        boolean;

  // ── Debug ──────────────────────────────────────────────────────────────────
  dryRunMode:              boolean;   // skips actual API calls; for local dev
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 1 defaults.
 * Phase 2 providers are false by default — they appear as coming-soon in UI
 * but cannot be invoked through the orchestrator.
 */
const PHASE1_DEFAULTS: FeatureFlags = {
  // Studios
  imageStudioEnabled:       true,
  videoStudioEnabled:       true,
  audioStudioEnabled:       true,
  characterStudioEnabled:   false,   // backend ready; UI to be built
  ugcStudioEnabled:         false,   // backend ready; UI to be built
  fcsEnabled:               false,   // controlled separately via profiles.fcs_enabled

  // Image Phase 1
  gptImageEnabled:          true,
  nanoBananaEnabled:        true,
  seedreamEnabled:          true,
  fluxKontextEnabled:       true,

  // Video Phase 1
  kling30OmniEnabled:       true,
  kling30Enabled:           true,
  klingMotionControlEnabled: true,
  seedance20Enabled:        true,
  seedance20FastEnabled:    true,
  seedance15Enabled:        true,

  // Audio Phase 1
  elevenLabsEnabled:        true,

  // Phase 2 (all false)
  phase2ImageEnabled:       false,
  phase2VideoEnabled:       false,
  kitsEnabled:              false,

  // Character (backend ready, all false until UI built)
  fluxCharacterEnabled:     false,
  stabilityEnabled:         false,
  motionAbstractionEnabled: false,

  // UGC (backend ready, all false until UI built)
  creatifyEnabled:          false,
  arcadsEnabled:            false,
  heygenUgcEnabled:         false,

  // Debug
  dryRunMode:               false,
};

// ─────────────────────────────────────────────────────────────────────────────
// ENV OVERRIDE LOADING
// ─────────────────────────────────────────────────────────────────────────────

function envBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.toLowerCase() === "true" || val === "1";
}

/** Resolve all feature flags, applying env overrides on top of phase defaults. */
export function resolveFlags(): FeatureFlags {
  return {
    imageStudioEnabled:        envBool("ZENCRA_FLAG_IMAGE_STUDIO",           PHASE1_DEFAULTS.imageStudioEnabled),
    videoStudioEnabled:        envBool("ZENCRA_FLAG_VIDEO_STUDIO",           PHASE1_DEFAULTS.videoStudioEnabled),
    audioStudioEnabled:        envBool("ZENCRA_FLAG_AUDIO_STUDIO",           PHASE1_DEFAULTS.audioStudioEnabled),
    characterStudioEnabled:    envBool("ZENCRA_FLAG_CHARACTER_STUDIO",       PHASE1_DEFAULTS.characterStudioEnabled),
    ugcStudioEnabled:          envBool("ZENCRA_FLAG_UGC_STUDIO",             PHASE1_DEFAULTS.ugcStudioEnabled),
    fcsEnabled:                envBool("ZENCRA_FLAG_FCS_ENABLED",            PHASE1_DEFAULTS.fcsEnabled),

    gptImageEnabled:           envBool("ZENCRA_FLAG_GPT_IMAGE",              PHASE1_DEFAULTS.gptImageEnabled),
    nanoBananaEnabled:         envBool("ZENCRA_FLAG_NANO_BANANA",            PHASE1_DEFAULTS.nanoBananaEnabled),
    seedreamEnabled:           envBool("ZENCRA_FLAG_SEEDREAM",               PHASE1_DEFAULTS.seedreamEnabled),
    fluxKontextEnabled:        envBool("ZENCRA_FLAG_FLUX_KONTEXT",           PHASE1_DEFAULTS.fluxKontextEnabled),

    kling30OmniEnabled:        envBool("ZENCRA_FLAG_KLING_30_OMNI",         PHASE1_DEFAULTS.kling30OmniEnabled),
    kling30Enabled:            envBool("ZENCRA_FLAG_KLING_30",               PHASE1_DEFAULTS.kling30Enabled),
    klingMotionControlEnabled: envBool("ZENCRA_FLAG_KLING_MOTION_CONTROL",  PHASE1_DEFAULTS.klingMotionControlEnabled),
    seedance20Enabled:         envBool("ZENCRA_FLAG_SEEDANCE_20",            PHASE1_DEFAULTS.seedance20Enabled),
    seedance20FastEnabled:     envBool("ZENCRA_FLAG_SEEDANCE_20_FAST",       PHASE1_DEFAULTS.seedance20FastEnabled),
    seedance15Enabled:         envBool("ZENCRA_FLAG_SEEDANCE_15",            PHASE1_DEFAULTS.seedance15Enabled),

    elevenLabsEnabled:         envBool("ZENCRA_FLAG_ELEVENLABS",             PHASE1_DEFAULTS.elevenLabsEnabled),

    phase2ImageEnabled:        envBool("ZENCRA_FLAG_PHASE2_IMAGE",           PHASE1_DEFAULTS.phase2ImageEnabled),
    phase2VideoEnabled:        envBool("ZENCRA_FLAG_PHASE2_VIDEO",           PHASE1_DEFAULTS.phase2VideoEnabled),
    kitsEnabled:               envBool("ZENCRA_FLAG_KITS",                   PHASE1_DEFAULTS.kitsEnabled),

    fluxCharacterEnabled:      envBool("ZENCRA_FLAG_FLUX_CHARACTER",         PHASE1_DEFAULTS.fluxCharacterEnabled),
    stabilityEnabled:          envBool("ZENCRA_FLAG_STABILITY",              PHASE1_DEFAULTS.stabilityEnabled),
    motionAbstractionEnabled:  envBool("ZENCRA_FLAG_MOTION_ABSTRACTION",     PHASE1_DEFAULTS.motionAbstractionEnabled),

    creatifyEnabled:           envBool("ZENCRA_FLAG_CREATIFY",               PHASE1_DEFAULTS.creatifyEnabled),
    arcadsEnabled:             envBool("ZENCRA_FLAG_ARCADS",                 PHASE1_DEFAULTS.arcadsEnabled),
    heygenUgcEnabled:          envBool("ZENCRA_FLAG_HEYGEN_UGC",             PHASE1_DEFAULTS.heygenUgcEnabled),

    dryRunMode:                envBool("ZENCRA_DRY_RUN",                     PHASE1_DEFAULTS.dryRunMode),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Check if a studio is enabled. */
export function isStudioEnabled(studio: StudioType): boolean {
  const flags = resolveFlags();
  switch (studio) {
    case "image":     return flags.imageStudioEnabled;
    case "video":     return flags.videoStudioEnabled;
    case "audio":     return flags.audioStudioEnabled;
    case "character": return flags.characterStudioEnabled;
    case "ugc":       return flags.ugcStudioEnabled;
    case "fcs":       return flags.fcsEnabled;
    default:          return false;
  }
}

/** Check if a specific provider family is enabled. */
export function isProviderEnabled(provider: ProviderFamily): boolean {
  const flags = resolveFlags();
  switch (provider) {
    case "openai":          return flags.gptImageEnabled;
    case "nano-banana":     return flags.nanoBananaEnabled;
    case "fal":             return flags.seedreamEnabled && flags.fluxKontextEnabled;
    case "kling":           return flags.kling30Enabled || flags.kling30OmniEnabled || flags.klingMotionControlEnabled;
    case "byteplus":        return flags.seedance20Enabled || flags.seedance20FastEnabled || flags.seedance15Enabled;
    case "runway":          return false;  // Phase 1: coming-soon
    case "elevenlabs":      return flags.elevenLabsEnabled;
    case "kits":            return flags.kitsEnabled;
    case "flux-bfl":        return flags.fluxCharacterEnabled;
    case "stability":       return flags.stabilityEnabled;
    case "creatify":        return flags.creatifyEnabled;
    case "arcads":          return flags.arcadsEnabled;
    case "heygen-ugc":      return flags.heygenUgcEnabled;
    case "heygen-video":    return false;  // Phase 2
    case "ltx":             return flags.fcsEnabled;
    case "motion-abstract": return flags.motionAbstractionEnabled;
    default:                return false;
  }
}

/** Is dry-run mode active? If true, providers should not make live API calls. */
export function isDryRun(): boolean {
  return resolveFlags().dryRunMode;
}
