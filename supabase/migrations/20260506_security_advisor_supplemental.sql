-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260506_security_advisor_supplemental
--
-- Supplements 20260506_security_advisor_hardening.sql.
--
-- That migration issued REVOKE EXECUTE … FROM PUBLIC for 13 functions.
-- On Supabase, every function is also granted EXECUTE explicitly to the
-- `anon` and `authenticated` roles at creation time (separate ACL entries
-- from the PUBLIC grant). REVOKE FROM PUBLIC does not remove those entries.
--
-- This migration:
--   A. Revokes the explicit anon/authenticated grants on all 13 functions
--      covered by the first hardening migration.
--   B. Adds full lockdown (REVOKE PUBLIC + REVOKE anon/authenticated +
--      optional service_role GRANT) for 4 SECURITY DEFINER functions that
--      were discovered post-migration and not included in the original file:
--        • claim_next_sequence_shot(UUID)   — callable RPC
--        • deduct_credits(UUID, INT, TEXT)  — callable RPC
--        • restore_credits(UUID, INT, TEXT) — callable RPC
--        • rls_auto_enable()                — trigger function, revoke only
--
-- All statements are idempotent: revoking a privilege that is already absent
-- is a no-op in PostgreSQL (no error).
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION <fn> TO anon, authenticated;
-- ─────────────────────────────────────────────────────────────────────────────


-- ── A. REVOKE explicit anon / authenticated grants ────────────────────────────
-- Covers the 13 functions from the first hardening migration.

-- Trigger functions (revoke only — trigger dispatch ignores EXECUTE privilege)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_email_verified()      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_project_asset_count() FROM anon, authenticated;

-- Callable RPCs
REVOKE EXECUTE ON FUNCTION public.fulfill_order(UUID, TEXT)                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, JSONB)      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spend_credits(UUID, NUMERIC(10,2), TEXT, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(UUID, NUMERIC(10,2), TEXT, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER)     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_trial_usage(UUID, TEXT)              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_entitlement(UUID)                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_cycle_credits(UUID)                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_free_usage(UUID, TEXT)               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys()           FROM anon, authenticated;


-- ── B. Additional SECURITY DEFINER functions — full lockdown ──────────────────
-- These were discovered during post-migration verification and were not
-- included in the first hardening migration.

-- claim_next_sequence_shot — callable RPC (video sequencing)
REVOKE EXECUTE ON FUNCTION public.claim_next_sequence_shot(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_sequence_shot(UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_next_sequence_shot(UUID) TO service_role;

-- deduct_credits — callable RPC (credit spend path)
REVOKE EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER, TEXT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER, TEXT) TO service_role;

-- restore_credits — callable RPC (credit refund/rollback path)
REVOKE EXECUTE ON FUNCTION public.restore_credits(UUID, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_credits(UUID, INTEGER, TEXT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.restore_credits(UUID, INTEGER, TEXT) TO service_role;

-- rls_auto_enable — trigger function (revoke only)
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
