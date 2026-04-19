-- ──────────────────────────────────────────────────────────────────────────────
-- 014_plan_catalog.sql
--
-- Core billing plan catalog: plans and plan_prices.
-- This is the locked source of truth for all subscription tiers.
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── plans ─────────────────────────────────────────────────────────────────────
-- Immutable after seed. Slugs are used as identifiers across the codebase.
-- credits_per_cycle: credits granted per billing cycle on confirmed payment.
-- fcs_allowed:   hard gate — Pro and Business only.
-- team_enabled:  Business only — enables seat expansion.
-- max_users:     base user count included in the plan.

CREATE TABLE IF NOT EXISTS public.plans (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT        UNIQUE NOT NULL,
  name              TEXT        NOT NULL,
  credits_per_cycle INTEGER     NOT NULL,
  max_users         INTEGER     NOT NULL DEFAULT 1,
  fcs_allowed       BOOLEAN     NOT NULL DEFAULT false,
  team_enabled      BOOLEAN     NOT NULL DEFAULT false,
  active            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── plan_prices ───────────────────────────────────────────────────────────────
-- Monthly and yearly pricing per plan. Locked at subscription time via price_id.
-- Admin-editable but requires deliberate action (changes logged externally).

CREATE TABLE IF NOT EXISTS public.plan_prices (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID        NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  interval     TEXT        NOT NULL CHECK (interval IN ('monthly', 'yearly')),
  amount_cents INTEGER     NOT NULL,
  currency     TEXT        NOT NULL DEFAULT 'usd',
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, interval)
);

CREATE INDEX IF NOT EXISTS plan_prices_plan_id_idx ON public.plan_prices (plan_id);

-- ── Seed: plans ───────────────────────────────────────────────────────────────
INSERT INTO public.plans (slug, name, credits_per_cycle, max_users, fcs_allowed, team_enabled)
VALUES
  ('starter',  'Starter',  200,  1, false, false),
  ('creator',  'Creator',  800,  1, false, false),
  ('pro',      'Pro',      1700, 1, true,  false),
  ('business', 'Business', 4000, 2, true,  true)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: plan_prices ─────────────────────────────────────────────────────────
INSERT INTO public.plan_prices (plan_id, interval, amount_cents, currency)
SELECT p.id, v.interval::TEXT, v.amount_cents, 'usd'
FROM public.plans p
JOIN (VALUES
  ('starter',  'monthly',  1200),
  ('starter',  'yearly',   12000),
  ('creator',  'monthly',  2900),
  ('creator',  'yearly',   29000),
  ('pro',      'monthly',  4900),
  ('pro',      'yearly',   49000),
  ('business', 'monthly',  8900),
  ('business', 'yearly',   89000)
) AS v(slug, interval, amount_cents) ON p.slug = v.slug
ON CONFLICT (plan_id, interval) DO NOTHING;
