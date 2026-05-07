/**
 * Credit Hooks — ZProvider-compatible credit lifecycle layer
 *
 * Implements the CreditHooks interface from core/orchestrator.ts.
 * Sits on top of the existing calculate.ts system.
 *
 * CreditHooks interface (from core/orchestrator.ts):
 *   estimate(input) → CreditEstimate
 *   reserve(userId, jobId, estimate) → boolean  (false = insufficient funds)
 *   finalize(userId, jobId, actual) → void
 *   rollback(userId, jobId) → void
 *
 * Database contract (Supabase):
 *   Table: profiles             — column: credits (int) is the live balance
 *   Table: credit_transactions  — columns: id, user_id, amount, type,
 *                                           balance_after (nullable), description,
 *                                           metadata (jsonb), created_at
 *   RPC:   spend_credits(p_user_id, p_amount, p_description, p_generation_id?)
 *            → TABLE (success BOOLEAN, new_balance INTEGER, error_message TEXT)
 *   RPC:   refund_credits(p_user_id, p_amount, p_description, p_generation_id?)
 *            → TABLE (success BOOLEAN, new_balance INTEGER, error_message TEXT)
 *
 * NOTE: There is no separate user_credits table. Balance lives on profiles.credits.
 * spend_credits / refund_credits atomically update profiles.credits and log a
 * 'spend'/'refund' entry with balance_after set. Our log() calls add a second
 * entry (type='reserve'/'finalize'/'rollback') for job lifecycle audit —
 * balance_after is NULL on these entries (made nullable by migration 010).
 *
 * This module is database-agnostic via the CreditStore interface.
 * A Supabase implementation is provided by buildSupabaseCreditStore().
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditHooks }    from "../providers/core/orchestrator";
import type { CreditEstimate, ZProviderInput, StudioType } from "../providers/core/types";
import {
  calculateCreditCost,
  getPricingEngineMode,
  type PricingParams,
  type PricingConfig,
} from "./engine";

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT STORE INTERFACE (database-agnostic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return type for lookupModelCost — three distinct states:
 *   number    — row found AND active; value is base_credits (always >= 1 per DB constraint)
 *   "inactive" — row found but active=false; generation must be BLOCKED, never silently billed
 *   null       — row not found in DB at all; studio-level fallback pricing is permitted
 *
 * This three-way distinction prevents inactive locked models from silently falling
 * back to cheap studio defaults and destroying billing accuracy.
 */
export type ModelCostLookup = number | "inactive" | null;

export interface CreditStore {
  /** Atomically deduct `amount` from user balance. Returns false if insufficient. */
  deduct(userId: string, amount: number, description?: string): Promise<boolean>;
  /** Restore `amount` to user balance (rollback). */
  restore(userId: string, amount: number, description?: string): Promise<void>;
  /** Read current user balance. */
  getBalance(userId: string): Promise<number>;
  /** Append an immutable transaction record. */
  log(entry: CreditLogEntry): Promise<void>;
  /**
   * Look up model pricing from credit_model_costs.
   *
   * Returns:
   *   number     — row exists, active=true; use this cost (apply scaling/addons as needed)
   *   "inactive" — row exists, active=false; caller MUST block generation
   *   null       — row not found; caller MAY use studio-level provisional fallback
   *
   * Never throws — any DB error returns null (allows fallback, logs warning).
   */
  lookupModelCost(modelKey: string): Promise<ModelCostLookup>;
}

export interface CreditLogEntry {
  userId:    string;
  amount:    number;
  type:      "reserve" | "finalize" | "rollback" | "adjustment";
  provider:  string;
  modelKey:  string;
  studio:    StudioType;
  jobId:     string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE CREDIT STORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Supabase-backed CreditStore.
 *
 * All balance mutations go through the spend_credits / refund_credits RPCs.
 * These RPCs hold a row-level lock (FOR UPDATE) on profiles, guaranteeing
 * atomicity under concurrent requests. There is no fallback non-atomic path —
 * if the RPC fails, the operation fails and the caller handles it.
 */
export function buildSupabaseCreditStore(supabase: SupabaseClient): CreditStore {
  return {
    async deduct(userId: string, amount: number, description?: string): Promise<boolean> {
      // spend_credits atomically deducts from profiles.credits and logs a 'spend' row.
      // Returns TABLE (success BOOLEAN, new_balance INTEGER, error_message TEXT).
      const { data, error } = await supabase.rpc("spend_credits", {
        p_user_id:    userId,
        p_amount:     amount,
        p_description: description ?? `Studio generation — ${amount} credit${amount !== 1 ? "s" : ""} reserved`,
      });

      if (error) {
        console.error("[credits] spend_credits RPC error:", error.message);
        return false;
      }

      // data is an array of TABLE rows — read success from row 0
      const row = (data as Array<{ success: boolean }> | null)?.[0];
      return row?.success === true;
    },

    async restore(userId: string, amount: number, description?: string): Promise<void> {
      // refund_credits atomically restores credits and logs a 'refund' row.
      const { error } = await supabase.rpc("refund_credits", {
        p_user_id:    userId,
        p_amount:     amount,
        p_description: description ?? `Studio generation — ${amount} credit${amount !== 1 ? "s" : ""} restored`,
      });

      if (error) {
        console.error("[credits] refund_credits RPC error:", error.message);
        // Restore failures are logged but non-fatal — the job is already done.
        // A failed restore means the user keeps their credits (safe direction).
      }
    },

    async getBalance(userId: string): Promise<number> {
      // Balance lives on profiles.credits (no separate user_credits table)
      const { data } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .single();
      return (data as { credits?: number } | null)?.credits ?? 0;
    },

    async log(entry: CreditLogEntry): Promise<void> {
      // Inserts an audit entry into credit_transactions.
      // provider/modelKey/studio/jobId are stored in metadata since
      // those columns don't exist on credit_transactions — only metadata jsonb does.
      // balance_after is nullable on this table for audit entries.
      await supabase
        .from("credit_transactions")
        .insert({
          user_id:     entry.userId,
          amount:      entry.amount,
          type:        entry.type,
          description: `Studio ${entry.type} [${entry.studio}/${entry.modelKey}]`,
          metadata:    {
            ...(entry.metadata ?? {}),
            job_id:    entry.jobId,
            provider:  entry.provider,
            model_key: entry.modelKey,
            studio:    entry.studio,
          },
          created_at: entry.createdAt.toISOString(),
        });
      // log insert failure is intentionally non-fatal — we swallow the error
    },

    async lookupModelCost(modelKey: string): Promise<ModelCostLookup> {
      // Three-way lookup — DO NOT filter by active here.
      // Callers must distinguish "not found" (null) from "found but inactive" ("inactive")
      // to prevent inactive locked models from falling back to cheap studio defaults.
      //
      // Uses maybeSingle() so a missing row returns data=null (no error thrown).
      // A transient DB error returns null so a lookup failure never blocks generation
      // on unregistered models — but DOES let "inactive" rows block correctly when reachable.
      try {
        const { data, error } = await supabase
          .from("credit_model_costs")
          .select("base_credits, active")
          .eq("model_key", modelKey)
          .maybeSingle();

        if (error) {
          console.warn(`[credits] lookupModelCost DB error for model=${modelKey}:`, error.message);
          return null; // transient error → allow fallback (not an inactive block)
        }
        if (!data) return null; // row not in DB → caller may use studio fallback

        const row = data as { base_credits: number; active: boolean };
        if (!row.active) return "inactive"; // row exists but blocked → caller must throw
        return row.base_credits ?? 1;       // active row → use this cost
      } catch {
        return null;
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT HOOKS FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditHooksContext {
  provider: string;
  modelKey: string;
  studio:   StudioType;
  store:    CreditStore;
}

/**
 * Build a CreditHooks object matching the interface in core/orchestrator.ts.
 *
 * The orchestrator calls:
 *   hooks.estimate(input) → CreditEstimate
 *   hooks.reserve(userId, jobId, estimate) → boolean
 *   hooks.finalize(userId, jobId, actual) → void
 *   hooks.rollback(userId, jobId) → void
 *
 * Usage:
 *   const hooks = buildCreditHooks({
 *     provider, modelKey, studio,
 *     store: buildSupabaseCreditStore(supabase),
 *   });
 *   await dispatch(input, { creditHooks: hooks });
 */
export function buildCreditHooks(ctx: CreditHooksContext): CreditHooks {
  // Track per-job reserved amounts for rollback
  const _reserved = new Map<string, number>();

  return {
    async estimate(input: ZProviderInput): Promise<CreditEstimate> {
      // ── Priority 1: provider-supplied estimate (e.g. duration-scaled costs) ──
      // Providers can attach a pre-computed estimate to the input. Use it if present.
      if (input.estimatedCredits) return input.estimatedCredits;

      // ── Priority 2: DB lookup from credit_model_costs (locked spec values) ──
      // This is the authoritative source for per-model costs. A successful lookup
      // replaces all hardcoded studio defaults. Failure falls through to defaults.
      const modelLookup = await ctx.store.lookupModelCost(ctx.modelKey);

      // ── BLOCK: model is registered but inactive ────────────────────────────
      // This is the critical safety gate. An inactive row means the model is known
      // to the pricing spec but not yet enabled for production. Generating with it
      // would charge the wrong amount (studio default) or zero credits.
      // We throw here so the route returns a 402/503 before any credit is reserved.
      if (modelLookup === "inactive") {
        throw new Error(
          `Model "${ctx.modelKey}" is registered in credit_model_costs but is not yet active. ` +
          `Generation is blocked. Set active=true in credit_model_costs to enable this model.`
        );
      }

      // Unpack: null = row not in DB (fallback allowed), number = active cost
      const dbCost = modelLookup; // number | null

      if (dbCost !== null && dbCost > 0) {
        const quality   = input.providerParams?.quality as string | undefined;
        const duration  = input.durationSeconds;

        // ── Determine add-on flags ─────────────────────────────────────────────
        // Start + End Frame: charged when BOTH imageUrl AND endImageUrl are present.
        //   Using only a start frame for image-to-video does NOT trigger this add-on.
        // Motion Control: flagged by providerParams.motionControlActive = true.
        // Multi Element: flagged by providerParams.multiElementActive = true.
        const hasStartEnd      = ctx.studio === "video" && !!input.imageUrl && !!input.endImageUrl;
        const hasMotionControl = ctx.studio === "video" && input.providerParams?.motionControlActive === true;
        const hasMultiElement  = ctx.studio === "video" && input.providerParams?.multiElementActive === true;

        // ── Look up add-on costs from DB ──────────────────────────────────────
        // Add-on rows are looked up from credit_model_costs so spec changes take
        // effect without a code deploy. Inactive add-on rows waive the charge
        // (feature still works; this is intentionally different from an inactive
        // base model row which BLOCKS generation entirely).
        //
        // The resolved DB costs override the engine's STATIC_ADDON_COSTS, ensuring
        // the backend always bills the DB spec value even if the static table drifts.
        const resolveAddon = (lookup: ModelCostLookup): number =>
          typeof lookup === "number" ? lookup : 0;

        const addonCostsFromDB: Record<string, number> = {};
        if (hasStartEnd) {
          const v = resolveAddon(await ctx.store.lookupModelCost("addon-start-end"));
          if (v > 0) addonCostsFromDB["addon-start-end"] = v;
        }
        if (hasMotionControl) {
          const v = resolveAddon(await ctx.store.lookupModelCost("addon-motion-control"));
          if (v > 0) addonCostsFromDB["addon-motion-control"] = v;
        }
        if (hasMultiElement) {
          const v = resolveAddon(await ctx.store.lookupModelCost("addon-multi-element"));
          if (v > 0) addonCostsFromDB["addon-multi-element"] = v;
        }

        // Build engine config — pass DB add-on costs to override static table.
        // qualityMultipliers not passed: engine uses STATIC_QUALITY_MULTIPLIERS
        // (mirrors the seeded DB values exactly in Phase 1).
        // Phase 2: extend lookupModelCost to return quality_multipliers JSONB,
        //          then pass it here via config.qualityMultipliers.
        const engineConfig: PricingConfig | undefined =
          Object.keys(addonCostsFromDB).length > 0
            ? { addonCosts: addonCostsFromDB }
            : undefined;

        const params: PricingParams = {
          modelKey:        ctx.modelKey,
          quality,
          durationSeconds: duration,
          hasStartEnd,
          hasMotionControl,
          hasMultiElement,
        };

        // ── Engine calculation ─────────────────────────────────────────────────
        // newCost: quality-scaled (what the engine charges after multipliers).
        // oldCost: flat (no quality multiplier — matches pre-engine behavior).
        // Both use the same duration scaling and add-ons.
        const engineResult = calculateCreditCost(dbCost, params, engineConfig, "db");
        const newCost = engineResult.total;

        const flatResult = calculateCreditCost(
          dbCost,
          { ...params, quality: undefined },
          engineConfig,
          "db"
        );
        const oldCost = flatResult.total;

        // ── Observe / Enforce mode ─────────────────────────────────────────────
        // observe (default): charge old flat cost — safe direction during calibration.
        //   User always pays the LOWER amount. Overcharging destroys trust.
        //   Log the delta so the calibration window can confirm multiplier accuracy.
        // enforce: charge the quality-scaled cost from the engine.
        //   Activate by setting PRICING_ENGINE_MODE=enforce in Vercel env vars.
        //   Rollback: set PRICING_ENGINE_MODE=observe to revert instantly.
        const mode = getPricingEngineMode();
        const chargedCost      = mode === "enforce" ? newCost      : oldCost;
        const chargedBreakdown = mode === "enforce" ? engineResult.breakdown : flatResult.breakdown;

        if (mode === "observe" && oldCost !== newCost) {
          const deltaSign = newCost > oldCost ? "+" : "";
          console.warn(
            `[pricing-engine][observe] model=${ctx.modelKey}` +
            ` quality=${quality ?? "none"}` +
            (duration ? ` duration=${duration}s` : "") +
            ` old=${oldCost}cr new=${newCost}cr delta=${deltaSign}${newCost - oldCost}cr` +
            ` → charging OLD flat cost (observe mode)`
          );
        }

        console.log(
          `[credits] estimate model=${ctx.modelKey}` +
          (quality    ? ` quality=${quality}`       : "") +
          (duration   ? ` duration=${duration}s`    : "") +
          ` charged=${chargedCost}cr mode=${mode} (DB)`
        );

        return {
          min:       chargedCost,
          max:       chargedCost,
          expected:  chargedCost,
          breakdown: chargedBreakdown,
        };
      }

      // ── Priority 3: Studio-level fallbacks (safety net only) ─────────────────
      // These fire ONLY if the model_key is missing from credit_model_costs.
      // A DB miss is logged so it can be caught and fixed quickly.
      //
      // ⚠ PROVISIONAL — these values are NOT locked spec pricing.
      // They are a last-resort guard against zero-credit charges on unregistered models.
      // Any model reaching this path MUST be added to credit_model_costs immediately.
      console.warn(
        `[credits] estimate fallback for model=${ctx.modelKey} studio=${ctx.studio} — ` +
        `add to credit_model_costs to use locked spec pricing`
      );
      const studioDefaults: Record<string, CreditEstimate> = {
        image:     { min: 8,   max: 35,  expected: 10,  breakdown: { base: 10  } },
        video:     { min: 120, max: 420, expected: 150, breakdown: { base: 150 } },
        audio:     { min: 8,   max: 20,  expected: 8,   breakdown: { base: 8   } },
        character: { min: 25,  max: 80,  expected: 25,  breakdown: { base: 25  } },
        ugc:       { min: 120, max: 600, expected: 180, breakdown: { base: 180 } },
        fcs:       { min: 350, max: 600, expected: 350, breakdown: { base: 350 } },
      };
      return studioDefaults[input.studioType] ?? { min: 8, max: 35, expected: 10, breakdown: { base: 10 } };
    },

    async reserve(userId: string, jobId: string, estimate: CreditEstimate): Promise<boolean> {
      const amount = estimate.expected;
      if (amount <= 0) return true;

      const ok = await ctx.store.deduct(
        userId,
        amount,
        `Reserve [${ctx.studio}/${ctx.modelKey}] job=${jobId}`,
      );
      if (ok) {
        _reserved.set(jobId, amount);
        await ctx.store.log({
          userId,
          amount:    0,   // audit-only — balance change is captured on the 'spend' row
          type:     "reserve",
          provider: ctx.provider,
          modelKey: ctx.modelKey,
          studio:   ctx.studio,
          jobId,
          createdAt: new Date(),
        });
      }
      return ok;
    },

    async finalize(userId: string, jobId: string, actual: number): Promise<void> {
      const reserved = _reserved.get(jobId) ?? 0;

      // Refund over-reserved credits back to user
      const diff = reserved - actual;
      if (diff > 0) {
        await ctx.store.restore(
          userId,
          diff,
          `Finalize refund [${ctx.studio}/${ctx.modelKey}] job=${jobId} over-reserved=${diff}`,
        );
      } else if (diff < 0) {
        // Deduct extra credits for the actual cost overage
        await ctx.store.deduct(
          userId,
          Math.abs(diff),
          `Finalize overage [${ctx.studio}/${ctx.modelKey}] job=${jobId} extra=${Math.abs(diff)}`,
        );
      }

      _reserved.delete(jobId);

      await ctx.store.log({
        userId,
        // diff = reserved - actual:
        //   0         → exact match, no balance adjustment
        //   positive  → over-reserved; that amount was refunded (see 'refund' row)
        //   negative  → under-reserved; that extra was deducted (see 'spend' row)
        amount:   diff,
        type:     "finalize",
        provider: ctx.provider,
        modelKey: ctx.modelKey,
        studio:   ctx.studio,
        jobId,
        metadata: { reserved, actual, diff },
        createdAt: new Date(),
      });
    },

    async rollback(userId: string, jobId: string): Promise<void> {
      const amount = _reserved.get(jobId) ?? 0;
      if (amount <= 0) return;

      await ctx.store.restore(
        userId,
        amount,
        `Rollback [${ctx.studio}/${ctx.modelKey}] job=${jobId} restored=${amount}`,
      );
      _reserved.delete(jobId);

      await ctx.store.log({
        userId,
        amount:    0,   // audit-only — balance restore is captured on the 'refund' row
        type:     "rollback",
        provider: ctx.provider,
        modelKey: ctx.modelKey,
        studio:   ctx.studio,
        jobId,
        metadata: { restored: amount },
        createdAt: new Date(),
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NO-OP HOOKS (dry-run / development mode)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A no-op CreditHooks for dry-run mode and tests.
 * No database writes, no balance deductions.
 */
export const noopCreditHooks: CreditHooks = {
  estimate: async (input: ZProviderInput): Promise<CreditEstimate> => ({
    min: 0, max: 0, expected: 0, breakdown: {},
  }),
  reserve:  async (_u: string, _j: string, _e: CreditEstimate): Promise<boolean> => true,
  finalize: async (): Promise<void> => {},
  rollback: async (): Promise<void> => {},
};

// ─────────────────────────────────────────────────────────────────────────────
// BALANCE CHECK UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a user has sufficient credits before dispatching.
 * Returns true if balance >= required.
 */
export async function hasSufficientCredits(
  store:    CreditStore,
  userId:   string,
  required: number
): Promise<boolean> {
  const balance = await store.getBalance(userId);
  return balance >= required;
}
