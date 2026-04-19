-- ──────────────────────────────────────────────────────────────────────────────
-- 015_addon_catalog.sql
--
-- FCS add-ons, Business seat pricing, and Boost credit packs.
-- All are seeded as locked catalog data.
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── addons ────────────────────────────────────────────────────────────────────
-- FCS capability add-ons. One row per eligible plan per billing interval.
-- eligible_plan_id enforces plan-level eligibility at DB level.
-- FCS is only available on Pro and Business — enforced by FK to those plan rows.
-- credits_granted: added to the subscription owner's pool each billing cycle.
-- Interval must match the base plan's billing interval at purchase time.

CREATE TABLE IF NOT EXISTS public.addons (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT        UNIQUE NOT NULL,
  name              TEXT        NOT NULL,
  eligible_plan_id  UUID        NOT NULL REFERENCES public.plans(id),
  interval          TEXT        NOT NULL CHECK (interval IN ('monthly', 'yearly')),
  amount_cents      INTEGER     NOT NULL,
  credits_granted   INTEGER     NOT NULL,
  active            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS addons_eligible_plan_id_idx ON public.addons (eligible_plan_id);

-- ── seat_add_on_prices ────────────────────────────────────────────────────────
-- Business-only seat expansion pricing.
-- additional_seats: how many extra members this tier adds (1, 2, or 3).
-- credits_granted: added to the Business subscription pool per cycle.
-- Yearly = monthly × 10 (confirmed).

CREATE TABLE IF NOT EXISTS public.seat_add_on_prices (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  additional_seats INTEGER     NOT NULL,
  interval         TEXT        NOT NULL CHECK (interval IN ('monthly', 'yearly')),
  amount_cents     INTEGER     NOT NULL,
  credits_granted  INTEGER     NOT NULL,
  active           BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (additional_seats, interval)
);

-- ── boosts ────────────────────────────────────────────────────────────────────
-- One-time credit pack purchases. No expiry. No yearly discount.
-- amount_cents_floor: the minimum price — admin can increase but never decrease.
-- Available to all paid plans.

CREATE TABLE IF NOT EXISTS public.boosts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT        UNIQUE NOT NULL,
  name               TEXT        NOT NULL,
  credits            INTEGER     NOT NULL,
  amount_cents       INTEGER     NOT NULL,
  amount_cents_floor INTEGER     NOT NULL, -- admin cannot go below this
  active             BOOLEAN     NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Seed: addons (FCS) ────────────────────────────────────────────────────────
-- Labels show "Future Cinema Studio" — no LTX naming anywhere.
INSERT INTO public.addons (slug, name, eligible_plan_id, interval, amount_cents, credits_granted)
SELECT v.slug, v.name, p.id, v.interval::TEXT, v.amount_cents, v.credits_granted
FROM public.plans p
JOIN (VALUES
  ('fcs_pro_monthly',      'Future Cinema Studio', 'pro',      'monthly', 2900,  800),
  ('fcs_pro_yearly',       'Future Cinema Studio', 'pro',      'yearly',  29000, 800),
  ('fcs_business_monthly', 'Future Cinema Studio', 'business', 'monthly', 4900,  1800),
  ('fcs_business_yearly',  'Future Cinema Studio', 'business', 'yearly',  49000, 1800)
) AS v(slug, name, plan_slug, interval, amount_cents, credits_granted)
  ON p.slug = v.plan_slug
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: seat_add_on_prices ──────────────────────────────────────────────────
INSERT INTO public.seat_add_on_prices (additional_seats, interval, amount_cents, credits_granted)
VALUES
  (1, 'monthly', 1900,  400),
  (2, 'monthly', 2900,  800),
  (3, 'monthly', 3900,  1200),
  (1, 'yearly',  19000, 400),
  (2, 'yearly',  29000, 800),
  (3, 'yearly',  39000, 1200)
ON CONFLICT (additional_seats, interval) DO NOTHING;

-- ── Seed: boosts ──────────────────────────────────────────────────────────────
INSERT INTO public.boosts (slug, name, credits, amount_cents, amount_cents_floor)
VALUES
  ('light',   'Light Boost',   500,  1500, 1500),
  ('creator', 'Creator Boost', 1000, 2500, 2500),
  ('pro',     'Pro Boost',     2500, 5900, 5900),
  ('studio',  'Studio Boost',  5000, 9900, 9900)
ON CONFLICT (slug) DO NOTHING;
