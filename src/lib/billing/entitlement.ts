/**
 * src/lib/billing/entitlement.ts
 *
 * Billing entitlement gate — inserted into every studio generate route
 * after rate limiting, before dispatch.
 *
 * Enforcement order:
 *   1. Kill switch (ZENCRA_FLAG_*_ENABLED env var)
 *   2. Resolve billing identity (Business seat member → owner)
 *   3. Load active subscription via get_user_entitlement RPC
 *   4a. Trial path  — check per-category limits, FCS always blocked
 *   4b. Paid path   — check plan allows studio, FCS requires active addon
 *   5. Non-Business seat abuse check (no seats on solo plans)
 *
 * Post-dispatch (called by route after successful generation):
 *   - Trial: consume_trial_usage(userId, studioType)
 *   - Paid:  spend_credits(billingUserId, cost)  [existing flow]
 *
 * Errors are thrown as StudioDispatchError with the appropriate code.
 * Routes catch these and map to HTTP status via dispatchErrorStatus().
 */

import { supabaseAdmin }         from "@/lib/supabase/admin";
import {
  StudioDispatchError,
  type StudioDispatchErrorCode,
} from "@/lib/api/studio-dispatch";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StudioType =
  | "image"
  | "video"
  | "audio"
  | "character"
  | "ugc"
  | "fcs";

export type EntitlementPath = "trial" | "paid" | "admin";

export interface EntitlementResult {
  /** Which enforcement path was taken */
  path:            EntitlementPath;
  /** The user whose credit balance should be debited */
  billingUserId:   string;
  /** True when the caller is a Business seat member (not the owner) */
  isTeamMember:    boolean;
  /** Subscription ID — used to tag credit transactions */
  subscriptionId:  string;
  /**
   * Trial expiry ISO timestamp — present only when path === "trial".
   * Pass to consumeTrialUsage() after a successful generation.
   */
  trialEndsAt?:    string;
}

// Raw shape returned by get_user_entitlement RPC
interface EntitlementRPCResult {
  status:          string;
  billing_user_id: string;
  is_team_member:  boolean;
  subscription?: {
    id:                   string;
    plan_slug:            string;
    fcs_allowed:          boolean;
    team_enabled:         boolean;
    max_users:            number;
    trial_ends_at:        string | null;
    current_period_end:   string | null;
    cancel_at_period_end: boolean;
  };
  fcs_active: boolean;
  credits:    number;
  trial?: {
    images_used: number; images_max: number;
    videos_used: number; videos_max: number;
    audio_used:  number; audio_max:  number;
    trial_ends_at: string;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kill-switch flag map
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_FLAGS: Record<StudioType, string> = {
  image:     "ZENCRA_FLAG_IMAGE_ENABLED",
  video:     "ZENCRA_FLAG_VIDEO_ENABLED",
  audio:     "ZENCRA_FLAG_AUDIO_ENABLED",
  character: "ZENCRA_FLAG_CHARACTER_ENABLED",
  ugc:       "ZENCRA_FLAG_UGC_ENABLED",
  fcs:       "ZENCRA_FLAG_FCS_ENABLED",
};

// ─────────────────────────────────────────────────────────────────────────────
// checkEntitlement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single entitlement gate for all studio generate routes.
 *
 * @param userId     The authenticated user making the request.
 * @param studioType The studio being accessed (image/video/audio/character/ugc/fcs).
 * @returns          EntitlementResult — billing identity + path for post-dispatch use.
 * @throws           StudioDispatchError on any entitlement failure.
 */
export async function checkEntitlement(
  userId:      string,
  studioType:  StudioType,
): Promise<EntitlementResult> {

  // ── 1. Kill switch ──────────────────────────────────────────────────────────
  const flagKey = STUDIO_FLAGS[studioType];
  if (process.env[flagKey] === "false") {
    throw new StudioDispatchError(
      `${studioType} studio is currently disabled.`,
      "FEATURE_DISABLED"
    );
  }

  // ── Admin bypass ────────────────────────────────────────────────────────────
  // Admin accounts (role = 'admin' in profiles) skip the subscription gate so
  // internal testing is never blocked.  Credits are still deducted normally.
  // Provider / model checks (kill-switch above, rate-limit in route) are NOT bypassed.
  {
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if ((profileRow as { role?: string } | null)?.role === "admin") {
      return {
        path:           "admin",
        billingUserId:  userId,
        isTeamMember:   false,
        subscriptionId: "admin-bypass",
      };
    }
  }

  // ── 2 & 3. Resolve billing identity + load subscription ────────────────────
  const { data: raw, error: rpcError } = await supabaseAdmin.rpc(
    "get_user_entitlement",
    { p_user_id: userId }
  );

  if (rpcError) {
    console.error("[entitlement] get_user_entitlement RPC error:", rpcError.message);
    throw new StudioDispatchError(
      "Failed to verify billing status.",
      "SERVER_ERROR"
    );
  }

  const ent = raw as EntitlementRPCResult;

  // ── No active subscription ──────────────────────────────────────────────────
  if (ent.status === "inactive" || !ent.subscription) {
    throw new StudioDispatchError(
      "No active subscription. Please upgrade to continue generating.",
      "SUBSCRIPTION_INACTIVE"
    );
  }

  const sub = ent.subscription;

  // ── Canceled / expired ──────────────────────────────────────────────────────
  if (ent.status === "canceled" || ent.status === "expired") {
    throw new StudioDispatchError(
      "Your subscription has ended. Please resubscribe to continue.",
      "SUBSCRIPTION_INACTIVE"
    );
  }

  // ── 4A. Trial path ──────────────────────────────────────────────────────────
  if (ent.status === "trialing") {
    // FCS is always blocked during trial
    if (studioType === "fcs") {
      throw new StudioDispatchError(
        "Future Cinema Studio is not available during trial. Upgrade to Pro or Business to unlock.",
        "FCS_NOT_ALLOWED"
      );
    }

    // Check trial time window
    const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
    if (!trialEndsAt || trialEndsAt < new Date()) {
      // Mark expired in DB (fire and forget)
      void supabaseAdmin
        .from("subscriptions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", ent.billing_user_id)
        .eq("status", "trialing");

      throw new StudioDispatchError(
        "Your 7-day trial has ended. Upgrade to continue generating.",
        "TRIAL_EXPIRED"
      );
    }

    // Check per-category trial limits
    const trial = ent.trial;
    if (!trial) {
      // No trial_usage row yet — allow through (will be created on first generation)
      return {
        path:           "trial",
        billingUserId:  ent.billing_user_id,
        isTeamMember:   ent.is_team_member,
        subscriptionId: sub.id,
        trialEndsAt:    sub.trial_ends_at ?? undefined,
      };
    }

    const category = resolveTrialCategory(studioType);
    const used = trial[`${category}_used` as keyof typeof trial] as number;
    const max  = trial[`${category}_max`  as keyof typeof trial] as number;

    if (used >= max) {
      throw new StudioDispatchError(
        `You've used all ${max} trial ${category}. Upgrade to Starter or higher to continue.`,
        "TRIAL_EXHAUSTED"
      );
    }

    return {
      path:           "trial",
      billingUserId:  ent.billing_user_id,
      isTeamMember:   ent.is_team_member,
      subscriptionId: sub.id,
      trialEndsAt:    sub.trial_ends_at ?? undefined,
    };
  }

  // ── 4B. Paid path (active | past_due) ──────────────────────────────────────

  // FCS capability gate
  if (studioType === "fcs") {
    if (!sub.fcs_allowed) {
      // Plan is Starter or Creator — hard block
      throw new StudioDispatchError(
        "Future Cinema Studio requires a Pro or Business plan.",
        "FCS_NOT_ALLOWED"
      );
    }
    if (!ent.fcs_active) {
      // Eligible plan but addon not purchased
      throw new StudioDispatchError(
        "Future Cinema Studio is not active on your account. Add the FCS addon to unlock.",
        "FCS_NOT_ALLOWED"
      );
    }
  }

  // Non-Business single-user enforcement
  // If a non-Business subscription has seat rows, something is wrong.
  if (!sub.team_enabled) {
    const { count } = await supabaseAdmin
      .from("subscription_seats")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", sub.id)
      .eq("status", "active");

    if ((count ?? 0) > 0) {
      throw new StudioDispatchError(
        "Multiple users are not permitted on this plan. Only Business supports team access.",
        "SINGLE_USER_VIOLATION"
      );
    }
  }

  return {
    path:           "paid",
    billingUserId:  ent.billing_user_id,
    isTeamMember:   ent.is_team_member,
    subscriptionId: sub.id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// consumeTrialUsage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called AFTER a successful trial generation to atomically increment usage.
 * Creates the trial_usage row if it doesn't exist yet (first-generation case).
 *
 * @param userId      The generating user's ID.
 * @param studioType  The studio that was used.
 * @param trialEndsAt Trial expiry timestamp (from subscription.trial_ends_at).
 */
export async function consumeTrialUsage(
  userId:       string,
  studioType:   StudioType,
  trialEndsAt:  string,
): Promise<void> {
  // Ensure trial_usage row exists (idempotent upsert)
  await supabaseAdmin
    .from("trial_usage")
    .upsert(
      { user_id: userId, trial_ends_at: trialEndsAt },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  const { data, error } = await supabaseAdmin.rpc("consume_trial_usage", {
    p_user_id:     userId,
    p_studio_type: studioType,
  });

  if (error) {
    console.error("[entitlement] consume_trial_usage RPC error:", error.message);
    // Non-fatal — generation already succeeded; log and continue
    return;
  }

  const result = data as { allowed: boolean; reason?: string };
  if (!result.allowed) {
    // This shouldn't happen (we checked before dispatch), but log it
    console.warn("[entitlement] consume_trial_usage returned not allowed after generation:", result.reason);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Maps studio type to the trial_usage category field prefix */
function resolveTrialCategory(studioType: StudioType): "images" | "videos" | "audio" {
  if (studioType === "image" || studioType === "character") return "images";
  if (studioType === "video" || studioType === "ugc")       return "videos";
  return "audio";
}
