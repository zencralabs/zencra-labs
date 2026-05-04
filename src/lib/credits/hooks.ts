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
   * Look up the base_credits for a model from credit_model_costs.
   * Returns 0 if the model is not found or the row is inactive.
   * Non-throwing — a lookup failure falls back to studio defaults.
   */
  lookupModelCost(modelKey: string): Promise<number>;
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

    async lookupModelCost(modelKey: string): Promise<number> {
      // Reads base_credits from credit_model_costs for the given model_key.
      // Only returns a value for active rows — inactive (Phase 2 hidden) models return 0.
      // Returns 0 on any DB error so a transient lookup failure never blocks generation.
      try {
        const { data, error } = await supabase
          .from("credit_model_costs")
          .select("base_credits")
          .eq("model_key", modelKey)
          .eq("active", true)
          .single();

        if (error || !data) return 0;
        return (data as { base_credits: number }).base_credits ?? 0;
      } catch {
        return 0;
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
      // Providers can call estimateCost() with full context (duration, resolution, etc.)
      // and attach the result to the input. Use it if present.
      if (input.estimatedCredits) return input.estimatedCredits;

      // ── Priority 2: DB lookup from credit_model_costs (locked spec values) ──
      // This is the authoritative source for per-model costs. A successful lookup
      // replaces all hardcoded studio defaults. Failure falls through to defaults.
      const dbCost = await ctx.store.lookupModelCost(ctx.modelKey);
      if (dbCost > 0) {
        console.log(`[credits] estimate model=${ctx.modelKey} cost=${dbCost}cr (DB)`);
        return {
          min:      dbCost,
          max:      dbCost,
          expected: dbCost,
          breakdown: { base: dbCost },
        };
      }

      // ── Priority 3: Studio-level fallbacks (safety net only) ─────────────────
      // These fire ONLY if the model_key is missing from credit_model_costs or the
      // row is inactive. A DB miss is logged so it can be caught and fixed quickly.
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
