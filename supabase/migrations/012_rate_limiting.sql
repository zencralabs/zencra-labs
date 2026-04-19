-- ──────────────────────────────────────────────────────────────────────────────
-- 012_rate_limiting.sql
--
-- Supabase-native rate limiting infrastructure.
-- Provides a sliding-window counter table and an atomic RPC used by:
--   - Studio generate routes  (15 req / 60s  per user)
--   - Auth routes             (5 req  / 600s per IP)
--
-- No external Redis or dependencies required.
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Rate limit buckets ────────────────────────────────────────────────────────
-- Each row represents one (key, window) pair.
-- The service role (supabaseAdmin) is the only caller — no RLS needed.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key           TEXT        NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  count         INTEGER     NOT NULL DEFAULT 1,
  expires_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY   (key, window_start)
);

-- Index for periodic expired-row cleanup (run DELETE WHERE expires_at < now() as cron)
CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_at_idx
  ON public.rate_limit_buckets (expires_at);

-- ── Atomic rate limit check + increment ───────────────────────────────────────
--
-- Increments the counter for (p_key, current_window) atomically.
-- Returns TRUE  → request is within the allowed limit.
-- Returns FALSE → limit exceeded; caller should return 429.
--
-- p_key       : unique identifier for the rate limit bucket
--               e.g. "studio:<userId>" or "auth:<ip>"
-- p_window_s  : window size in seconds (e.g. 60 for 1 min, 600 for 10 min)
-- p_max_req   : maximum allowed requests in the window

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key       TEXT,
  p_window_s  INTEGER,
  p_max_req   INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  -- Compute fixed window boundary (floor to nearest window_s interval)
  v_window_start := to_timestamp(
    floor(EXTRACT(EPOCH FROM now()) / p_window_s) * p_window_s
  );

  -- Atomic upsert: insert new bucket or increment existing count
  INSERT INTO public.rate_limit_buckets (key, window_start, count, expires_at)
  VALUES (
    p_key,
    v_window_start,
    1,
    v_window_start + (p_window_s * 2 || ' seconds')::INTERVAL
  )
  ON CONFLICT (key, window_start) DO UPDATE
    SET count = rate_limit_buckets.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_req;
END;
$$;
