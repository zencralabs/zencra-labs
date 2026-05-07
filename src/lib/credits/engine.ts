/**
 * src/lib/credits/engine.ts
 *
 * Zencra Centralized Pricing Engine — Phase 1
 *
 * THE SINGLE SOURCE OF TRUTH for all credit cost calculations.
 *
 * ── Sacred rule ──────────────────────────────────────────────────────────────
 *   No provider adapter, UI component, route, hook, or studio page may
 *   perform its own credit math. ALL calculations flow through
 *   calculateCreditCost(). This rule is permanent.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 *   The engine is a PURE FUNCTION. It takes explicit inputs and returns a
 *   deterministic result. It does NOT read from the database or fetch anything.
 *   Callers supply the base cost (from DB or static fallback). The engine
 *   applies quality multipliers, duration scaling, and add-ons.
 *
 *   This separation means:
 *     Frontend (Phase 1): static base cost → engine
 *     Frontend (Phase 2): pricing manifest API → engine (same function)
 *     Backend (always):   DB lookup → engine (same function)
 *
 *   The math can never drift between frontend and backend because both
 *   call the same function with the same inputs.
 *
 * ── Observe / Enforce mode ────────────────────────────────────────────────────
 *
 *   PRICING_ENGINE_MODE env var controls quality-scaled deductions:
 *
 *   observe  (default) — engine calculates quality-scaled cost + logs delta.
 *                        Caller deducts the OLD flat cost (safe direction:
 *                        user always pays the lower amount during calibration).
 *   enforce            — engine's quality-scaled cost is what is deducted.
 *                        Activate after calibration confirms multiplier accuracy.
 *
 *   Switch: set PRICING_ENGINE_MODE=enforce in Vercel env vars.
 *   Rollback: set PRICING_ENGINE_MODE=observe to revert instantly.
 *
 * ── Phase 2 readiness ─────────────────────────────────────────────────────────
 *
 *   STATIC_QUALITY_MULTIPLIERS and STATIC_ADDON_COSTS are compile-time
 *   constants today. In Phase 2, replace them with a call to
 *   /api/credits/model-costs (the pricing manifest endpoint) at app boot.
 *   The engine already accepts a `config` parameter for this — the static
 *   tables become the fallback until the manifest is loaded.
 *
 *   When Phase 2 is ready, delete STATIC_QUALITY_MULTIPLIERS and
 *   STATIC_ADDON_COSTS. The engine function signature does not change.
 *
 * ── Dimension calculation order ───────────────────────────────────────────────
 *
 *   1. Apply quality multiplier to base → qualityScaledBase
 *   2. Apply duration scaling to qualityScaledBase → durationScaled
 *      (per-minute models skip step 1 and scale base directly)
 *   3. Sum add-ons FLAT (not duration-scaled) → addonTotal
 *   4. total = durationScaled + addonTotal
 *
 * ── Future dimensions (Phase 2+ stubs) ───────────────────────────────────────
 *
 *   fps           — 24/30/60fps for video sequences
 *   frames        — FCS sequence frame count
 *   upscale       — upscaling pass add-on
 *   priorityQueue — fast queue surcharge
 *   gpuTier       — provider GPU selection
 *   characterConsistency — identity lock charge
 *
 *   All stubs return 1.0× until activated in a future migration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All dimensions that affect credit cost.
 * Add new dimensions here as Phase 2+ features are built — stubs return 1.0×.
 */
export interface PricingParams {
  /** Registry model key — e.g. "nano-banana-pro", "kling-30-omni" */
  modelKey: string;

  /**
   * Quality / resolution tier selected by the user.
   *   Image:  "1K" | "2K" | "4K"
   *   Video:  "720p" | "1080p"
   * If absent, multiplier is 1.0× (flat pricing).
   */
  quality?: string;

  /**
   * Duration in seconds.
   *   Video models: scaled by Math.ceil(seconds / 5) intervals
   *   Per-minute models (lipsync, dubbing): scaled by Math.ceil(seconds / 60)
   */
  durationSeconds?: number;

  /** Video add-ons — each is a flat charge, not duration-scaled */
  hasStartEnd?:      boolean;
  hasMotionControl?: boolean;
  hasMultiElement?:  boolean;

  // ── Phase 2+ stubs (not yet active) ────────────────────────────────────────
  // fps?:                  24 | 30 | 60;
  // frames?:               number;
  // upscale?:              boolean;
  // priorityQueue?:        boolean;
  // characterConsistency?: boolean;
}

/**
 * Full pricing result returned by calculateCreditCost().
 * breakdown keys map to line items shown in the generate button tooltip.
 */
export interface PricingResult {
  /** Final credit cost to charge (or display). Always a positive integer. */
  total: number;
  /**
   * Line-item breakdown for transparency.
   * Keys: "base", "quality_multiplier", "duration_x", "start_end_frame",
   *       "motion_control", "multi_element", "duration_minutes"
   */
  breakdown: Record<string, number>;
  currency: "credits";
  /**
   * Where the base cost came from.
   *   "static"   — compile-time MODEL_BASE_CREDITS table (Phase 1 frontend)
   *   "db"       — credit_model_costs DB lookup (backend always, Phase 1+)
   *   "manifest" — dynamic pricing manifest API (Phase 2 frontend)
   */
  source: "static" | "db" | "manifest";
}

/**
 * Optional config that overrides the built-in static tables.
 * Pass this when the caller has fetched dynamic pricing (Phase 2 manifest).
 * Omit to use STATIC_QUALITY_MULTIPLIERS and STATIC_ADDON_COSTS.
 */
export interface PricingConfig {
  /** Quality multiplier overrides keyed by modelKey, then by tier string. */
  qualityMultipliers?: Record<string, Record<string, number>>;
  /** Add-on cost overrides keyed by addon model key. */
  addonCosts?: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// OBSERVE / ENFORCE MODE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read from PRICING_ENGINE_MODE env var.
 * "observe" (default) — calculate quality-scaled cost but do not charge it yet.
 * "enforce"           — charge the quality-scaled cost.
 *
 * Only the backend (hooks.ts) reads this flag. The frontend always shows the
 * quality-scaled cost regardless of mode (it never charges directly).
 */
export function getPricingEngineMode(): "observe" | "enforce" {
  const mode = process.env.PRICING_ENGINE_MODE;
  if (mode === "enforce") return "enforce";
  return "observe"; // safe default — never accidentally enforce before calibration
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC QUALITY MULTIPLIER TABLE  (Phase 1 — replace with manifest in Phase 2)
//
// Multipliers are relative to base_credits.
// Engine applies: qualityScaledBase = Math.ceil(base × multiplier)
//
// Values calibrated against provider pricing pages (May 2026):
//   Nano Banana Pro/NB2: 1K=standard, 2K=HD surcharge, 4K=Ultra HD surcharge
//   Kling 3.0 Omni: 720p=standard, 1080p=Kuaishou Professional tier ratio
//
// To change a multiplier without a code deploy:
//   Phase 1: update credit_model_costs.quality_multipliers in DB (hooks.ts reads it)
//   Phase 2: update the pricing manifest (frontend reads it live)
// ─────────────────────────────────────────────────────────────────────────────

export const STATIC_QUALITY_MULTIPLIERS: Record<string, Record<string, number>> = {
  // ── Image quality tiers ───────────────────────────────────────────────────
  "nano-banana-pro": { "1K": 1.0, "2K": 1.25, "4K": 1.75 },

  // gpt-image-1: Phase 1B — provider-native performance tiers (Fast/Standard/Ultra).
  //   API values: "low" | "medium" | "high"  (UI labels: Fast / Standard / Ultra)
  //   Observe mode: backend charges flat base, delta logged. Frontend shows scaled cost.
  //   Edit/transform path: quality is intentionally NOT sent to /v1/images/edits —
  //   multiplier irrelevant for that path; isTransformMode reverts display to flat.
  "gpt-image-1":     { "low": 1.0, "medium": 1.25, "high": 1.75 },

  // nano-banana-2: REMOVED — Step 0 safety lock (2026-05-07)
  //   NB2 adapter ignores providerParams.quality and sends fixed ~1K dimensions
  //   from NB2_DIMENSION_MAP. Charging quality-scaled prices for 1K output would
  //   overcharge users and violate the "displayed cost = real provider execution" rule.
  //   Restore this entry ONLY after confirming NB2 API accepts higher-res width/height.
  //   Research gate tracked in: docs/audits/image-studio-final-architecture-plan-2026-05-07.md §1A-R1

  // seedream-4-5: Phase 1C — native resolution tiers (2K Standard / 4K Ultra chips).
  //   API values: "1K" | "2K" | "4K"  (map to fal.ai image_size: omit / auto_2K / auto_4K)
  //   Base: 10 cr (1K default). 2K=1.25×→13cr, 4K=1.75×→18cr.
  //   Edit mode does NOT add a surcharge — same multiplier applies.
  "seedream-4-5":    { "1K": 1.0, "2K": 1.25, "4K": 1.75 },

  // ── Video resolution tiers ─────────────────────────────────────────────────
  "kling-30-omni":   { "720p": 1.0, "1080p": 1.5 },

  // All other models: no quality_multipliers entry → 1.0× flat pricing.
  // Add new entries here when a provider exposes quality-differentiated billing.
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC ADD-ON COSTS  (Phase 1 — mirrors credit_model_costs addon rows)
//
// These are FLAT charges added after duration scaling.
// To change an add-on cost without a code deploy, update credit_model_costs
// in Supabase. hooks.ts reads add-on costs from the DB. This static table
// is only used by the frontend display path.
// ─────────────────────────────────────────────────────────────────────────────

export const STATIC_ADDON_COSTS: Record<string, number> = {
  "addon-start-end":      80,
  "addon-motion-control": 120,
  "addon-multi-element":  50,
};

// ─────────────────────────────────────────────────────────────────────────────
// MODEL CLASSIFICATION SETS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-minute billing models.
 * base_credits stores the per-MINUTE rate.
 * Duration cost = base × Math.ceil(durationSeconds / 60), min 1 minute.
 * Quality multiplier is NOT applied — per-minute billing is already duration-aware.
 */
export const PER_MINUTE_MODELS = new Set([
  "dubbing",
  "voice-isolation",
  "sync-lipsync-v3",
]);

/**
 * Video duration-scaled models.
 * base_credits stores the 5-second cost.
 * Duration cost = qualityScaledBase × Math.ceil(durationSeconds / 5).
 */
export const VIDEO_DURATION_MODELS = new Set([
  "kling-30",
  "kling-30-omni",
  "kling-26",
  "kling-25",
  "seedance-20-fast",
  "seedance-20",
  "seedance-15",
]);

// ─────────────────────────────────────────────────────────────────────────────
// CORE ENGINE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * calculateCreditCost — the ONLY place credit math happens in Zencra.
 *
 * @param baseCost  Base credit cost for the model (from DB or static table).
 *                  Must be >= 1. If 0 or negative, returns total=0.
 * @param params    All generation parameters that affect cost.
 * @param config    Optional dynamic pricing config (Phase 2 manifest).
 *                  Omit to use built-in static tables.
 * @param source    Where baseCost came from — for observability and audit.
 *
 * Returns a PricingResult with total credits and itemised breakdown.
 *
 * ── Do NOT call this with hardcoded baseCost values. ─────────────────────────
 *   Always pass the value read from MODEL_BASE_CREDITS or the DB.
 *   The engine applies multipliers — do not pre-multiply before calling.
 */
export function calculateCreditCost(
  baseCost: number,
  params:   PricingParams,
  config?:  PricingConfig,
  source:   PricingResult["source"] = "static",
): PricingResult {
  // Guard: zero or invalid base cost → zero total (e.g. skipCredits path)
  if (!baseCost || baseCost <= 0) {
    return { total: 0, breakdown: { base: 0 }, currency: "credits", source };
  }

  const breakdown: Record<string, number> = {};
  const { modelKey, quality, durationSeconds } = params;

  // ── Per-minute billing (lipsync, dubbing) ─────────────────────────────────
  // These models do NOT use quality multipliers — duration is already the
  // primary cost driver, and per-minute rate is fixed in base_credits.
  if (PER_MINUTE_MODELS.has(modelKey)) {
    const minutes = durationSeconds ? Math.ceil(durationSeconds / 60) : 1;
    const total   = baseCost * minutes;
    breakdown.base             = baseCost;
    breakdown.duration_minutes = minutes;
    return { total, breakdown, currency: "credits", source };
  }

  // ── Step 1: Quality multiplier ────────────────────────────────────────────
  // Resolve multiplier from config (Phase 2) → static table → 1.0 (flat).
  const multiplierMap =
    config?.qualityMultipliers?.[modelKey] ??
    STATIC_QUALITY_MULTIPLIERS[modelKey];

  const qualityMultiplier =
    quality && multiplierMap
      ? (multiplierMap[quality] ?? 1.0)
      : 1.0;

  const qualityScaledBase = Math.ceil(baseCost * qualityMultiplier);
  breakdown.base = qualityScaledBase;

  if (qualityMultiplier !== 1.0) {
    // Store the multiplier for the breakdown tooltip (e.g. "×1.75 (4K)")
    breakdown.quality_multiplier = qualityMultiplier;
  }

  // ── Step 2: Duration scaling ──────────────────────────────────────────────
  let durationScaled = qualityScaledBase;

  if (VIDEO_DURATION_MODELS.has(modelKey) && durationSeconds && durationSeconds > 0) {
    const intervals = Math.ceil(durationSeconds / 5);
    durationScaled  = qualityScaledBase * intervals;
    if (intervals > 1) {
      breakdown.duration_x = intervals;
    }
  }

  // ── Step 3: Add-ons (flat, not duration-scaled) ───────────────────────────
  // Add-on costs come from config (Phase 2 / DB), falling back to static.
  const addonCosts = config?.addonCosts ?? STATIC_ADDON_COSTS;
  let addonTotal   = 0;

  if (params.hasStartEnd) {
    const cost = addonCosts["addon-start-end"] ?? 0;
    if (cost > 0) { addonTotal += cost; breakdown.start_end_frame = cost; }
  }
  if (params.hasMotionControl) {
    const cost = addonCosts["addon-motion-control"] ?? 0;
    if (cost > 0) { addonTotal += cost; breakdown.motion_control = cost; }
  }
  if (params.hasMultiElement) {
    const cost = addonCosts["addon-multi-element"] ?? 0;
    if (cost > 0) { addonTotal += cost; breakdown.multi_element = cost; }
  }

  // ── Phase 2+ stubs ─────────────────────────────────────────────────────────
  // fps, frames, upscale, priorityQueue, characterConsistency
  // All return 1.0× until activated. Add billing logic here when needed.

  // ── Final total ────────────────────────────────────────────────────────────
  const total = durationScaled + addonTotal;
  return { total, breakdown, currency: "credits", source };
}

// ─────────────────────────────────────────────────────────────────────────────
// OBSERVE MODE LOGGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log the delta between the old flat cost and the new quality-scaled cost.
 * Called by hooks.ts during the observe window.
 *
 * When old !== new:
 *   - Logs the delta at WARN level so it appears in Vercel function logs
 *   - Does NOT alert to Discord (noise during calibration)
 *   - Caller deducts OLD cost (safe direction — user pays lower amount)
 *
 * After the observe window, set PRICING_ENGINE_MODE=enforce to activate
 * quality-scaled deductions.
 */
export function logPricingDelta(opts: {
  modelKey:       string;
  quality?:       string;
  durationSeconds?: number;
  oldCost:        number;
  newCost:        number;
  userId:         string;
  jobId:          string;
}): void {
  const { modelKey, quality, durationSeconds, oldCost, newCost, userId, jobId } = opts;
  if (oldCost === newCost) return; // no delta — no noise

  const deltaSign = newCost > oldCost ? "+" : "";
  console.warn(
    `[pricing-engine][observe] model=${modelKey}` +
    ` quality=${quality ?? "none"}` +
    (durationSeconds ? ` duration=${durationSeconds}s` : "") +
    ` old=${oldCost}cr new=${newCost}cr delta=${deltaSign}${newCost - oldCost}cr` +
    ` user=${userId} job=${jobId}` +
    ` → charging OLD flat cost (observe mode)`
  );
}
