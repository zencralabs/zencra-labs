-- ============================================================
-- RPC: refund_credits
-- Atomically adds credits back to a user's profile and logs
-- the refund in credit_transactions.
--
-- Used when an AI generation fails after credits were deducted.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id       UUID,
  p_amount        INTEGER,
  p_description   TEXT,
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
  -- Lock the profile row to prevent concurrent updates
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
    user_id,
    type,
    amount,
    balance_after,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'refund',
    p_amount,                    -- positive = credits returned
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

GRANT EXECUTE ON FUNCTION public.refund_credits TO service_role;
