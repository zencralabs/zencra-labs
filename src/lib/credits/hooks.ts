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
        const duration = input.durationSeconds;

        // ── Per-minute scaling (dubbing, voice-isolation) ─────────────────────
        // These model_keys store the per-MINUTE rate in base_credits.
        // Dispatch multiplies by Math.ceil(durationSeconds / 60) to get total cost.
        // Minimum charge: 1 minute (when duration is unknown, we charge 1 minute).
        const isPerMinuteModel = ctx.modelKey === "dubbing" || ctx.modelKey === "voice-isolation";
        if (isPerMinuteModel) {
          const minutes = duration ? Math.ceil(duration / 60) : 1;
          const total = dbCost * minutes;
          console.log(
            `[credits] estimate model=${ctx.modelKey} rate=${dbCost}cr/min` +
            ` duration=${duration ?? "?"}s minutes=${minutes} total=${total}cr (DB per-min)`
          );
          return {
            min:      total,
            max:      total,
            expected: total,
            breakdown: { base: total },
          };
        }

        // ── Duration scaling (video studio — 5-second intervals) ───────────────
        // Spec: 5s = 1× base, 10s = 2× base.
        // Formula: multiplier = Math.ceil(durationSeconds / 5).
        //   5s → 1×, 10s → 2×, 6–10s → 2×, 11–15s → 3×, etc.
        // Applied to the BASE MODEL cost only — add-ons below are flat regardless of duration.
        // When no duration is provided for a video, treat as 5s (1× base).
        let scaledBase = dbCost;
        let durationIntervals = 1;
        if (ctx.studio === "video" && duration && duration > 0) {
          durationIntervals = Math.ceil(duration / 5);
          scaledBase = dbCost * durationIntervals;
        }

        // ── Add-on summing ─────────────────────────────────────────────────────
        // Add-ons are flat charges (not duration-scaled) summed on top of scaledBase.
        // Each add-on is looked up from credit_model_costs so spec changes take effect
        // without a code deploy.
        let addonTotal = 0;
        const addonBreakdown: Record<string, number> = {};

        // Add-on lookup helper — narrows ModelCostLookup for add-on rows.
        // Inactive add-on rows skip the charge (the feature still works, we just don't
        // bill the add-on until its row is activated). This is intentionally different
        // from the base model check: an inactive BASE model blocks generation entirely,
        // while an inactive ADD-ON row merely waives the add-on cost.
        const resolveAddon = (lookup: ModelCostLookup): number => {
          if (typeof lookup === "number") return lookup; // active → charge it
          return 0;                                       // inactive or null → waive
        };

        // Start + End Frame add-on (+80cr, locked spec):
        //   Charged when BOTH a start frame (imageUrl) AND an end frame (endImageUrl)
        //   are provided for a video generation. Using only a start frame for standard
        //   image-to-video does NOT trigger this add-on.
        if (ctx.studio === "video" && input.imageUrl && input.endImageUrl) {
          const addonCost = resolveAddon(await ctx.store.lookupModelCost("addon-start-end"));
          if (addonCost > 0) {
            addonTotal += addonCost;
            addonBreakdown["addon-start-end"] = addonCost;
          }
        }

        // Motion Control add-on (+120cr, locked spec):
        //   Charged when a motion control preset is active (preset !== "none").
        //   The video generate route flags this by setting
        //   providerParams.motionControlActive = true before calling dispatch.
        if (ctx.studio === "video" && input.providerParams?.motionControlActive === true) {
          const addonCost = resolveAddon(await ctx.store.lookupModelCost("addon-motion-control"));
          if (addonCost > 0) {
            addonTotal += addonCost;
            addonBreakdown["addon-motion-control"] = addonCost;
          }
        }

        // ── Final total ───────────────────────────────────────────────────────
        const total = scaledBase + addonTotal;
        const breakdown: Record<string, number> = { base: scaledBase };
        if (addonTotal > 0) breakdown.addons = addonTotal;
        Object.assign(breakdown, addonBreakdown);

        console.log(
          `[credits] estimate model=${ctx.modelKey}` +
          (ctx.studio === "video" && duration ? ` duration=${duration}s×${durationIntervals}` : "") +
          ` base=${dbCost}cr scaled=${scaledBase}cr addons=${addonTotal}cr total=${total}cr (DB)`
        );
        return {
          min:      total,
          max:      total,
          expected: total,
          breakdown,
        };
      }

      // ── Priority 3: Studio-level fallbacks (safety net only) ─────────────────
      // These fire ONLY if the model_key is missing from credit_model_costs or the
      // row is inactive. A DB miss is logged so it can be caught and fixed quickly.
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
