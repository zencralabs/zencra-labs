/**
 * GET /api/admin/security-events
 *
 * S4-C: Filterable list of Shield security events from security_events_log.
 * Admin-only — guarded by requireAdmin.
 *
 * Query params:
 *   rule       — filter to a specific SecurityRule value (optional)
 *   severity   — "info" | "warning" | "critical" (optional)
 *   userId     — filter to a specific user UUID (optional)
 *   startTime  — ISO timestamp lower bound on occurred_at (optional)
 *   endTime    — ISO timestamp upper bound on occurred_at (optional)
 *   limit      — max rows returned, default 100, max 500 (optional)
 *   offset     — pagination offset, default 0 (optional)
 *
 * Response 200:
 *   { success: true, data: { events: SecurityEventRow[], total: number } }
 *
 * Response 403:
 *   { success: false, error: "Forbidden" }
 */

import type { NextRequest }  from "next/server";
import { supabaseAdmin }     from "@/lib/supabase/admin";
import { requireAdmin }      from "@/lib/auth/admin-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maximum rows returnable per request — prevents large payload abuse
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

export async function GET(req: NextRequest): Promise<Response> {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const { adminError } = await requireAdmin(req);
  if (adminError) return adminError;

  // ── Parse query params ────────────────────────────────────────────────────
  const { searchParams } = req.nextUrl;

  const rule      = searchParams.get("rule")      ?? undefined;
  const severity  = searchParams.get("severity")  ?? undefined;
  const userId    = searchParams.get("userId")    ?? undefined;
  const startTime = searchParams.get("startTime") ?? undefined;
  const endTime   = searchParams.get("endTime")   ?? undefined;

  const rawLimit  = parseInt(searchParams.get("limit")  ?? String(DEFAULT_LIMIT), 10);
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);

  const limit  = Math.min(isNaN(rawLimit)  ? DEFAULT_LIMIT : rawLimit,  MAX_LIMIT);
  const offset = isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);

  // ── Query security_events_log ─────────────────────────────────────────────
  let query = supabaseAdmin
    .from("security_events_log")
    .select(
      "id, rule, severity, mode, action_taken, action_reason, " +
      "threshold_metric, threshold_configured, threshold_observed, threshold_unit, " +
      "user_id, provider_key, event_context, occurred_at",
      { count: "exact" }
    )
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (rule)      query = query.eq("rule", rule);
  if (severity)  query = query.eq("severity", severity);
  if (userId)    query = query.eq("user_id", userId);
  if (startTime) query = query.gte("occurred_at", startTime);
  if (endTime)   query = query.lte("occurred_at", endTime);

  const { data: events, count, error } = await query;

  if (error) {
    console.error("[admin/security-events] query error:", error.message);
    return Response.json(
      { success: false, error: "Failed to query security events" },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    data: {
      events: events ?? [],
      total:  count  ?? 0,
      limit,
      offset,
    },
  });
}
