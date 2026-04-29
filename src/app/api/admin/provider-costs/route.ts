/**
 * GET /api/admin/provider-costs
 *
 * Returns all provider_accounts rows enriched with current-month
 * generation stats from provider_cost_log.
 *
 * Admin-only. No user billing data is exposed.
 *
 * Response 200:
 * {
 *   success: true,
 *   providers: ProviderCostSummary[],
 *   monthLabel: string,   // e.g. "April 2026"
 * }
 *
 * ProviderCostSummary:
 * {
 *   providerKey, displayName, billingType, currency,
 *   currentBalance, balanceUnit,
 *   quotaUsed, quotaTotal, quotaResetDate,
 *   lowBalanceThreshold, balanceSyncedAt, syncMethod,
 *   notes, isActive,
 *   // Current month aggregates from provider_cost_log:
 *   monthlyGenerations, monthlyEstimatedUsd,
 *   monthlySuccessCount, monthlyFailedCount,
 * }
 */

import type { NextRequest }  from "next/server";
import { NextResponse }      from "next/server";
import { requireAuthUser }   from "@/lib/supabase/server";
import { supabaseAdmin }     from "@/lib/supabase/admin";
import { unauthorized }      from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProviderCostSummary {
  providerKey:          string;
  displayName:          string;
  billingType:          string;
  currency:             string;
  currentBalance:       number | null;
  balanceUnit:          string | null;
  quotaUsed:            number | null;
  quotaTotal:           number | null;
  quotaResetDate:       string | null;
  lowBalanceThreshold:  number | null;
  balanceSyncedAt:      string | null;
  syncMethod:           string;
  notes:                string | null;
  isActive:             boolean;
  // Monthly aggregates
  monthlyGenerations:   number;
  monthlyEstimatedUsd:  number;
  monthlySuccessCount:  number;
  monthlyFailedCount:   number;
}

export async function GET(req: NextRequest): Promise<Response> {
  // ── Admin auth check ────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? unauthorized();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  // ── Build current-month date range ──────────────────────────────────────────
  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  // ── Fetch provider_accounts ──────────────────────────────────────────────────
  const { data: accounts, error: accountsErr } = await supabaseAdmin
    .from("provider_accounts")
    .select("*")
    .order("display_name", { ascending: true });

  if (accountsErr) {
    return NextResponse.json({ success: false, error: accountsErr.message }, { status: 500 });
  }

  // ── Fetch current-month aggregates from provider_cost_log ───────────────────
  const { data: costRows, error: costErr } = await supabaseAdmin
    .from("provider_cost_log")
    .select("provider_key, status, provider_cost_usd")
    .gte("recorded_at", monthStart)
    .lte("recorded_at", monthEnd);

  if (costErr) {
    console.error("[GET /api/admin/provider-costs] cost log query failed:", costErr.message);
    // Non-fatal — return accounts with zero aggregates
  }

  // Aggregate by provider_key
  type Agg = { total: number; usd: number; success: number; failed: number };
  const agg: Record<string, Agg> = {};

  for (const row of (costRows ?? [])) {
    const key = row.provider_key as string;
    if (!agg[key]) agg[key] = { total: 0, usd: 0, success: 0, failed: 0 };
    agg[key].total++;
    agg[key].usd += (row.provider_cost_usd as number | null) ?? 0;
    if (row.status === "success") agg[key].success++;
    else                          agg[key].failed++;
  }

  // ── Merge into response ─────────────────────────────────────────────────────
  const providers: ProviderCostSummary[] = (accounts ?? []).map((a) => {
    const m = agg[a.provider_key as string] ?? { total: 0, usd: 0, success: 0, failed: 0 };
    return {
      providerKey:         a.provider_key         as string,
      displayName:         a.display_name         as string,
      billingType:         a.billing_type         as string,
      currency:            a.currency             as string,
      currentBalance:      a.current_balance      as number | null,
      balanceUnit:         a.balance_unit         as string | null,
      quotaUsed:           a.quota_used           as number | null,
      quotaTotal:          a.quota_total          as number | null,
      quotaResetDate:      a.quota_reset_date     as string | null,
      lowBalanceThreshold: a.low_balance_threshold as number | null,
      balanceSyncedAt:     a.balance_synced_at    as string | null,
      syncMethod:          (a.sync_method         as string) ?? "manual",
      notes:               a.notes               as string | null,
      isActive:            a.is_active            as boolean,
      monthlyGenerations:  m.total,
      monthlyEstimatedUsd: parseFloat(m.usd.toFixed(4)),
      monthlySuccessCount: m.success,
      monthlyFailedCount:  m.failed,
    };
  });

  return NextResponse.json({ success: true, providers, monthLabel });
}
