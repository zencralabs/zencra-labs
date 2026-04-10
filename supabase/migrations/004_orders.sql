-- ============================================================
-- Migration 004: orders
--
-- Central billing record. Tracks both payment state and
-- fulfillment state as separate axes:
--
--   status           = did the payment provider confirm money moved?
--   fulfillment_state = did we successfully add credits + log it?
--
-- They can diverge: payment = paid, fulfillment = failed
-- means we owe the user credits and can safely retry fulfillment
-- without re-charging them.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

-- Payment lifecycle from provider's perspective
CREATE TYPE public.order_status AS ENUM (
  'created',    -- order row exists, provider order created, awaiting payment
  'pending',    -- payment initiated by user (modal opened, redirect started)
  'paid',       -- provider confirmed payment captured
  'failed',     -- payment failed or was declined
  'expired',    -- order expired before payment (Razorpay orders expire in 15 min by default)
  'refunded'    -- payment was refunded
);

-- Credit fulfillment state — independent of payment status
CREATE TYPE public.fulfillment_state AS ENUM (
  'pending',    -- credits not yet granted
  'fulfilled',  -- credits successfully added to profile + logged in credit_transactions
  'failed'      -- fulfillment attempted but errored (retry-safe via fulfill_order RPC)
);

-- Supported billing providers
CREATE TYPE public.billing_provider AS ENUM (
  'razorpay',
  'stripe',
  'crypto'
);

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orders (
  id                   UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID                    NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  credit_pack_id       UUID                    REFERENCES public.credit_packs(id) ON DELETE RESTRICT,

  -- Provider identity
  provider             public.billing_provider NOT NULL,
  provider_order_id    TEXT                    NOT NULL UNIQUE,   -- Razorpay order_id / Stripe pi_...
  provider_payment_id  TEXT,                                      -- set on confirmed payment

  -- Financials — locked at order creation time, never recalculated
  amount_cents         INTEGER                 NOT NULL CHECK (amount_cents > 0),
  currency             TEXT                    NOT NULL DEFAULT 'usd',
  credits_to_grant     INTEGER                 NOT NULL CHECK (credits_to_grant > 0),

  -- State
  status               public.order_status     NOT NULL DEFAULT 'created',
  fulfillment_state    public.fulfillment_state NOT NULL DEFAULT 'pending',

  -- Idempotency key supplied by the client — prevents double-orders on retry
  -- Format recommendation: "<userId>-<packId>-<timestamp-ms>"
  idempotency_key      TEXT                    UNIQUE,

  -- Fulfillment metadata
  fulfilled_at         TIMESTAMPTZ,

  -- Timestamps
  created_at           TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Most common query: all orders for a user (dashboard history)
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders (user_id, created_at DESC);

-- Webhook handlers look up order by provider_order_id
CREATE INDEX IF NOT EXISTS idx_orders_provider_order_id
  ON public.orders (provider_order_id);

-- Background job to find unfulfilled paid orders (retry queue)
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_pending
  ON public.orders (fulfillment_state, status)
  WHERE fulfillment_state = 'pending' AND status = 'paid';

-- ── Triggers ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can only read their own orders
CREATE POLICY "orders_user_read_own"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE from client — all writes go through service role
-- (API routes use supabaseAdmin which bypasses RLS)
GRANT SELECT, INSERT, UPDATE ON public.orders TO service_role;
