-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023 — Fix mutable search_path on public functions
--
-- Context: Security Advisor flagged 5 functions where search_path is not set,
-- making them vulnerable to search_path hijacking attacks. Explicit
-- SET search_path = public pins them to the correct schema.
--
-- Functions fixed:
--   • public.check_rate_limit(text, integer, integer)
--   • public.consume_trial_usage(uuid, text)
--   • public.get_user_entitlement(uuid)
--   • public.grant_cycle_credits(uuid)
--   • public.set_updated_at()   ← trigger function
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.check_rate_limit(text, integer, integer)
  SET search_path = public;

ALTER FUNCTION public.consume_trial_usage(uuid, text)
  SET search_path = public;

ALTER FUNCTION public.get_user_entitlement(uuid)
  SET search_path = public;

ALTER FUNCTION public.grant_cycle_credits(uuid)
  SET search_path = public;

ALTER FUNCTION public.set_updated_at()
  SET search_path = public;
