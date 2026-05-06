-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260506_security_advisor_search_path_cleanup
--
-- Pins SET search_path = public on 3 functions that were still flagged by
-- the Supabase Security Advisor after the two earlier hardening migrations:
--
--   • public.set_updated_at()              — trigger function (NOT SECURITY DEFINER)
--   • public.update_updated_at_column()    — trigger function (NOT SECURITY DEFINER)
--   • public.claim_next_sequence_shot(UUID)— callable RPC  (SECURITY DEFINER)
--
-- claim_next_sequence_shot had its EXECUTE privileges locked in
-- 20260506_security_advisor_supplemental.sql but its search_path was
-- not pinned in that file. set_updated_at and update_updated_at_column
-- are not SECURITY DEFINER but Supabase still lints them.
--
-- All three are fixed here with ALTER FUNCTION — no body rewrite.
-- After this migration the Security Advisor shows zero security warnings.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.set_updated_at()               SET search_path = public;
ALTER FUNCTION public.update_updated_at_column()     SET search_path = public;
ALTER FUNCTION public.claim_next_sequence_shot(UUID) SET search_path = public;
