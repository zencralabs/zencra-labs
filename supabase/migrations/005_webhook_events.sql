-- ============================================================
-- Migration 005: webhook_events
--
-- Raw inbound webhook log. Written BEFORE any processing logic
-- runs so we always have the original payload regardless of
-- whether the handler crashed, timed out, or was retried.
--
-- Serves three purposes:
--   1. Audit trail — full payload preserved forever
--   2. Replay — re-process an event by re-running the handler
--      against the stored payload without hitting the provider
--   3. Dedup — check provider_event_id to avoid processing
--      the same event twice if the provider retries delivery
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which provider sent this
  provider          public.billing_provider NOT NULL,

  -- Provider's own event identifier (e.g. Razorpay: pay_..., Stripe: evt_...)
  -- UNIQUE constraint provides dedup — inserting same event_id twice is a no-op
  provider_event_id TEXT                    NOT NULL,

  -- Human-readable event name (e.g. "payment.captured", "payment_intent.succeeded")
  event_type        TEXT                    NOT NULL,

  -- Full raw payload from the provider
  payload           JSONB                   NOT NULL DEFAULT '{}',

  -- Linked order, if we were able to match it
  order_id          UUID                    REFERENCES public.orders(id) ON DELETE SET NULL,

  -- Handler outcome
  processed         BOOLEAN                 NOT NULL DEFAULT FALSE,
  error             TEXT,                                              -- populated if handler threw

  created_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- ── Unique constraint ─────────────────────────────────────────────────────────
-- Prevents logging + processing the same webhook event twice.
-- Razorpay and Stripe both guarantee unique event IDs per delivery attempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id
  ON public.webhook_events (provider, provider_event_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Look up all events for an order (debugging)
CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id
  ON public.webhook_events (order_id)
  WHERE order_id IS NOT NULL;

-- Find unprocessed events (retry queue / monitoring)
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
  ON public.webhook_events (provider, created_at)
  WHERE processed = FALSE;

-- ── RLS ───────────────────────────────────────────────────────────────────────

-- Webhook events are internal — no client access
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- No client policies — only service role reads/writes
GRANT SELECT, INSERT, UPDATE ON public.webhook_events TO service_role;
