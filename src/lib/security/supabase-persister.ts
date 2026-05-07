/**
 * src/lib/security/supabase-persister.ts
 *
 * Zencra Shield — Supabase persistence consumer.
 *
 * Writes SecurityEvents to the `security_events_log` table.
 * Uses the service role key (supabaseAdmin) — the table has no RLS
 * and is insert-only (no UPDATE/DELETE policies).
 *
 * Design:
 *   - Never throws — caller catches all errors.
 *   - Silent-fail on DB error: security persistence failure must
 *     NEVER fail an end-user request or break a producer.
 *   - Row is fully self-contained: all context is denormalised into
 *     the row so forensic analysis needs no joins.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { logger }        from "@/lib/logger";
import type { SecurityEvent, ShieldMode } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Row shape — maps to security_events_log table columns
// ─────────────────────────────────────────────────────────────────────────────

interface SecurityEventRow {
  rule:              string;
  severity:          string;
  mode:              string;
  action_taken:      string;
  action_reason:     string;
  threshold_metric:  string;
  threshold_configured: number;
  threshold_observed:   number;
  threshold_unit:    string | null;
  user_id:           string | null;
  admin_user_id:     string | null;
  provider_key:      string | null;
  event_context:     Record<string, unknown>;
  occurred_at:       string;
}

function buildRow(event: SecurityEvent, mode: ShieldMode): SecurityEventRow {
  // Extract typed optional fields safely
  const userId      = "userId"      in event ? (event.userId      ?? null) : null;
  const adminUserId = "adminUserId" in event ? (event.adminUserId ?? null) : null;
  const providerKey = "providerKey" in event ? (event.providerKey ?? null) : null;

  // Store rule-specific fields in event_context (JSONB) for queryability
  const eventContext: Record<string, unknown> = {};

  if ("windowCounts"  in event) eventContext.windowCounts  = event.windowCounts;
  if ("riskTier"      in event) eventContext.riskTier      = event.riskTier;
  if ("creditsUsed"   in event) eventContext.creditsUsed   = event.creditsUsed;
  if ("creditsBalance" in event) eventContext.creditsBalance = event.creditsBalance;
  if ("planId"        in event) eventContext.planId        = event.planId;
  if ("errorRatePct"  in event) eventContext.errorRatePct  = event.errorRatePct;
  if ("windowSeconds" in event) eventContext.windowSeconds = event.windowSeconds;
  if ("targetRoute"   in event) eventContext.targetRoute   = event.targetRoute;
  if ("actionMeta"    in event) eventContext.actionMeta    = event.actionMeta;
  if ("featureKey"    in event) eventContext.featureKey    = event.featureKey;
  if ("requiredPlan"  in event) eventContext.requiredPlan  = event.requiredPlan;
  if ("jobId"         in event) eventContext.jobId         = event.jobId;
  if ("queueDepth"    in event) eventContext.queueDepth    = event.queueDepth;
  if ("staleAgeMs"    in event) eventContext.staleAgeMs    = event.staleAgeMs;

  return {
    rule:                 event.rule,
    severity:             event.severity,
    mode,
    action_taken:         event.actionTaken,
    action_reason:        event.actionReason,
    threshold_metric:     event.threshold.metric,
    threshold_configured: event.threshold.configuredValue,
    threshold_observed:   event.threshold.observedValue,
    threshold_unit:       event.threshold.unit ?? null,
    user_id:              userId,
    admin_user_id:        adminUserId,
    provider_key:         providerKey,
    event_context:        eventContext,
    occurred_at:          event.timestamp ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * persistSecurityEvent
 *
 * Inserts the security event into `security_events_log`.
 * Silent-fail: logs a warning on DB error but never throws.
 *
 * Called by the Event Bus (events.ts) in observe + enforce modes.
 * Do not call directly from producers — use emitSecurityEvent() instead.
 */
export async function persistSecurityEvent(
  event: SecurityEvent,
  mode:  ShieldMode,
): Promise<void> {
  try {
    const row = buildRow(event, mode);

    const { error } = await supabaseAdmin
      .from("security_events_log")
      .insert(row);

    if (error) {
      logger.warn("shield/supabase", "Failed to persist security event", {
        rule:    event.rule,
        message: error.message,
      });
    }
  } catch (err) {
    logger.warn("shield/supabase", "persistSecurityEvent threw unexpectedly", {
      error: String(err),
      rule:  event.rule,
    });
  }
}
