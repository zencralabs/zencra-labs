/**
 * model-costs.ts — Single source of truth for UI credit display
 *
 * This module mirrors the `credit_model_costs` DB table so the frontend
 * can show the exact same credit amount the backend will charge — with
 * ZERO async calls required at render time.
 *
 * ── Rules ────────────────────────────────────────────────────────────────────
 *  1. Every value here MUST match credit_model_costs.base_credits in the DB.
 *  2. When the DB is updated, this file MUST be updated in the same commit.
 *  3. The backend hooks.ts reads from the DB (authoritative).
 *     This file is the frontend read-cache of the same values.
 *  4. Duration scaling uses the same formula as hooks.ts:
 *       multiplier = Math.ceil(durationSeconds / 5)
 *       5s → 1×, 10s → 2×
 *
 * ── Locked costs (mirrors credit_model_costs) ────────────────────────────────
 *
 * Image models:
 *   nano-banana-standard  8 cr
 *   nano-banana-pro      12 cr
 *   nano-banana-2        10 cr
 *   gpt-image-1          15 cr
 *   gpt-image-2          20 cr
 *   seedream-v5          15 cr
 *   seedream-v5-lite      8 cr
 *   flux-kontext         10 cr
 *
 * Video models (base = 5s cost; 10s = 2×base):
 *   kling-30            320 cr  (5s = 320, 10s = 640)
 *   kling-30-omni       420 cr  (5s = 420, 10s = 840)
 *   kling-26            190 cr  (5s = 190, 10s = 380)
 *   kling-25            150 cr  (5s = 150, 10s = 300)
 *   seedance-20-fast    120 cr  (5s = 120, 10s = 240)
 *   seedance-20         160 cr  (5s = 160, 10s = 320)
 *   seedance-15         100 cr  (5s = 100, 10s = 200)
 *
 * Video add-ons (flat, not duration-scaled):
 *   addon-start-end      80 cr  (both start+end frame supplied)
 *   addon-motion-control 120 cr
 *   addon-multi-element   50 cr
 *
 * Audio models:
 *   elevenlabs            8 cr
 *   elevenlabs-premium   12 cr
 *
 * Lip Sync:
 *   sync-lipsync-v3      90 cr  (per-minute: billed as Math.ceil(seconds/60) minutes)
 *
 * FCS:
 *   fcs_ltx23_pro       350 cr
 *   fcs_ltx23_director  600 cr
 */

// ── Base cost table — mirrors DB credit_model_costs.base_credits ──────────────
export const MODEL_BASE_CREDITS: Record<string, number> = {
  // ── Image
  "nano-banana-standard":  8,
  "nano-banana-pro":      12,
  "nano-banana-2":        10,
  "gpt-image-1":          15,
  "gpt-image-2":          20,
  "seedream-v5":          15,
  "seedream-v5-lite":      8,
  "flux-kontext":         10,

  // ── Video (base = 5-second cost)
  "kling-30":            320,
  "kling-30-omni":       420,
  "kling-26":            190,
  "kling-25":            150,
  "seedance-20-fast":    120,
  "seedance-20":         160,
  "seedance-15":         100,

  // ── Video add-ons (flat, not duration-scaled)
  "addon-start-end":      80,
  "addon-motion-control": 120,
  "addon-multi-element":  50,

  // ── Audio
  "elevenlabs":           8,
  "elevenlabs-premium":  12,

  // ── Lip Sync (per-minute rate)
  "sync-lipsync-v3":     90,

  // ── FCS
  "fcs_ltx23_pro":       350,
  "fcs_ltx23_director":  600,
};

// ── Models that bill per-minute (same list as hooks.ts) ───────────────────────
const PER_MINUTE_MODELS = new Set(["dubbing", "voice-isolation", "sync-lipsync-v3"]);

// ── Video studio model keys (receive duration scaling) ────────────────────────
const VIDEO_MODEL_KEYS = new Set([
  "kling-30", "kling-30-omni", "kling-26", "kling-25",
  "seedance-20-fast", "seedance-20", "seedance-15",
]);

export interface CreditCostOptions {
  /**
   * Duration in seconds — required for video and per-minute models.
   * Video: multiplier = Math.ceil(durationSeconds / 5)
   * Per-minute: multiplier = Math.ceil(durationSeconds / 60), min 1 minute
   */
  durationSeconds?: number;
  /** True when both start + end frame are supplied (adds addon-start-end cost). */
  hasStartEnd?: boolean;
  /** True when a motion control preset is active (adds addon-motion-control cost). */
  hasMotionControl?: boolean;
  /** True when multi-element mode is active (adds addon-multi-element cost). */
  hasMultiElement?: boolean;
}

/**
 * getGenerationCreditCost — compute the exact credit cost the backend will charge.
 *
 * Use this EVERYWHERE a generate button displays a credit count.
 * Do NOT use hardcoded numbers or studio-specific helper functions.
 *
 * Returns the total credit cost as a whole number, or null if the model
 * is not found in the cost table (caller should show "—" or fetch from server).
 */
export function getGenerationCreditCost(
  modelKey: string,
  opts: CreditCostOptions = {}
): number | null {
  const base = MODEL_BASE_CREDITS[modelKey];
  if (base === undefined) return null;

  const { durationSeconds, hasStartEnd, hasMotionControl, hasMultiElement } = opts;

  // ── Per-minute billing ────────────────────────────────────────────────────
  if (PER_MINUTE_MODELS.has(modelKey)) {
    const minutes = durationSeconds ? Math.ceil(durationSeconds / 60) : 1;
    return base * minutes;
  }

  // ── Video duration scaling (5-second intervals) ───────────────────────────
  let scaledBase = base;
  if (VIDEO_MODEL_KEYS.has(modelKey) && durationSeconds && durationSeconds > 0) {
    const intervals = Math.ceil(durationSeconds / 5);
    scaledBase = base * intervals;
  }

  // ── Add-on summing ────────────────────────────────────────────────────────
  let addons = 0;
  if (hasStartEnd)      addons += MODEL_BASE_CREDITS["addon-start-end"]      ?? 0;
  if (hasMotionControl) addons += MODEL_BASE_CREDITS["addon-motion-control"]  ?? 0;
  if (hasMultiElement)  addons += MODEL_BASE_CREDITS["addon-multi-element"]   ?? 0;

  return scaledBase + addons;
}

/**
 * formatCreditCost — format cost for display in generate buttons.
 *
 * Usage:  formatCreditCost(12)  →  "12 cr"
 *         formatCreditCost(null) →  "— cr"
 */
export function formatCreditCost(cost: number | null): string {
  return cost !== null ? `${cost} cr` : "— cr";
}
