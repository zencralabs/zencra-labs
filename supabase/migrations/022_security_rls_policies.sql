-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022 — Service-role-only RLS policies for internal tables
--
-- Context: Security Advisor flagged 13 tables with RLS enabled but no policies.
-- All of these are backend-controlled tables — anon/authenticated users must
-- never read or write them directly. Service role (used by server-side code via
-- supabaseAdmin) is the only actor that should access them.
--
-- Pattern: FOR ALL ... USING/WITH CHECK (auth.role() = 'service_role')
-- This blocks every Postgres role except service_role at the RLS layer.
--
-- Tables that will need user-scoped READ policies later (noted below):
--   • subscriptions       — users may need to read their own subscription status
--   • trial_usage         — users may need to read their own trial counters
--   • plans / plan_prices — public catalog reads (unauthenticated) for pricing page
--   • subscription_addons — users may need to read their own addons
-- When those user-facing reads are built, ADD a second policy rather than
-- replacing this one.
-- ─────────────────────────────────────────────────────────────────────────────

-- public.addons
CREATE POLICY "addons_service_role_only"
  ON public.addons
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.boosts
CREATE POLICY "boosts_service_role_only"
  ON public.boosts
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.credit_model_costs
CREATE POLICY "credit_model_costs_service_role_only"
  ON public.credit_model_costs
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.credit_model_costs_audit
CREATE POLICY "credit_model_costs_audit_service_role_only"
  ON public.credit_model_costs_audit
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.plan_prices
CREATE POLICY "plan_prices_service_role_only"
  ON public.plan_prices
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.plans
CREATE POLICY "plans_service_role_only"
  ON public.plans
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.rate_limit_buckets
CREATE POLICY "rate_limit_buckets_service_role_only"
  ON public.rate_limit_buckets
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.seat_add_on_prices
CREATE POLICY "seat_add_on_prices_service_role_only"
  ON public.seat_add_on_prices
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.subscription_addons
CREATE POLICY "subscription_addons_service_role_only"
  ON public.subscription_addons
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.subscription_seats
CREATE POLICY "subscription_seats_service_role_only"
  ON public.subscription_seats
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.subscriptions
CREATE POLICY "subscriptions_service_role_only"
  ON public.subscriptions
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.trial_usage
CREATE POLICY "trial_usage_service_role_only"
  ON public.trial_usage
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- public.webhook_events
CREATE POLICY "webhook_events_service_role_only"
  ON public.webhook_events
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
