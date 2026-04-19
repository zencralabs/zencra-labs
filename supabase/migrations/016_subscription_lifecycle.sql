-- ──────────────────────────────────────────────────────────────────────────────
-- 016_subscription_lifecycle.sql
--
-- Subscription state, FCS add-on attachment, and Business team seats.
-- These are runtime operational tables — no seed data.
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── subscriptions ─────────────────────────────────────────────────────────────
-- One active row per billing entity. Partial unique index ensures only one
-- trialing/active/past_due subscription per user at any time.
-- Historical canceled/expired rows are preserved for audit.
-- trial_ends_at: set on signup = created_at + 7 days.
-- provider/provider_subscription_id: NULL during trial (no payment yet).

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                  UUID        NOT NULL REFERENCES public.plans(id),
  price_id                 UUID        NOT NULL REFERENCES public.plan_prices(id),
  status                   TEXT        NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_ends_at            TIMESTAMPTZ,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN     NOT NULL DEFAULT false,
  provider                 TEXT        CHECK (provider IN ('razorpay', 'stripe')),
  provider_subscription_id TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique: only one active/trialing/past_due subscription per user.
-- Allows multiple historical canceled/expired rows per user.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_active_idx
  ON public.subscriptions (user_id)
  WHERE status IN ('trialing', 'active', 'past_due');

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx  ON public.subscriptions (status);

-- ── subscription_addons ───────────────────────────────────────────────────────
-- Active FCS add-on on a subscription. One per subscription maximum.
-- Unique constraint prevents double-purchasing the same addon.

CREATE TABLE IF NOT EXISTS public.subscription_addons (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id          UUID        NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  addon_id                 UUID        NOT NULL REFERENCES public.addons(id),
  status                   TEXT        NOT NULL CHECK (status IN ('active', 'canceled', 'pending')),
  provider_subscription_id TEXT,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, addon_id)
);

CREATE INDEX IF NOT EXISTS subscription_addons_subscription_id_idx
  ON public.subscription_addons (subscription_id);

-- ── subscription_seats ────────────────────────────────────────────────────────
-- Business team members beyond the owner. Owner lives in subscriptions.user_id.
-- seat_addon_id links to which seat tier was purchased (+1/+2/+3 users).
-- user_id is NULL until the invited member accepts.
-- RULE: only allowed when the subscription's plan has team_enabled = true.
-- Enforced at API level (DB constraint omitted to allow cascade delete cleanly).

CREATE TABLE IF NOT EXISTS public.subscription_seats (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID       NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  seat_addon_id  UUID        REFERENCES public.seat_add_on_prices(id),
  user_id        UUID        REFERENCES auth.users(id),
  invited_email  TEXT        NOT NULL,
  status         TEXT        NOT NULL CHECK (status IN ('pending', 'active', 'removed')),
  invited_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at      TIMESTAMPTZ,
  removed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_seats_subscription_id_idx
  ON public.subscription_seats (subscription_id);
CREATE INDEX IF NOT EXISTS subscription_seats_user_id_idx
  ON public.subscription_seats (user_id)
  WHERE user_id IS NOT NULL;
