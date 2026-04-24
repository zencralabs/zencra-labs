/**
 * Credit Estimator — Creative Director
 *
 * Calculates credit costs for the Creative Director workflow.
 * Concepting always costs 1 credit.
 * Generation cost is provider/model based.
 * Variations are 75% of base generation cost.
 * Format adaptations are 80% of base generation cost.
 */

import type { CDCreditEstimate, CDProviderDecision } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Fixed concepting cost — deducted when generating concepts (V1) */
const CONCEPTING_COST = 1;

/** Variation discount multiplier (75% of base) */
const VARIATION_DISCOUNT = 0.75;

/** Format adaptation discount multiplier (80% of base) */
const ADAPTATION_DISCOUNT = 0.80;

/**
 * Base cost per model (credits per output image).
 * Keys MUST match Zencra's internal model registry keys (core/registry.ts).
 * Never use provider API endpoint strings here — computeTotalGenerationCost
 * is called with the Zencra model key, not the upstream API path.
 */
const BASE_COSTS: Record<string, number> = {
  "gpt-image-1":          4,
  "nano-banana-pro":      8,
  "nano-banana-standard": 2,
  "nano-banana-2":        4,
  "seedream-v5":          2,   // fal-ai/seedream-3 upstream — key is Zencra registry key
  "seedream-4-5":         2,   // fal-ai/seedream-v4-5 upstream
  "flux-kontext":         3,   // fal-ai/flux-pro/kontext upstream
};

/** Fallback cost when model is not in BASE_COSTS */
const DEFAULT_COST = 4;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getConceptingCost — Always returns the concepting cost (1 cr).
 * Used by the concept generation route to deduct before calling GPT.
 */
export function getConceptingCost(): number {
  return CONCEPTING_COST;
}

/**
 * estimateCredits — Calculate a full cost breakdown for a CD generation run.
 *
 * @param provider     - Provider decision (provider name + model key)
 * @param outputCount  - Number of outputs to generate (1-4)
 * @returns CDCreditEstimate with all breakdown values
 */
export function estimateCredits(
  provider: CDProviderDecision,
  outputCount: number
): CDCreditEstimate {
  const basePerOutput = getBaseCost(provider.model);
  const variationPerOutput = roundHalf(basePerOutput * VARIATION_DISCOUNT);
  const adaptationPerOutput = roundHalf(basePerOutput * ADAPTATION_DISCOUNT);

  return {
    concepting: CONCEPTING_COST,
    generationPerOutput: basePerOutput,
    totalForFourOutputs: CONCEPTING_COST + basePerOutput * outputCount,
    variationPerOutput,
    adaptationPerOutput,
  };
}

/**
 * getBaseCostForModel — Returns the per-output credit cost for a model key.
 * Exported for use in route handlers that need to compute total deduction.
 */
export function getBaseCostForModel(modelKey: string): number {
  return getBaseCost(modelKey);
}

/**
 * computeTotalGenerationCost — Helper for route handlers.
 * Returns total credit cost for N outputs at the given model's rate.
 */
export function computeTotalGenerationCost(
  modelKey: string,
  outputCount: number,
  type: "base" | "variation" | "adaptation" = "base"
): number {
  const base = getBaseCost(modelKey);
  const multiplier =
    type === "variation"
      ? VARIATION_DISCOUNT
      : type === "adaptation"
        ? ADAPTATION_DISCOUNT
        : 1;
  return roundHalf(base * multiplier * outputCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getBaseCost(modelKey: string): number {
  return BASE_COSTS[modelKey] ?? DEFAULT_COST;
}

/** Round to nearest 0.5 (credits use half-unit precision) */
function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}
