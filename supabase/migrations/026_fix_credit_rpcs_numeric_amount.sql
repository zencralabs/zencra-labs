-- Migration 026: Fix spend_credits and refund_credits to accept NUMERIC amounts
--
-- Root cause: spend_credits(p_amount INTEGER) received fractional values from
-- the credit estimator (e.g. 0.5 from getConceptingCost, 1.5/2.5/6.5 from
-- computeTotalGenerationCost) causing a PostgreSQL type error via PostgREST.
--
-- Fix: Drop old INTEGER-signature functions, recreate with NUMERIC(10,2).
-- Internal CEIL() converts to INTEGER before updating the profiles.credits column.
-- This means fractional costs always round UP (0.5 → 1 credit charged).

-- Drop old INTEGER signatures
DROP FUNCTION IF EXISTS public.spend_credits(uuid, integer, text, uuid);
DROP FUNCTION IF EXISTS public.refund_credits(uuid, integer, text, uuid);

-- Recreate spend_credits with NUMERIC(10,2) amount
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id       UUID,
  p_amount        NUMERIC(10,2),
  p_description   TEXT,
  p_generation_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount_int      INTEGER;
  v_current_credits INTEGER;
  v_new_balance     INTEGER;
BEGIN
  -- Round fractional credits UP to nearest integer
  v_amount_int := CEIL(p_amount);

  SELECT credits INTO v_current_credits
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'User profile not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_credits < v_amount_int THEN
    RETURN QUERY SELECT
      FALSE,
      v_current_credits,
      format('Insufficient credits: need %s, have %s', v_amount_int, v_current_credits)::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_credits - v_amount_int;

  UPDATE public.profiles
  SET credits    = v_new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id, type, amount, balance_after, description, metadata
  ) VALUES (
    p_user_id,
    'spend',
    -v_amount_int,
    v_new_balance,
    p_description,
    CASE
      WHEN p_generation_id IS NOT NULL
        THEN jsonb_build_object('generation_id', p_generation_id)
      ELSE '{}'::jsonb
    END
  );

  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;

-- Recreate refund_credits with NUMERIC(10,2) amount (symmetric with spend)
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id       UUID,
  p_amount        NUMERIC(10,2),
  p_description   TEXT,
  p_generation_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount_int  INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Round fractional refund UP to nearest integer (symmetric with spend)
  v_amount_int := CEIL(p_amount);

  UPDATE public.profiles
  SET credits    = credits + v_amount_int,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING credits INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'User profile not found'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.credit_transactions (
    user_id, type, amount, balance_after, description, metadata
  ) VALUES (
    p_user_id,
    'refund',
    +v_amount_int,
    v_new_balance,
    p_description,
    CASE
      WHEN p_generation_id IS NOT NULL
        THEN jsonb_build_object('generation_id', p_generation_id)
      ELSE '{}'::jsonb
    END
  );

  RETURN QUERY SELECT TRUE, v_new_balance, NULL::TEXT;
END;
$$;
