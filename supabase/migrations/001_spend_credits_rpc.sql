-- ============================================================
-- RPC: spend_credits
-- Atomically deducts credits from a user's profile and logs
-- the transaction in credit_transactions.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id      UUID,
  p_amount       INTEGER,
  p_description  TEXT,
  p_generation_id UUID DEFAULT NULL
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
  -- Lock the profile row to prevent concurrent race conditions
  SELECT credits
  INTO   v_current_credits
  FROM   public.profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  -- User not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'User profile not found'::TEXT;
    RETURN;
  END IF;

  -- Insufficient credits
  IF v_current_credits < p_amount THEN
    RETURN QUERY SELECT FALSE, v_current_credits,
      format('Insufficient credits: need %s, have %s', p_amount, v_current_credits)::TEXT;
    RETURN;
  END IF;

  -- Deduct
  v_new_balance := v_current_credits - p_amount;

  UPDATE public.profiles
  SET    credits    = v_new_balance,
         updated_at = NOW()
  WHERE  id = p_user_id;

  -- Log the transaction
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'spend',
    -p_amount,                   -- negative = spent
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

-- Grant execution to service role (used by our API)
GRANT EXECUTE ON FUNCTION public.spend_credits TO service_role;
