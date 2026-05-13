/**
 * GET /api/admin/security-summary
 *
 * S4-C: Aggregate security signal summary for the /hub Security Monitor panel.
 * Admin-only — guarded by requireAdmin.
 *
 * Returns pre-computed aggregates from security_events_log for the last 24 hours:
 *   rateLimitHits        — count of RATE_LIMITED events (velocity.* rules)
 *   concurrentCapHits    — count of CONCURRENT_LIMIT events (job.queue.depth_warning)
 *   webhookAnomalies     — count of webhook.* rule events
 *   topUsers             — top 5 users by total event count (userId + count)
 *   ruleBreakdown        — count per rule, descending
 *   providerCircuitEvents — latest provider.circuit.* event per provider key
 *
 * No RPCs needed — all aggregation done client-side from simple Supabase queries.
 * Zero schema changes — queries the existing security_events_log table.
 *
 * Response 200:
 *   { success: true, data: SecuritySummary }
 *
 * Response 403:
 *   { success: false, error: "Forbidden" }
 */

import type { NextRequest } from "next/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { requireAdmin }     from "@/lib/auth/admin-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RuleCount {
  rule:  string;
  count: number;
}

interface UserCount {
  userId: string;
  count:  number;
}

interface ProviderCircuitEvent {
  providerKey: string;
  rule:        string;
  occurredAt:  string;
}

interface SecuritySummary {
  windowHours:           number;     // always 24
  rateLimitHits:         number;     // velocity.* rule events
  concurrentCapHits:     number;     // job.queue.depth_warning events
  webhookAnomalies:      number;     // webhook.* rule events
  totalEvents:           number;     // all events in window
  ruleBreakdown:         RuleCount[];
  topUsers:              UserCount[];
  providerCircuitEvents: ProviderCircuitEvent[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const { adminError } = await requireAdmin(req);
  if (adminError) return adminError;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ── Fetch all events in the 24h window ───────────────────────────────────
  // Pull the fields we need for aggregation in a single query.
  // security_events_log is expected to have low volume at this stage.
  // If row counts grow into the thousands, switch to Supabase RPC-based aggregation.
  const { data: rows, error } = await supabaseAdmin
    .from("security_events_log")
    .select("rule, user_id, provider_key, occurred_at")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(2000); // safety cap — enough for 24h summary at current scale

  if (error) {
    console.error("[admin/security-summary] query error:", error.message);
    return Response.json(
      { success: false, error: "Failed to query security summary" },
      { status: 500 }
    );
  }

  const events = rows ?? [];

  // ── Aggregate rule counts ─────────────────────────────────────────────────
  const ruleCounts = new Map<string, number>();
  let rateLimitHits     = 0;
  let concurrentCapHits = 0;
  let webhookAnomalies  = 0;

  for (const ev of events) {
    const rule: string = ev.rule ?? "unknown";
    ruleCounts.set(rule, (ruleCounts.get(rule) ?? 0) + 1);

    if (rule.startsWith("velocity."))           rateLimitHits++;
    if (rule === "job.queue.depth_warning")      concurrentCapHits++;
    if (rule.startsWith("webhook."))             webhookAnomalies++;
  }

  const ruleBreakdown: RuleCount[] = Array.from(ruleCounts.entries())
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count);

  // ── Top users by event count ──────────────────────────────────────────────
  const userCounts = new Map<string, number>();
  for (const ev of events) {
    if (ev.user_id) {
      userCounts.set(ev.user_id, (userCounts.get(ev.user_id) ?? 0) + 1);
    }
  }

  const topUsers: UserCount[] = Array.from(userCounts.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Latest provider circuit events (one per provider) ─────────────────────
  // events is already sorted newest-first.
  const seenProviders = new Set<string>();
  const providerCircuitEvents: ProviderCircuitEvent[] = [];

  for (const ev of events) {
    if (!String(ev.rule ?? "").startsWith("provider.circuit.")) continue;
    const pk = ev.provider_key as string | null;
    if (!pk || seenProviders.has(pk)) continue;
    seenProviders.add(pk);
    providerCircuitEvents.push({
      providerKey: pk,
      rule:        ev.rule as string,
      occurredAt:  ev.occurred_at as string,
    });
  }

  // ── Build summary ─────────────────────────────────────────────────────────
  const summary: SecuritySummary = {
    windowHours:           24,
    rateLimitHits,
    concurrentCapHits,
    webhookAnomalies,
    totalEvents:           events.length,
    ruleBreakdown,
    topUsers,
    providerCircuitEvents,
  };

  return Response.json({ success: true, data: summary });
}
