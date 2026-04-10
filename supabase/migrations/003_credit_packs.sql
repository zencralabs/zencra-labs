-- ============================================================
-- Migration 003: credit_packs
--
-- Catalog of purchasable credit packages.
-- Stored in DB rather than hardcoded so prices / packs can
-- change without a deployment.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_packs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  credits     INTEGER     NOT NULL CHECK (credits > 0),
  price_cents INTEGER     NOT NULL CHECK (price_cents > 0),
  currency    TEXT        NOT NULL DEFAULT 'usd',
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup for active packs in display order
CREATE INDEX IF NOT EXISTS idx_credit_packs_active_sort
  ON public.credit_packs (active, sort_order)
  WHERE active = TRUE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_packs_updated_at ON public.credit_packs;
CREATE TRIGGER trg_credit_packs_updated_at
  BEFORE UPDATE ON public.credit_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: anyone can read active packs (public catalog)
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_packs_public_read"
  ON public.credit_packs FOR SELECT
  USING (active = TRUE);

-- Service role bypasses RLS — used by API routes
GRANT SELECT ON public.credit_packs TO service_role;

-- ── Seed data ─────────────────────────────────────────────────────────────────
-- These match the TOPUP_PACKS array currently hardcoded in
-- src/app/dashboard/credits/page.tsx — single source of truth moves here.

INSERT INTO public.credit_packs
  (name, credits, price_cents, currency, active, sort_order, metadata)
VALUES
  (
    'Starter',  100,  499, 'usd', TRUE, 1,
    '{"color": "#2563EB", "popular": false, "description": "Perfect for trying out the platform"}'
  ),
  (
    'Creator',  300, 1299, 'usd', TRUE, 2,
    '{"color": "#A855F7", "popular": true, "description": "Most popular — great for regular creators"}'
  ),
  (
    'Studio',   750, 2499, 'usd', TRUE, 3,
    '{"color": "#0EA5A0", "popular": false, "description": "High-volume image and video generation"}'
  ),
  (
    'Pro',     2000, 5999, 'usd', TRUE, 4,
    '{"color": "#F59E0B", "popular": false, "description": "Maximum credits at the best rate"}'
  )
ON CONFLICT DO NOTHING;
