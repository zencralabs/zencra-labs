/**
 * Provider Cost Logger — Lean v1
 *
 * Fire-and-forget helper that INSERTs a row into provider_cost_log
 * after each generation attempt (success or failure).
 *
 * Design rules:
 *   - NEVER throws — all errors are swallowed (non-fatal, admin intelligence only)
 *   - NEVER touches credit_transactions, profiles, or any user-billing table
 *   - Called from pollAndUpdateJob (async providers) and studioDispatch (sync providers)
 *   - user_id is optional — background polling may not carry user context
 */

import { supabaseAdmin }            from "@/lib/supabase/admin";
import { estimateProviderCostUsd }  from "./cost-rates";

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderCostLogInput {
  assetId?:              string;
  providerKey?:          string;   // overrides auto-lookup from modelKey if provided
  modelKey:              string;
  studio:                string;
  userId?:               string;
  status:                "success" | "failed";
  failureReason?:        string;
  zencraCreditsCharged?: number;
  generationParams?:     Record<string, unknown>;   // duration, ar, quality etc
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a provider cost event. Fire-and-forget — never await for generation flow.
 *
 * Usage:
 *   void logProviderCost({ modelKey, studio, status: "success", assetId, userId });
 */
export async function logProviderCost(input: ProviderCostLogInput): Promise<void> {
  try {
    const durationSeconds = typeof input.generationParams?.durationSeconds === "number"
      ? input.generationParams.durationSeconds as number
      : undefined;

    const costEstimate = estimateProviderCostUsd(input.modelKey, { durationSeconds });

    const providerKey = input.providerKey ?? costEstimate.providerKey;

    const row = {
      asset_id:               input.assetId       ?? null,
      provider_key:           providerKey,
      model_key:              input.modelKey,
      studio:                 input.studio,
      user_id:                input.userId        ?? null,
      status:                 input.status,
      failure_reason:         input.failureReason
                                ? input.failureReason.trim().slice(0, 500)
                                : null,
      zencra_credits_charged: input.zencraCreditsCharged ?? null,
      provider_cost_units:    costEstimate.costUnits ?? null,
      provider_cost_usd:      costEstimate.costUsd > 0 ? costEstimate.costUsd : null,
      cost_basis:             costEstimate.basis,
      generation_params:      input.generationParams ?? null,
    };

    const { error } = await supabaseAdmin
      .from("provider_cost_log")
      .insert(row);

    if (error) {
      // Log but never propagate — this is an admin analytics write, not business logic
      console.warn("[cost-logger] insert failed:", error.message);
    }
  } catch (err) {
    // Absolute safety net — cost logging must never break generation flow
    console.warn("[cost-logger] unexpected error:", err instanceof Error ? err.message : err);
  }
}
