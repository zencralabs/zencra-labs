/**
 * GET /api/billing/status
 *
 * Read-only endpoint that returns the caller's real subscription state.
 * Called by the subscription dashboard page to drive the Active/Inactive badge.
 *
 * Uses the same get_user_entitlement RPC as checkEntitlement() but does NOT
 * enforce any gate — it only surfaces the result for display purposes.
 *
 * Admin users (role = 'admin' in profiles) always receive hasActiveSubscription=true.
 *
 * Response:
 *   200 {
 *     status: "active" | "trialing" | "past_due" | "inactive" | "canceled" | "expired" | "free"
 *     hasActiveSubscription: boolean
 *     planKey?: string   // plan_slug from subscription row if present
 *   }
 *
 * Errors:
 *   401 — unauthenticated
 *   500 — RPC failure (caller should fail safe to inactive)
 */

import { NextResponse }    from "next/server";
import { getAuthUser }     from "@/lib/supabase/server";
import { supabaseAdmin }   from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingStatusResponse = {
  status: string;
  hasActiveSubscription: boolean;
  planKey?: string;
};

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function GET(req: Request): Promise<Response> {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Admin bypass — always active ──────────────────────────────────────
  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authUser.id)
    .single();

  if ((profileRow as { role?: string } | null)?.role === "admin") {
    return NextResponse.json<BillingStatusResponse>({
      status:               "active",
      hasActiveSubscription: true,
    });
  }

  // ── 3. Call entitlement RPC ───────────────────────────────────────────────
  const { data: raw, error: rpcError } = await supabaseAdmin.rpc(
    "get_user_entitlement",
    { p_user_id: authUser.id }
  );

  if (rpcError) {
    console.error("[billing/status] get_user_entitlement RPC error:", rpcError.message);
    return NextResponse.json({ error: "Failed to load billing status" }, { status: 500 });
  }

  const ent = raw as {
    status: string;
    subscription?: { plan_slug: string } | null;
  };

  // ── 4. Return minimal fields ──────────────────────────────────────────────
  // "inactive" = no subscription row; we map this to status "free" for the UI
  // so the page can display a more informative label if desired.
  const rawStatus = ent.status === "inactive" ? "free" : ent.status;

  const response: BillingStatusResponse = {
    status:               rawStatus,
    hasActiveSubscription: ACTIVE_STATUSES.has(ent.status),
    planKey:              ent.subscription?.plan_slug ?? undefined,
  };

  return NextResponse.json(response);
}
