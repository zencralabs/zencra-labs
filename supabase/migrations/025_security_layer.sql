-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025 — Phase 2A Security Layer
--
-- Adds:
--   1. request_logs        — lightweight audit trail for all studio generations
--   2. generation_idempotency — dedup table preventing double-charge on retry
--   3. UNIQUE constraint on assets.external_job_id — prevent duplicate webhook logging
--   4. Index on rate_limit_buckets(key) — IP-keyed entries need fast lookup
--
-- Note: credit_transactions already has a unique constraint via its PK.
-- Idempotency is tracked separately in generation_idempotency so it can
-- be checked BEFORE a credit transaction is created.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REQUEST LOGS
--    One row per studio generation attempt (success OR failure).
--    Kept lean — no request bodies, no prompts (prompts live in assets table).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.request_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ip            text,
  route         text        NOT NULL,
  model_key     text,
  studio        text,
  status        text        NOT NULL CHECK (status IN ('success', 'failed', 'rate_limited', 'invalid')),
  credits_used  int,
  provider_cost numeric(12,6),
  asset_id      uuid,
  error_code    text,
  duration_ms   int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by user (dashboard history, abuse review)
CREATE INDEX IF NOT EXISTS request_logs_user_id_idx   ON public.request_logs (user_id, created_at DESC);
-- Fast lookup by IP (abuse detection, rate limit review)
CREATE INDEX IF NOT EXISTS request_logs_ip_idx        ON public.request_logs (ip, created_at DESC);
-- TTL-style pruning index (delete rows older than N days)
CREATE INDEX IF NOT EXISTS request_logs_created_at_idx ON public.request_logs (created_at);

-- RLS: service role only (no client access)
ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_request_logs"
  ON public.request_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GENERATION IDEMPOTENCY
--    Prevents double-charges when clients retry on timeout or network error.
--    Key: SHA256(userId + modelKey + prompt + roundedTimestamp)
--    TTL: 5 minutes (window in which a retry is considered a duplicate)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.generation_idempotency (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text        NOT NULL UNIQUE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id        uuid,                    -- filled once generation completes
  job_id          text,                    -- filled once dispatched
  status          text        NOT NULL DEFAULT 'processing'
                              CHECK (status IN ('processing', 'completed', 'failed')),
  result_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);

-- Fast key lookup (the hot path: check-before-process)
CREATE INDEX IF NOT EXISTS gen_idempotency_key_idx
  ON public.generation_idempotency (idempotency_key)
  WHERE expires_at > now();

-- TTL cleanup index
CREATE INDEX IF NOT EXISTS gen_idempotency_expires_idx
  ON public.generation_idempotency (expires_at);

-- RLS: users can only read their own rows; inserts/updates via service role
ALTER TABLE public.generation_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_idempotency"
  ON public.generation_idempotency
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "service_role_all_idempotency"
  ON public.generation_idempotency
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ASSETS — UNIQUE constraint on external_job_id
--    Prevents duplicate provider callbacks from logging cost twice.
--    Uses a partial index so NULL values (sync jobs) are not constrained.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS assets_external_job_id_unique
  ON public.assets (external_job_id)
  WHERE external_job_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RATE LIMIT BUCKETS — additional index for IP-keyed entries
--    The existing table uses a text `key` column.
--    IP-keyed entries use pattern: ip:{ip}:{route}
--    The existing key index covers this — no schema change needed.
--    This migration adds a partial index for faster IP key lookups.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS rate_limit_ip_keys_idx
  ON public.rate_limit_buckets (key)
  WHERE key LIKE 'ip:%';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CLEANUP FUNCTION for idempotency table (call from a cron or manually)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.generation_idempotency
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
