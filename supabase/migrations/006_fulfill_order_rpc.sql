-- ============================================================
-- Migration 006: fulfill_order RPC
--
-- The single safe path for granting credits after a verified
-- payment. Both the /api/billing/verify endpoint AND the
-- /api/webhooks/* handlers call this — never directly update
-- profiles or credit_transactions from application code.
--
-- Design guarantees:
--   • Idempotent — calling twice for the same order is safe;
--     the second call returns success without re-granting credits
--   • Atomic — credits, credit_transactions, and order state
--     all update in a single transaction; partial failure rolls back
--   • Race-safe — SELECT ... FOR UPDATE locks the order row,
--     so two concurrent webhook deliveries cannot both fulfill
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.fulfill_order(
  p_order_id           UUID,
  p_provider_payment_id TEXT
)
RETURNS TABLE (
  success       BOOLEAN,
  new_balance   INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order           RECORD;
  v_current_credits INTEGER;
  v_new_balance     INTEGER;
BEGIN
  -- ── 1. Lock the order row ─────────────────────────────────────────────────
  -- FOR UPDATE prevents two concurrent webhook deliveries from both
  -- entering the fulfillment block simultaneously.
  SELECT *
  INTO   v_order
  FROM   public.orders
  WHERE  id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, format('Order %s not found', p_order_id)::TEXT;
    RETURN;
  END IF;

  -- ── 2. Idempotency check ──────────────────────────────────────────────────
  -- If already fulfilled, return success without re-granting credits.
  -- This handles: Razorpay retrying the webhook, or both the verify
  -- endpoint and the webhook arriving within milliseconds of each other.
  IF v_order.fulfillment_state = 'fulfilled' THEN
    SELECT credits INTO v_current_credits
    FROM   public.profiles
    WHERE  id = v_order.user_id;

    RETURN QUERY SELECT TRUE, COALESCE(v_current_credits, 0), NULL::TEXT;
    RETURN;
  END IF;

  -- ── 3. Guard: order must be in a payable state ────────────────────────────
  -- We accept 'created' here too because the verify endpoint may call
  -- us before the status has been updated to 'pending'.
  IF v_order.status NOT IN ('created', 'pending', 'paid') THEN
    RETURN QUERY SELECT FALSE, 0,
      format('Cannot fulfill order in status: %s', v_order.status)::TEXT;
    RETURN;
  END IF;

  -- ── 4. Lock the profile row and read current balance ─────────────────────
  SELECT credits
  INTO   v_current_credits
  FROM   public.profiles
  WHERE  id = v_order.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'User profile not found'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_credits + v_order.credits_to_grant;

  -- ── 5. Grant credits ──────────────────────────────────────────────────────
  UPDATE public.profiles
  SET    credits    = v_new_balance,
         updated_at = NOW()
  WHERE  id = v_order.user_id;

  -- ── 6. Log in credit_transactions ─────────────────────────────────────────
  -- type = 'purchase' distinguishes top-ups from generations ('spend')
  -- and failed-generation reversals ('refund')
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    v_order.user_id,
    'purchase',
    v_order.credits_to_grant,          -- positive = credits added
    v_new_balance,
    format('Credit pack purchase — %s credits via %s',
           v_order.credits_to_grant, v_order.provider),
    jsonb_build_object(
      'order_id',            v_order.id,
      'provider',            v_order.provider,
      'provider_order_id',   v_order.provider_order_id,
      'provider_payment_id', p_provider_payment_id,
      'amount_cents',        v_order.amount_cents,
      'currency',            v_order.currency
    )
  );

  -- ── 7. Mark order fulfilled ───────────────────────────────────────────────
  UPDATE public.orders
  SET    status               = 'paid',
         fulfillment_state    = 'fulfilled',
         provider_payment_id  = p_provider_payment_id,
         fulfilled_at         = NOW(),
         updated_at           = NOW()
  WHERE  id = p_order_id;

  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- Grant execution to service role only — never called by anon/authenticated roles directly
GRANT EXECUTE ON FUNCTION public.fulfill_order TO service_role;

-- ── Companion: add_credits RPC ────────────────────────────────────────────────
-- A lighter utility for granting credits outside of a purchase flow
-- (e.g. welcome bonus, promotional top-ups, manual admin grants).
-- Does NOT touch the orders table.

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_description TEXT,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS TABLE (
  success       BOOLEAN,
  new_balance   INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance     INTEGER;
BEGIN
  SELECT credits
  INTO   v_current_credits
  FROM   public.profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'User profile not found'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_credits + p_amount;

  UPDATE public.profiles
  SET    credits    = v_new_balance,
         updated_at = NOW()
  WHERE  id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id, type, amount, balance_after, description, metadata
  ) VALUES (
    p_user_id, 'purchase', p_amount, v_new_balance, p_description, p_metadata
  );

  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_credits TO service_role;
