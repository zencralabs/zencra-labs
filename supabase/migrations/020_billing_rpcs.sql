-- ──────────────────────────────────────────────────────────────────────────────
-- 020_billing_rpcs.sql
--
-- Core billing RPCs:
--   get_user_entitlement(p_user_id)   — full billing state in one call
--   grant_cycle_credits(p_sub_id)     — called by payment webhook on confirmed payment
--
-- Both are SECURITY DEFINER — called via supabaseAdmin (service role).
-- Idempotent: safe to re-run (CREATE OR REPLACE).
-- ──────────────────────────────────────────────────────────────────────────────

-- ── get_user_entitlement ──────────────────────────────────────────────────────
-- Returns the user's full billing state in a single DB round-trip.
-- Used by: entitlement checks on every generation, user dashboard, admin.
--
-- Resolves billing identity:
--   - If the user is a Business seat member, returns the owner's subscription.
--   - billingUserId is the owner whose credits are debited.
--
-- Returns JSONB with shape:
--   {
--     status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired',
--     billing_user_id: UUID,
--     is_team_member: bool,
--     subscription: { id, plan_slug, plan_name, credits_per_cycle, fcs_allowed,
--                     team_enabled, max_users, interval, amount_cents,
--                     current_period_end, trial_ends_at, cancel_at_period_end },
--     fcs_active: bool,
--     credits: int,
--     trial: { images_used, images_max, videos_used, videos_max,
--              audio_used, audio_max, trial_ends_at } | null
--   }

CREATE OR REPLACE FUNCTION public.get_user_entitlement(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_billing_user_id UUID;
  v_seat_owner_id   UUID;
  v_is_team_member  BOOLEAN := false;
  v_sub             RECORD;
  v_trial           RECORD;
  v_fcs_active      BOOLEAN := false;
  v_credits         INTEGER := 0;
BEGIN
  -- Resolve billing identity: check if user is an active Business seat member
  SELECT s.user_id INTO v_seat_owner_id
  FROM public.subscription_seats ss
  JOIN public.subscriptions s ON s.id = ss.subscription_id
  WHERE ss.user_id = p_user_id
    AND ss.status  = 'active'
  LIMIT 1;

  IF v_seat_owner_id IS NOT NULL THEN
    v_billing_user_id := v_seat_owner_id;
    v_is_team_member  := true;
  ELSE
    v_billing_user_id := p_user_id;
  END IF;

  -- Load active subscription for the billing entity
  SELECT
    s.id,
    s.status,
    s.trial_ends_at,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.provider,
    p.slug             AS plan_slug,
    p.name             AS plan_name,
    p.credits_per_cycle,
    p.fcs_allowed,
    p.team_enabled,
    p.max_users,
    pp.interval        AS billing_interval,
    pp.amount_cents
  INTO v_sub
  FROM public.subscriptions s
  JOIN public.plans       p  ON p.id  = s.plan_id
  JOIN public.plan_prices pp ON pp.id = s.price_id
  WHERE s.user_id = v_billing_user_id
    AND s.status  IN ('trialing', 'active', 'past_due')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status',           'inactive',
      'billing_user_id',  v_billing_user_id,
      'is_team_member',   v_is_team_member
    );
  END IF;

  -- Check for active FCS addon
  SELECT EXISTS (
    SELECT 1
    FROM public.subscription_addons sa
    WHERE sa.subscription_id = v_sub.id
      AND sa.status          = 'active'
  ) INTO v_fcs_active;

  -- Get credit balance of billing entity (shared pool owner)
  SELECT credits INTO v_credits
  FROM public.profiles
  WHERE id = v_billing_user_id;

  v_credits := COALESCE(v_credits, 0);

  -- Load trial usage only for trialing subscriptions (per original user, not owner)
  IF v_sub.status = 'trialing' THEN
    SELECT * INTO v_trial
    FROM public.trial_usage
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'status',           v_sub.status,
    'billing_user_id',  v_billing_user_id,
    'is_team_member',   v_is_team_member,
    'subscription', jsonb_build_object(
      'id',                   v_sub.id,
      'plan_slug',            v_sub.plan_slug,
      'plan_name',            v_sub.plan_name,
      'credits_per_cycle',    v_sub.credits_per_cycle,
      'fcs_allowed',          v_sub.fcs_allowed,
      'team_enabled',         v_sub.team_enabled,
      'max_users',            v_sub.max_users,
      'interval',             v_sub.billing_interval,
      'amount_cents',         v_sub.amount_cents,
      'current_period_end',   v_sub.current_period_end,
      'trial_ends_at',        v_sub.trial_ends_at,
      'cancel_at_period_end', v_sub.cancel_at_period_end
    ),
    'fcs_active',       v_fcs_active,
    'credits',          v_credits,
    'trial', CASE
      WHEN v_sub.status = 'trialing' AND v_trial.user_id IS NOT NULL THEN
        jsonb_build_object(
          'images_used',   v_trial.images_used,
          'images_max',    v_trial.images_max,
          'videos_used',   v_trial.videos_used,
          'videos_max',    v_trial.videos_max,
          'audio_used',    v_trial.audio_used,
          'audio_max',     v_trial.audio_max,
          'trial_ends_at', v_trial.trial_ends_at
        )
      ELSE NULL
    END
  );
END;
$$;


-- ── grant_cycle_credits ───────────────────────────────────────────────────────
-- Called by the payment webhook on every confirmed billing cycle payment.
-- Grants plan base credits + any active FCS addon credits to the owner's balance.
-- Uses the existing refund_credits RPC for atomic credit addition.
--
-- p_subscription_id: the subscription whose cycle has been confirmed paid.
--
-- Returns JSONB:
--   { success: true,  user_id, credits_granted, base, addon }
--   { success: false, error: 'SUBSCRIPTION_NOT_FOUND' | 'GRANT_FAILED' }

CREATE OR REPLACE FUNCTION public.grant_cycle_credits(p_subscription_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id      UUID;
  v_plan_credits  INTEGER;
  v_addon_credits INTEGER := 0;
  v_total         INTEGER;
  v_rpc_error     TEXT;
BEGIN
  -- Load subscription owner and plan credits
  SELECT s.user_id, p.credits_per_cycle
  INTO   v_owner_id, v_plan_credits
  FROM   public.subscriptions s
  JOIN   public.plans p ON p.id = s.plan_id
  WHERE  s.id = p_subscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SUBSCRIPTION_NOT_FOUND');
  END IF;

  -- Add active FCS addon credits if present
  SELECT COALESCE(a.credits_granted, 0)
  INTO   v_addon_credits
  FROM   public.subscription_addons sa
  JOIN   public.addons a ON a.id = sa.addon_id
  WHERE  sa.subscription_id = p_subscription_id
    AND  sa.status          = 'active'
  LIMIT 1;

  v_addon_credits := COALESCE(v_addon_credits, 0);
  v_total         := v_plan_credits + v_addon_credits;

  -- Grant via existing atomic refund_credits RPC
  BEGIN
    PERFORM public.refund_credits(
      v_owner_id,
      v_total,
      'Billing cycle credit grant — plan: ' || v_plan_credits ||
      CASE WHEN v_addon_credits > 0 THEN ', FCS addon: ' || v_addon_credits ELSE '' END
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_rpc_error = MESSAGE_TEXT;
    RETURN jsonb_build_object('success', false, 'error', 'GRANT_FAILED: ' || v_rpc_error);
  END;

  RETURN jsonb_build_object(
    'success',         true,
    'user_id',         v_owner_id,
    'credits_granted', v_total,
    'base',            v_plan_credits,
    'addon',           v_addon_credits
  );
END;
$$;
