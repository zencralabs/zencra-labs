-- Migration: fix_get_user_entitlement_trial_json
--
-- Bug: get_user_entitlement() threw "record is not assigned yet" for users
-- with status = 'active' or 'past_due' who have no trial_usage row.
--
-- Root cause: v_trial is declared as RECORD but only assigned inside the
-- "IF v_sub.status = 'trialing'" block. The original RETURN expression
-- referenced v_trial.user_id (and other fields) directly — PL/pgSQL
-- cannot resolve field access on an uninitialized RECORD, even inside a
-- CASE WHEN branch that would never execute for non-trialing users.
--
-- Fix: replaced all v_trial.* field references in the RETURN with a
-- pre-built v_trial_json jsonb variable (default null). Field access on
-- v_trial is now fully contained inside the IF FOUND block where the
-- RECORD is guaranteed to be assigned. The RETURN simply includes the
-- pre-built variable — no RECORD fields are referenced there at all.
--
-- Behavioral change: none. trial is null for active/past_due/inactive
-- users (as it was always intended), and populated correctly for
-- trialing users who have a trial_usage row.

CREATE OR REPLACE FUNCTION public.get_user_entitlement(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_billing_user_id UUID;
  v_seat_owner_id   UUID;
  v_is_team_member  BOOLEAN := false;
  v_sub             RECORD;
  v_trial           RECORD;
  v_trial_json      jsonb   := null;
  v_fcs_active      BOOLEAN := false;
  v_credits         INTEGER := 0;
BEGIN
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

  SELECT
    s.id,
    s.status,
    s.trial_ends_at,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
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
      'status',          'inactive',
      'billing_user_id', v_billing_user_id,
      'is_team_member',  v_is_team_member
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subscription_addons sa
    WHERE sa.subscription_id = v_sub.id
      AND sa.status          = 'active'
  ) INTO v_fcs_active;

  SELECT credits INTO v_credits
  FROM public.profiles
  WHERE id = v_billing_user_id;

  v_credits := COALESCE(v_credits, 0);

  -- Build trial JSON only when trialing and a trial_usage row exists.
  -- v_trial field access is confined entirely inside this block so the
  -- RECORD is always assigned before any field is referenced.
  IF v_sub.status = 'trialing' THEN
    SELECT * INTO v_trial
    FROM public.trial_usage
    WHERE user_id = p_user_id;

    IF FOUND THEN
      v_trial_json := jsonb_build_object(
        'images_used',   v_trial.images_used,
        'images_max',    v_trial.images_max,
        'videos_used',   v_trial.videos_used,
        'videos_max',    v_trial.videos_max,
        'audio_used',    v_trial.audio_used,
        'audio_max',     v_trial.audio_max,
        'trial_ends_at', v_trial.trial_ends_at
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status',          v_sub.status,
    'billing_user_id', v_billing_user_id,
    'is_team_member',  v_is_team_member,
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
    'fcs_active', v_fcs_active,
    'credits',    v_credits,
    'trial',      v_trial_json
  );
END;
$function$;
