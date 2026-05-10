// ─────────────────────────────────────────────────────────────────────────────
// Identity Slots — plan-tier slot limits + live usage count
//
// Slots control how many locked influencers a user can store.
// Credits are separate (generation cost). Slots are identity storage.
//
// Slot limits by plan tier:
//   starter  → 0   (cannot lock any)
//   creator  → 8
//   pro      → 25
//   business → 75
//   admin    → unlimited (999 sentinel)
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Slot limit constants ──────────────────────────────────────────────────────

export const SLOT_LIMITS: Record<string, number> = {
  starter:  0,
  creator:  8,
  pro:      25,
  business: 75,
  admin:    999,  // sentinel for unlimited
} as const;

export const DEFAULT_SLOT_LIMIT = 8; // creator tier — safe fallback

// ── Slot info type ────────────────────────────────────────────────────────────

export interface SlotInfo {
  used:      number;
  limit:     number;
  remaining: number;
}

// ── Resolve slot limit from plan tier ────────────────────────────────────────
// plan_tier is the string stored on the subscription record.
// Defaults to creator (8) if unknown.

export function getSlotLimit(planTier: string | null | undefined): number {
  if (!planTier) return DEFAULT_SLOT_LIMIT;
  const tier = planTier.toLowerCase().trim();
  return SLOT_LIMITS[tier] ?? DEFAULT_SLOT_LIMIT;
}

// ── Get live slot usage for a user ───────────────────────────────────────────
// "Used" = count of ai_influencers that are locked (identity_lock_id IS NOT NULL)
// and not archived. These are the ones consuming a slot.

export async function getUserSlotUsage(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("ai_influencers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .not("identity_lock_id", "is", null);

  if (error) {
    console.error("[identity-slots] getUserSlotUsage failed:", error);
    return 0;
  }
  return count ?? 0;
}

// ── Get plan tier for user (reads from subscriptions → plans) ────────────────
// subscriptions.plan_id references plans.id; plans.slug is the tier name
// (starter | creator | pro | business). Returns null if no active subscription.

export async function getUserPlanTier(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("plans!inner(slug)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[identity-slots] getUserPlanTier failed:", error);
    return null;
  }
  // data.plans is the joined row — slug matches SLOT_LIMITS keys
  // Cast through unknown: Supabase infers array type for joins, but maybeSingle ensures single row
  const plans = data?.plans as unknown as { slug: string } | null;
  return plans?.slug ?? null;
}

// ── Full slot info for a user ─────────────────────────────────────────────────

export async function getUserSlotInfo(userId: string): Promise<SlotInfo> {
  const [used, tier] = await Promise.all([
    getUserSlotUsage(userId),
    getUserPlanTier(userId),
  ]);
  const limit     = getSlotLimit(tier);
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining };
}
