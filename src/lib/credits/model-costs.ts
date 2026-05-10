/**
 * model-costs.ts — Frontend credit display layer
 *
 * This module provides `getGenerationCreditCost()` — the ONLY function
 * UI components should call to show credit costs in generate buttons.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 *   This module is a THIN WRAPPER over calculateCreditCost() from engine.ts.
 *   It supplies the static base cost (from MODEL_BASE_CREDITS) and forwards
 *   all pricing parameters to the engine. The engine owns all math.
 *
 *   Frontend display path:
 *     getGenerationCreditCost(modelKey, opts)
 *       → looks up MODEL_BASE_CREDITS[modelKey]    ← Phase 1 static fallback
 *       → calls calculateCreditCost(base, params)  ← engine does all math
 *       → returns total
 *
 *   Phase 2 upgrade path (no function signature changes):
 *     Replace MODEL_BASE_CREDITS lookup with a fetch from the pricing manifest
 *     endpoint (/api/credits/model-costs). The engine call below does NOT change.
 *     When manifest is live, delete MODEL_BASE_CREDITS entirely.
 *
 * ── Rules ────────────────────────────────────────────────────────────────────
 *  1. Every value in MODEL_BASE_CREDITS MUST match credit_model_costs.base_credits in DB.
 *  2. When the DB is updated, this file MUST be updated in the same commit.
 *  3. The backend hooks.ts reads from the DB (authoritative).
 *     This file is the frontend read-cache of the same base values.
 *  4. Do NOT perform credit math here. The engine owns all calculations.
 *
 * ── Locked costs (mirrors credit_model_costs.base_credits) ──────────────────
 *
 * Image models:
 *   nano-banana-standard  8 cr   (no quality tiers — flat)
 *   nano-banana-pro      12 cr   (1K base; engine applies 2K=1.25×, 4K=1.75×)
 *   nano-banana-2        10 cr   (1K base; engine applies 2K=1.25×, 4K=1.75×)
 *   gpt-image-1          15 cr   (Fast base; Standard=1.25×→19cr, Ultra=1.75×→27cr via engine)
 *   gpt-image-2          15 cr   (Fast base; cinematic=3.667×→55cr default, ultra=12.0×→180cr hidden)
 *   seedream-v5          15 cr
 *   seedream-v5-lite      8 cr   (internal; not exposed in UI)
 *   seedream-4-5         10 cr   (1K base; engine applies 2K=1.25×→13cr, 4K=1.75×→18cr)
 *   flux-kontext         10 cr   (fal-hosted; Image Studio general editing)
 *   bfl-kontext          8 cr   (direct BFL API; Look Pack only; 4-image batch = 32 cr)
 *
 * Video models (base = 5s cost; 10s = 2×base):
 *   kling-30            320 cr  (5s = 320, 10s = 640; 720p flat)
 *   kling-30-omni       420 cr  (5s 720p base; engine applies 1080p=1.5×, then duration)
 *   kling-26            190 cr
 *   kling-25            150 cr
 *   seedance-20-fast    120 cr
 *   seedance-20         160 cr
 *   seedance-15         100 cr
 *
 * Video add-ons (flat, not duration-scaled):
 *   addon-start-end      80 cr
 *   addon-motion-control 120 cr
 *   addon-multi-element   50 cr
 *
 * Audio models:
 *   elevenlabs            8 cr
 *   elevenlabs-premium   12 cr
 *
 * Lip Sync (per-minute rate):
 *   sync-lipsync-v3      90 cr  (Math.ceil(seconds/60) minutes, min 1)
 *
 * FCS:
 *   fcs_ltx23_pro       350 cr
 *   fcs_ltx23_director  600 cr
 */

import { calculateCreditCost, type PricingParams } from "./engine";

// ── Base cost table — mirrors DB credit_model_costs.base_credits ──────────────
//
// Phase 1: static compile-time fallback.
// Phase 2: delete this table when the pricing manifest endpoint is live.
//          The manifest supplies the same values dynamically.
export const MODEL_BASE_CREDITS: Record<string, number> = {
  // ── Image
  "nano-banana-standard":  8,
  "nano-banana-pro":      12,
  "nano-banana-2":        10,   // flat — 1K only (Step 0 lock; pending NB2 API resolution research)
  "gpt-image-1":          15,   // Fast=15cr base; engine applies Standard=1.25×→19cr, Ultra=1.75×→27cr (observe mode)
  "gpt-image-2":          15,   // Fast=15cr base; engine: cinematic=3.667×→55cr (default), ultra=12.0×→180cr (hidden in UI)
  "seedream-v5":          15,
  "seedream-v5-lite":      8,
  "seedream-4-5":         10,   // 1K base; engine: 2K=1.25×→13cr, 4K=1.75×→18cr (observe mode)
  "flux-kontext":         10,
  "bfl-kontext":          8,   // 8 cr/image; 4-image Look Pack = 32 cr; FLUX.1 Kontext [pro] direct BFL API ($0.04 infra/image)

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

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditCostOptions {
  /**
   * Quality / resolution tier selected by the user.
   *   Image:  "1K" | "2K" | "4K"
   *   Video:  "720p" | "1080p"
   * If absent, engine uses 1.0× (flat pricing).
   */
  quality?: string;

  /**
   * Duration in seconds — required for video and per-minute models.
   * Video:      multiplier = Math.ceil(durationSeconds / 5)
   * Per-minute: multiplier = Math.ceil(durationSeconds / 60), min 1 minute
   */
  durationSeconds?: number;

  /** True when both start + end frame are supplied (adds addon-start-end cost). */
  hasStartEnd?: boolean;

  /** True when a motion control preset is active (adds addon-motion-control cost). */
  hasMotionControl?: boolean;

  /** True when multi-element mode is active (adds addon-multi-element cost). */
  hasMultiElement?: boolean;

  /**
   * Number of images to generate in a single batch (1–4).
   * The final credit cost is multiplied by this value.
   * Clamped server-side as well; this is for frontend display accuracy only.
   * Default: 1 (single image).
   */
  outputCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DISPLAY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getGenerationCreditCost — compute the exact credit cost the backend will charge.
 *
 * Use this EVERYWHERE a generate button displays a credit count.
 * Do NOT use hardcoded numbers or studio-specific helper functions.
 *
 * Returns the total credit cost as a whole number, or null if the model
 * is not found in the cost table (caller should show "—" or fetch from server).
 *
 * For the full breakdown (line items for tooltips), use getGenerationCreditBreakdown().
 */
export function getGenerationCreditCost(
  modelKey: string,
  opts: CreditCostOptions = {}
): number | null {
  const base = MODEL_BASE_CREDITS[modelKey];
  if (base === undefined) return null;

  const params: PricingParams = {
    modelKey,
    quality:          opts.quality,
    durationSeconds:  opts.durationSeconds,
    hasStartEnd:      opts.hasStartEnd,
    hasMotionControl: opts.hasMotionControl,
    hasMultiElement:  opts.hasMultiElement,
  };

  const result = calculateCreditCost(base, params, undefined, "static");
  const count = Math.max(1, Math.min(opts.outputCount ?? 1, 4));
  return result.total * count;
}

/**
 * getGenerationCreditBreakdown — full line-item breakdown for tooltip display.
 *
 * Returns the PricingResult breakdown map so generate button tooltips can
 * show itemised costs: base, quality multiplier, duration, and add-ons.
 *
 * Returns null if the model is not in the cost table.
 */
export function getGenerationCreditBreakdown(
  modelKey: string,
  opts: CreditCostOptions = {}
): { total: number; breakdown: Record<string, number> } | null {
  const base = MODEL_BASE_CREDITS[modelKey];
  if (base === undefined) return null;

  const params: PricingParams = {
    modelKey,
    quality:          opts.quality,
    durationSeconds:  opts.durationSeconds,
    hasStartEnd:      opts.hasStartEnd,
    hasMotionControl: opts.hasMotionControl,
    hasMultiElement:  opts.hasMultiElement,
  };

  const { total, breakdown } = calculateCreditCost(base, params, undefined, "static");
  return { total, breakdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * formatCreditCost — format cost for display in generate buttons.
 *
 * Usage:  formatCreditCost(12)  →  "12 cr"
 *         formatCreditCost(null) →  "— cr"
 */
export function formatCreditCost(cost: number | null): string {
  return cost !== null ? `${cost} cr` : "— cr";
}
