-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 039 — AI Influencer System
--
-- New product: AI Influencer Builder
-- Fully independent from the old character/soul_id system (migrations 028–038).
-- No foreign keys to characters, character_profiles, or soul_ids.
--
-- Tables:
--   ai_influencers               — the persistent digital human entity
--   ai_influencer_profiles       — builder input data (form fields)
--   identity_locks               — canonical identity anchor (created at selection)
--   influencer_generation_jobs   — all generation work tracked here
--   influencer_assets            — all output assets
--
-- Identity contract:
--   Every generation job AFTER candidate selection MUST have:
--     identity_lock_id IS NOT NULL
--     canonical_asset_id IS NOT NULL
--   Enforced via DB CHECK constraint + API Layer 1 guard + getInfluencerContext().
-- ─────────────────────────────────────────────────────────────────────────────

-- ── influencer_assets (declared first — ai_influencers FK depends on it) ─────

CREATE TABLE IF NOT EXISTS public.influencer_assets (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id      UUID        NOT NULL,  -- FK added after ai_influencers exists
  identity_lock_id   UUID,                  -- NULL for candidate assets (pre-lock)
  job_id             UUID,                  -- FK added after influencer_generation_jobs exists
  asset_type         TEXT        NOT NULL,  -- candidate | hero | look | scene | pose | social | identity-sheet | refine
  url                TEXT        NOT NULL,
  thumbnail_url      TEXT,
  is_hero            BOOLEAN     NOT NULL DEFAULT false,
  metadata           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ai_influencers ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_influencers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'active', 'archived')),
  hero_asset_id      UUID        REFERENCES public.influencer_assets(id) ON DELETE SET NULL,
  identity_lock_id   UUID,       -- FK added after identity_locks exists
  thumbnail_url      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ai_influencer_profiles ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_influencer_profiles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id        UUID        NOT NULL REFERENCES public.ai_influencers(id) ON DELETE CASCADE,
  gender               TEXT,
  age_range            TEXT,        -- e.g. "25-32"
  skin_tone            TEXT,        -- e.g. "medium warm"
  face_structure       TEXT,        -- e.g. "oval", "strong jaw"
  fashion_style        TEXT,        -- e.g. "Editorial", "Streetwear"
  realism_level        TEXT,        -- photorealistic | stylized | cinematic
  mood                 TEXT[]       NOT NULL DEFAULT '{}',
  platform_intent      TEXT[]       NOT NULL DEFAULT '{}',
  appearance_notes     TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(influencer_id)
);

-- ── identity_locks ────────────────────────────────────────────────────────────
-- Created exactly once per influencer at the moment the user selects a candidate.
-- Immutable after creation — never updated.

CREATE TABLE IF NOT EXISTS public.identity_locks (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id            UUID        NOT NULL REFERENCES public.ai_influencers(id) ON DELETE CASCADE,
  canonical_asset_id       UUID        NOT NULL,  -- FK to influencer_assets added below

  -- Reference pool for generation
  reference_asset_ids      UUID[]      NOT NULL DEFAULT '{}',

  -- Identity signatures (stubs at creation; updated when embedding providers are wired)
  -- face_embedding: face feature vector envelope (provider-agnostic)
  face_embedding           JSONB       NOT NULL DEFAULT
    '{"provider": "stub", "version": "v0", "data": {}, "status": "pending_embedding"}'::jsonb,
  -- appearance_signature: skin tone, face structure, hair, etc. (from profile)
  appearance_signature     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- style_signature: fashion style, realism level, mood (from profile)
  style_signature          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- body_signature: build, height estimate, gender presentation (from profile)
  body_signature           JSONB       NOT NULL DEFAULT '{}'::jsonb,

  identity_strength_score  NUMERIC     NOT NULL DEFAULT 1.0,

  locked_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── influencer_generation_jobs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.influencer_generation_jobs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id        UUID        NOT NULL REFERENCES public.ai_influencers(id) ON DELETE CASCADE,
  identity_lock_id     UUID        REFERENCES public.identity_locks(id) ON DELETE SET NULL,
  canonical_asset_id   UUID,       -- snapshot of canonical_asset_id at dispatch time

  -- Job classification
  job_type             TEXT        NOT NULL
                                   CHECK (job_type IN (
                                     'generate', 'look-pack', 'scene-pack', 'pose-pack',
                                     'social-pack', 'identity-sheet', 'refine'
                                   )),

  -- DB-level identity contract: every job except 'generate' MUST have lock
  CONSTRAINT identity_required_for_packs CHECK (
    job_type = 'generate'
    OR (identity_lock_id IS NOT NULL AND canonical_asset_id IS NOT NULL)
  ),

  -- Generation tracking
  status               TEXT        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  external_job_id      TEXT,
  prompt               TEXT,
  pack_label           TEXT,       -- e.g. "Casual", "Urban Golden Hour", "Story 9:16"
  provider             TEXT,
  model_key            TEXT,
  aspect_ratio         TEXT,
  result_urls          TEXT[]      NOT NULL DEFAULT '{}',
  estimated_credits    NUMERIC,
  credits_consumed     NUMERIC,
  error_message        TEXT,
  metadata             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Add deferred FKs now that all tables exist ────────────────────────────────

-- influencer_assets.influencer_id → ai_influencers
ALTER TABLE public.influencer_assets
  ADD CONSTRAINT fk_influencer_assets_influencer
  FOREIGN KEY (influencer_id) REFERENCES public.ai_influencers(id) ON DELETE CASCADE;

-- influencer_assets.identity_lock_id → identity_locks
ALTER TABLE public.influencer_assets
  ADD CONSTRAINT fk_influencer_assets_identity_lock
  FOREIGN KEY (identity_lock_id) REFERENCES public.identity_locks(id) ON DELETE SET NULL;

-- influencer_assets.job_id → influencer_generation_jobs
ALTER TABLE public.influencer_assets
  ADD CONSTRAINT fk_influencer_assets_job
  FOREIGN KEY (job_id) REFERENCES public.influencer_generation_jobs(id) ON DELETE SET NULL;

-- ai_influencers.identity_lock_id → identity_locks
ALTER TABLE public.ai_influencers
  ADD CONSTRAINT fk_ai_influencers_identity_lock
  FOREIGN KEY (identity_lock_id) REFERENCES public.identity_locks(id) ON DELETE SET NULL;

-- identity_locks.canonical_asset_id → influencer_assets
ALTER TABLE public.identity_locks
  ADD CONSTRAINT fk_identity_locks_canonical_asset
  FOREIGN KEY (canonical_asset_id) REFERENCES public.influencer_assets(id) ON DELETE RESTRICT;

-- influencer_generation_jobs.canonical_asset_id → influencer_assets
ALTER TABLE public.influencer_generation_jobs
  ADD CONSTRAINT fk_generation_jobs_canonical_asset
  FOREIGN KEY (canonical_asset_id) REFERENCES public.influencer_assets(id) ON DELETE SET NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_influencers_user_id
  ON public.ai_influencers(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_influencers_status
  ON public.ai_influencers(user_id, status);

CREATE INDEX IF NOT EXISTS idx_influencer_profiles_influencer_id
  ON public.ai_influencer_profiles(influencer_id);

CREATE INDEX IF NOT EXISTS idx_identity_locks_influencer_id
  ON public.identity_locks(influencer_id);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_influencer_id
  ON public.influencer_generation_jobs(influencer_id);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status
  ON public.influencer_generation_jobs(influencer_id, status);

CREATE INDEX IF NOT EXISTS idx_influencer_assets_influencer_id
  ON public.influencer_assets(influencer_id);

CREATE INDEX IF NOT EXISTS idx_influencer_assets_type
  ON public.influencer_assets(influencer_id, asset_type);

CREATE INDEX IF NOT EXISTS idx_influencer_assets_hero
  ON public.influencer_assets(influencer_id) WHERE is_hero = true;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.ai_influencers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_influencer_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_locks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_assets         ENABLE ROW LEVEL SECURITY;

-- ai_influencers
CREATE POLICY "users_own_influencers"
  ON public.ai_influencers FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_influencers"
  ON public.ai_influencers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ai_influencer_profiles
CREATE POLICY "users_own_influencer_profiles"
  ON public.ai_influencer_profiles FOR ALL TO authenticated
  USING (influencer_id IN (SELECT id FROM public.ai_influencers WHERE user_id = auth.uid()))
  WITH CHECK (influencer_id IN (SELECT id FROM public.ai_influencers WHERE user_id = auth.uid()));

CREATE POLICY "service_role_influencer_profiles"
  ON public.ai_influencer_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- identity_locks
CREATE POLICY "users_own_identity_locks"
  ON public.identity_locks FOR ALL TO authenticated
  USING (influencer_id IN (SELECT id FROM public.ai_influencers WHERE user_id = auth.uid()));

CREATE POLICY "service_role_identity_locks"
  ON public.identity_locks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- influencer_generation_jobs
CREATE POLICY "users_own_generation_jobs"
  ON public.influencer_generation_jobs FOR ALL TO authenticated
  USING (influencer_id IN (SELECT id FROM public.ai_influencers WHERE user_id = auth.uid()));

CREATE POLICY "service_role_generation_jobs"
  ON public.influencer_generation_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- influencer_assets
CREATE POLICY "users_own_influencer_assets"
  ON public.influencer_assets FOR ALL TO authenticated
  USING (influencer_id IN (SELECT id FROM public.ai_influencers WHERE user_id = auth.uid()));

CREATE POLICY "service_role_influencer_assets"
  ON public.influencer_assets FOR ALL TO service_role
  USING (true) WITH CHECK (true);
