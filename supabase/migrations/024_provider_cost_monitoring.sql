-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024 — Provider Cost Monitoring
--
-- Creates three tables for tracking provider-side costs and balances.
-- COMPLETELY SEPARATE from user billing (credit_transactions / profiles.credits).
-- Admin-only intelligence layer — no user-facing exposure.
--
-- Tables:
--   provider_accounts        — one row per provider (config + live balance)
--   provider_cost_log        — one row per generation attempt (success or fail)
--   provider_balance_history — time-series balance snapshots
-- ─────────────────────────────────────────────────────────────────────────────

-- ── provider_accounts ────────────────────────────────────────────────────────
-- Static config + live balance for each AI provider.
-- Billing type, balance unit, and threshold are all provider-specific.
-- balance_synced_at = null means the balance has never been auto-fetched.

CREATE TABLE IF NOT EXISTS public.provider_accounts (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key            TEXT        UNIQUE NOT NULL,       -- 'openai' | 'nano-banana' | 'fal' | 'elevenlabs' | 'kling' etc
  display_name            TEXT        NOT NULL,
  billing_type            TEXT        NOT NULL               -- 'prepaid_credits' | 'usage_based' | 'subscription'
                          CHECK (billing_type IN ('prepaid_credits', 'usage_based', 'subscription')),
  currency                TEXT        NOT NULL DEFAULT 'USD',
  -- Live balance fields (null = not available / not yet synced)
  current_balance         NUMERIC,
  balance_unit            TEXT,                              -- 'USD' | 'credits' | 'characters' | 'quota_pct'
  -- Subscription-style quota tracking (ElevenLabs etc)
  quota_used              BIGINT,
  quota_total             BIGINT,
  quota_reset_date        DATE,
  -- Alerting
  low_balance_threshold   NUMERIC,
  -- Sync metadata
  balance_synced_at       TIMESTAMPTZ,
  sync_method             TEXT        DEFAULT 'manual'       -- 'auto' | 'manual'
                          CHECK (sync_method IN ('auto', 'manual')),
  -- Free-text notes for manual entries ("topped up $50 on Apr 20")
  notes                   TEXT,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS — service role only (admin API routes use supabaseAdmin which bypasses RLS)
ALTER TABLE public.provider_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_accounts_service_only"
  ON public.provider_accounts
  USING (FALSE);

-- ── provider_cost_log ────────────────────────────────────────────────────────
-- One row per generation attempt — written by the backend at job resolution.
-- Records both successful and failed generations.
-- user_id is nullable — background polling jobs may not carry user context.
-- cost_basis = 'estimated' in v1 (no provider returns real billed cost in response).

CREATE TABLE IF NOT EXISTS public.provider_cost_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Generation linkage
  asset_id              UUID        REFERENCES public.assets(id) ON DELETE SET NULL,
  provider_key          TEXT        NOT NULL,
  model_key             TEXT        NOT NULL,
  studio                TEXT        NOT NULL,                -- 'image' | 'video' | 'audio' | 'fcs' | 'character' | 'ugc'
  user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Outcome
  status                TEXT        NOT NULL                 -- 'success' | 'failed'
                        CHECK (status IN ('success', 'failed')),
  failure_reason        TEXT,                               -- trimmed provider error (max 500 chars)
  -- Zencra side (what the user was charged)
  zencra_credits_charged INTEGER,
  -- Provider side (what this cost Zencra)
  provider_cost_units   NUMERIC,                            -- provider credits / tokens consumed
  provider_cost_usd     NUMERIC,                            -- USD equivalent (estimated or actual)
  cost_basis            TEXT        NOT NULL DEFAULT 'estimated'
                        CHECK (cost_basis IN ('estimated', 'actual', 'flat', 'unknown')),
  -- Generation context (duration, resolution, quality etc)
  generation_params     JSONB,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_provider_cost_log_provider_month
  ON public.provider_cost_log (provider_key, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_cost_log_model_month
  ON public.provider_cost_log (model_key, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_cost_log_asset
  ON public.provider_cost_log (asset_id);

-- RLS — service role only
ALTER TABLE public.provider_cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_cost_log_service_only"
  ON public.provider_cost_log
  USING (FALSE);

-- ── provider_balance_history ─────────────────────────────────────────────────
-- Time-series snapshots written by the balance sync job.
-- One row per sync per provider. Never updated — append only.

CREATE TABLE IF NOT EXISTS public.provider_balance_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key    TEXT        NOT NULL,
  balance         NUMERIC,
  balance_unit    TEXT,
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_balance_history_lookup
  ON public.provider_balance_history (provider_key, snapshot_at DESC);

-- RLS — service role only
ALTER TABLE public.provider_balance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_balance_history_service_only"
  ON public.provider_balance_history
  USING (FALSE);

-- ── Seed: initial provider_accounts rows ─────────────────────────────────────
-- One row for every provider currently wired in the platform.
-- Manual-sync providers have sync_method = 'manual'.
-- Auto-sync providers have sync_method = 'auto' (fal, elevenlabs).

INSERT INTO public.provider_accounts
  (provider_key, display_name, billing_type, currency, balance_unit, low_balance_threshold, sync_method, notes)
VALUES
  ('openai',       'OpenAI',         'usage_based',     'USD', 'USD',        10.00,  'manual', 'Post-pay usage billing. Check dashboard.openai.com for current spend.'),
  ('nano-banana',  'Nano Banana',    'prepaid_credits',  'USD', 'credits',   500,    'manual', 'Prepaid credit wallet. Check dashboard for balance.'),
  ('fal',          'fal.ai',         'prepaid_credits',  'USD', 'USD',        10.00,  'auto',   'Balance auto-synced via fal account API.'),
  ('elevenlabs',   'ElevenLabs',     'subscription',     'USD', 'characters', 10000,  'auto',   'Subscription quota. Auto-synced via /v1/user/subscription.'),
  ('kling',        'Kling (Kuaishou)','prepaid_credits', 'USD', 'credits',   100,    'manual', 'Prepaid API credits. Check Kuaishou API console for balance.'),
  ('byteplus',     'BytePlus (Seedance)','usage_based',  'USD', 'USD',        10.00,  'manual', 'BytePlus API usage billing. Check BytePlus console.'),
  ('runway',       'Runway ML',      'subscription',     'USD', 'credits',   50,     'manual', 'Subscription plan. Not yet active in production.'),
  ('stability',    'Stability AI',   'prepaid_credits',  'USD', 'credits',   100,    'manual', 'Not yet active in production.'),
  ('heygen',       'HeyGen',         'subscription',     'USD', 'credits',   50,     'manual', 'UGC provider. Not yet active in production.'),
  ('creatify',     'Creatify',       'subscription',     'USD', 'credits',   50,     'manual', 'UGC provider. Not yet active in production.')
ON CONFLICT (provider_key) DO NOTHING;
