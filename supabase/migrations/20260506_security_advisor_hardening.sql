-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260506_security_advisor_hardening
--
-- Fixes 4 Supabase Security Advisor warning categories:
--
--   1. Function Search Path Mutable
--      Pins SET search_path = public on SECURITY DEFINER functions not yet
--      covered by migration 023 (which fixed check_rate_limit, consume_trial_usage,
--      get_user_entitlement, grant_cycle_credits, set_updated_at) or by 026
--      (spend_credits, refund_credits) or by 20260505 (consume_free_usage).
--
--   2. RLS Policy Always True
--      Drops the 3 policies on creative_directions, direction_refinements, and
--      direction_elements that were missing TO service_role and applied to ALL
--      roles (any authenticated user could read/write everyone's CD data).
--      Recreates them properly scoped.
--
--   3. Public Can Execute SECURITY DEFINER Function
--   4. Signed-In Users Can Execute SECURITY DEFINER Function
--      PostgreSQL grants EXECUTE to PUBLIC by default for every new function.
--      Revokes PUBLIC (covers anon + authenticated) and grants back to
--      service_role only. Trigger functions get revoke only — the trigger
--      mechanism does not check EXECUTE privilege, so revoke is safe.
--
-- Safety notes:
--   • All billing/credit RPCs are called exclusively via supabaseAdmin.rpc()
--     in Next.js API routes — no client-side direct calls exist.
--   • ALTER FUNCTION … SET search_path only updates the function GUC config;
--     it does not touch the function body, signature, or return type.
--   • DROP POLICY IF EXISTS is safe — recreating with the new scoped name
--     means no window where the table has zero policies (RLS remains enabled).
--   • REVOKE/GRANT on trigger functions does not affect trigger execution.
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION <fn> TO PUBLIC;   -- restores default
--   DROP POLICY "<new_name>" ON <table>;
--   CREATE POLICY "service role only" ON <table> FOR ALL USING (true) WITH CHECK (true);
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. SEARCH PATH HARDENING ──────────────────────────────────────────────────
-- Uses ALTER FUNCTION — no body rewrite, no signature change.

-- Auth / profile trigger functions
ALTER FUNCTION public.handle_new_user()              SET search_path = public;
ALTER FUNCTION public.sync_email_verified()          SET search_path = public;

-- Project asset count trigger
ALTER FUNCTION public.sync_project_asset_count()     SET search_path = public;

-- Order fulfillment and manual credit-grant RPCs
ALTER FUNCTION public.fulfill_order(UUID, TEXT)      SET search_path = public;
ALTER FUNCTION public.add_credits(UUID, INTEGER, TEXT, JSONB)
                                                     SET search_path = public;

-- Idempotency cleanup utility (called from cron / admin, not by users)
ALTER FUNCTION public.cleanup_expired_idempotency_keys()
                                                     SET search_path = public;


-- ── 2. RLS POLICY FIX — Creative Director tables ─────────────────────────────
-- Root cause: migration 20260503_creative_directions.sql created three policies
-- without a role qualifier, which means they apply to ALL roles (anon,
-- authenticated, service_role). Any logged-in user could read or write any
-- other user's creative_directions, direction_refinements, direction_elements.
--
-- Fix: drop the broken policies, recreate properly scoped to service_role.
-- All CD reads/writes go through supabaseAdmin (service role) in API routes —
-- no client-side access — so restricting to service_role is correct.

DROP POLICY IF EXISTS "service role only" ON public.creative_directions;
DROP POLICY IF EXISTS "service role only" ON public.direction_refinements;
DROP POLICY IF EXISTS "service role only" ON public.direction_elements;

CREATE POLICY "service_role_only_creative_directions"
  ON public.creative_directions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_only_direction_refinements"
  ON public.direction_refinements FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_only_direction_elements"
  ON public.direction_elements FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ── 3 & 4. EXECUTE PRIVILEGE HARDENING ───────────────────────────────────────
-- PostgreSQL grants EXECUTE to PUBLIC by default when a function is created.
-- That means any anon or authenticated session can call SECURITY DEFINER
-- functions directly via PostgREST or Supabase client, bypassing the API layer.
--
-- Strategy:
--   REVOKE EXECUTE … FROM PUBLIC  — removes the default grant
--   GRANT EXECUTE … TO service_role — preserves server-side API access
--
-- Trigger functions receive revoke only; the trigger dispatch mechanism does
-- not perform an EXECUTE privilege check, so revoking is safe and has no
-- effect on trigger execution.

-- ── Trigger functions — revoke only ──────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_email_verified()      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_project_asset_count() FROM PUBLIC;

-- ── Callable RPCs — revoke from PUBLIC, grant to service_role ────────────────

-- Order / credit fulfillment (006_fulfill_order_rpc)
REVOKE EXECUTE ON FUNCTION public.fulfill_order(UUID, TEXT)              FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fulfill_order(UUID, TEXT)              TO service_role;

REVOKE EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, JSONB) TO service_role;

-- Spend / refund (026_fix_credit_rpcs_numeric_amount — had search_path but no revoke)
REVOKE EXECUTE ON FUNCTION public.spend_credits(UUID, NUMERIC(10,2), TEXT, UUID)  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.spend_credits(UUID, NUMERIC(10,2), TEXT, UUID)  TO service_role;

REVOKE EXECUTE ON FUNCTION public.refund_credits(UUID, NUMERIC(10,2), TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.refund_credits(UUID, NUMERIC(10,2), TEXT, UUID) TO service_role;

-- Rate limiting (012_rate_limiting — search_path fixed by 023, no revoke existed)
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- Trial usage (017_trial_usage — search_path fixed by 023, no revoke existed)
REVOKE EXECUTE ON FUNCTION public.consume_trial_usage(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.consume_trial_usage(UUID, TEXT) TO service_role;

-- Entitlement / subscription billing (020_billing_rpcs — search_path fixed by 023)
REVOKE EXECUTE ON FUNCTION public.get_user_entitlement(UUID)  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_user_entitlement(UUID)  TO service_role;

REVOKE EXECUTE ON FUNCTION public.grant_cycle_credits(UUID)   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.grant_cycle_credits(UUID)   TO service_role;

-- Free-tier usage tracking (20260505_free_usage — had search_path but no revoke)
REVOKE EXECUTE ON FUNCTION public.consume_free_usage(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.consume_free_usage(UUID, TEXT) TO service_role;

-- Idempotency cleanup utility (025_security_layer)
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys() TO service_role;
