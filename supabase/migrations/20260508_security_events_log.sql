-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: security_events_log
-- Date:      2026-05-08
-- Purpose:   Insert-only log for all Zencra Shield security events.
--
-- Design decisions:
--   - Fully denormalised: every row is self-contained — no joins needed to
--     understand what happened, who was affected, and what the system did.
--   - No UPDATE or DELETE policies — rows are immutable event records.
--   - service role only — no client-side access of any kind.
--   - Threshold context stored as columns (not only JSONB) to enable efficient
--     queries like "all critical-threshold exceedances in the last 24h".
--   - event_context JSONB captures rule-specific fields (velocity windows,
--     circuit breaker state, provider error rates, etc.) without schema sprawl.
--   - Partitioning NOT applied at this scale — revisit at 10M+ rows/month.
--
-- Retention:
--   No automated retention policy yet. TODO: add pg_cron job to delete rows
--   older than 90 days once row volume is understood (Phase B).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_events_log (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Rule identification ─────────────────────────────────────────────────────
  rule                  text        NOT NULL,   -- e.g. "velocity.user.critical_5min"
  severity              text        NOT NULL    -- "info" | "warning" | "critical"
    CHECK (severity IN ('info', 'warning', 'critical')),

  -- ── Shield mode at time of event ───────────────────────────────────────────
  mode                  text        NOT NULL    -- "dry-run" | "observe" | "enforce"
    CHECK (mode IN ('dry-run', 'observe', 'enforce')),

  -- ── Action ─────────────────────────────────────────────────────────────────
  action_taken          text        NOT NULL,   -- e.g. "alerted", "request_blocked"
  action_reason         text        NOT NULL,   -- human-readable explanation

  -- ── Threshold context (denormalised for efficient querying) ─────────────────
  threshold_metric      text        NOT NULL,   -- e.g. "requests_per_5min"
  threshold_configured  numeric     NOT NULL,   -- configured limit (e.g. 40)
  threshold_observed    numeric     NOT NULL,   -- observed value (e.g. 67)
  threshold_unit        text,                   -- optional unit (e.g. "req/5min")

  -- ── Subject identity (nullable — global events have no specific user) ───────
  user_id               uuid,                   -- affected user (null for provider events)
  admin_user_id         uuid,                   -- set for admin.* rules only
  provider_key          text,                   -- set for provider.* and webhook.* rules

  -- ── Rule-specific context (JSONB — avoids schema sprawl for varied rules) ───
  event_context         jsonb       NOT NULL DEFAULT '{}',

  -- ── Timestamp ──────────────────────────────────────────────────────────────
  occurred_at           timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Most common dashboard query: recent events by severity
CREATE INDEX IF NOT EXISTS idx_sec_events_severity_occurred
  ON public.security_events_log (severity, occurred_at DESC);

-- Query by rule category (prefix scan friendly)
CREATE INDEX IF NOT EXISTS idx_sec_events_rule_occurred
  ON public.security_events_log (rule, occurred_at DESC);

-- Per-user forensic queries
CREATE INDEX IF NOT EXISTS idx_sec_events_user_occurred
  ON public.security_events_log (user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

-- Per-provider forensic queries
CREATE INDEX IF NOT EXISTS idx_sec_events_provider_occurred
  ON public.security_events_log (provider_key, occurred_at DESC)
  WHERE provider_key IS NOT NULL;

-- Shield mode queries (finding dry-run vs enforce events for calibration)
CREATE INDEX IF NOT EXISTS idx_sec_events_mode_occurred
  ON public.security_events_log (mode, occurred_at DESC);

-- ── Row Level Security ───────────────────────────────────────────────────────

-- Enable RLS — no policies defined means NO access from client-side PostgREST.
-- The service role key bypasses RLS entirely (used in API routes and Edge Functions).
ALTER TABLE public.security_events_log ENABLE ROW LEVEL SECURITY;

-- ── Grants ───────────────────────────────────────────────────────────────────

-- Revoke all public/authenticated access — service-role-only table.
REVOKE ALL ON public.security_events_log FROM anon, authenticated;

-- ── Comment ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.security_events_log IS
  'Insert-only Zencra Shield event log. '
  'Every row represents one security event with fully denormalised context. '
  'Rows are immutable. No client-side access. Service role write-only from API routes.';

COMMENT ON COLUMN public.security_events_log.mode IS
  'Shield mode active when the event was emitted: dry-run | observe | enforce. '
  'Enables threshold calibration by comparing dry-run vs enforce event distributions.';

COMMENT ON COLUMN public.security_events_log.event_context IS
  'Rule-specific JSONB context: velocity window counts, circuit breaker state, '
  'provider error rates, credit balances, etc. Schema varies by rule.';
