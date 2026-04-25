-- ─────────────────────────────────────────────────────────────────────────────
-- 037_character_style_system.sql
-- Phase 3B: Character + Style System — extends existing tables, adds styles,
-- character_styles, seeds system styles, adds missing columns.
-- All operations are fully idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend characters table ────────────────────────────────────────────────
-- Add notes column (status, project_id, cover_asset_id, platform_intent already exist)
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS notes text NULL;

-- ── 2. Extend character_profiles table ───────────────────────────────────────
-- Missing: appearance_prompt, negative_prompt, NOT NULL defaults, character_type check
ALTER TABLE character_profiles
  ADD COLUMN IF NOT EXISTS appearance_prompt text NULL,
  ADD COLUMN IF NOT EXISTS negative_prompt   text NULL;

-- Backfill NULLs where constraints will be applied
UPDATE character_profiles SET personality_traits = '[]'::jsonb WHERE personality_traits IS NULL;
UPDATE character_profiles SET style_preferences  = '{}'::jsonb WHERE style_preferences  IS NULL;

-- Apply NOT NULL defaults (safe — NULLs were just backfilled)
ALTER TABLE character_profiles
  ALTER COLUMN personality_traits SET NOT NULL,
  ALTER COLUMN personality_traits SET DEFAULT '[]'::jsonb,
  ALTER COLUMN style_preferences  SET NOT NULL,
  ALTER COLUMN style_preferences  SET DEFAULT '{}'::jsonb;

-- Set character_type default and NOT NULL (backfill first)
UPDATE character_profiles SET character_type = 'custom' WHERE character_type IS NULL;
ALTER TABLE character_profiles
  ALTER COLUMN character_type SET NOT NULL,
  ALTER COLUMN character_type SET DEFAULT 'custom';

-- Add CHECK constraint for character_type if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'character_profiles_character_type_check' AND conrelid = 'character_profiles'::regclass
  ) THEN
    ALTER TABLE character_profiles
      ADD CONSTRAINT character_profiles_character_type_check
      CHECK (character_type IN ('influencer','avatar','brand','fictional','custom'));
  END IF;
END
$$;

-- ── 3. Extend soul_ids table ──────────────────────────────────────────────────
-- Missing: identity_strength, style_match_score, embedding_status
ALTER TABLE soul_ids
  ADD COLUMN IF NOT EXISTS identity_strength  numeric NULL,
  ADD COLUMN IF NOT EXISTS style_match_score  numeric NULL,
  ADD COLUMN IF NOT EXISTS embedding_status   text NOT NULL DEFAULT 'pending';

-- Backfill existing rows
UPDATE soul_ids SET embedding_status = 'pending' WHERE embedding_status IS NULL;

-- Add CHECK constraint for embedding_status if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'soul_ids_embedding_status_check' AND conrelid = 'soul_ids'::regclass
  ) THEN
    ALTER TABLE soul_ids
      ADD CONSTRAINT soul_ids_embedding_status_check
      CHECK (embedding_status IN ('pending','ready','failed','disabled'));
  END IF;
END
$$;

-- Ensure identity_prompt has a default
ALTER TABLE soul_ids
  ALTER COLUMN identity_prompt SET DEFAULT '';
UPDATE soul_ids SET identity_prompt = '' WHERE identity_prompt IS NULL;
ALTER TABLE soul_ids ALTER COLUMN identity_prompt SET NOT NULL;

-- Ensure style_dna and reference_asset_ids have proper defaults
ALTER TABLE soul_ids
  ALTER COLUMN style_dna          SET DEFAULT '{}'::jsonb,
  ALTER COLUMN reference_asset_ids SET DEFAULT '{}';

-- ── 4. Extend character_versions table ───────────────────────────────────────
-- Existing table uses version_type; we need to add mode (alias), version_name,
-- prompt_snapshot, style_snapshot columns.
ALTER TABLE character_versions
  ADD COLUMN IF NOT EXISTS mode            text NULL,
  ADD COLUMN IF NOT EXISTS version_name    text NULL,
  ADD COLUMN IF NOT EXISTS prompt_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS style_snapshot  jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill mode from version_type for existing rows
UPDATE character_versions SET mode = version_type WHERE mode IS NULL AND version_type IS NOT NULL;

-- Add CHECK on mode if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'character_versions_mode_check' AND conrelid = 'character_versions'::regclass
  ) THEN
    ALTER TABLE character_versions
      ADD CONSTRAINT character_versions_mode_check
      CHECK (mode IS NULL OR mode IN ('base','refine','lookbook','scene','upscale','motion'));
  END IF;
END
$$;

-- soul_id was nullable (ON DELETE SET NULL) — ensure metadata default is set
ALTER TABLE character_versions
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- ── 5. Extend reference_consent table ────────────────────────────────────────
-- Missing: consent_text, source_type missing 'unknown', created_at alias
ALTER TABLE reference_consent
  ADD COLUMN IF NOT EXISTS consent_text text NULL,
  ADD COLUMN IF NOT EXISTS created_at   timestamptz NULL DEFAULT now();

-- Backfill created_at from declared_at where it exists
UPDATE reference_consent SET created_at = declared_at WHERE created_at IS NULL AND declared_at IS NOT NULL;
UPDATE reference_consent SET created_at = now() WHERE created_at IS NULL;

-- Extend source_type check to include 'unknown' — drop old constraint and recreate
DO $$
BEGIN
  -- Drop old check constraint on source_type if it doesn't include 'unknown'
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reference_consent_source_type_check' AND conrelid = 'reference_consent'::regclass
  ) THEN
    ALTER TABLE reference_consent DROP CONSTRAINT reference_consent_source_type_check;
  END IF;
  -- Recreate with 'unknown' included
  ALTER TABLE reference_consent
    ADD CONSTRAINT reference_consent_source_type_check
    CHECK (source_type IN ('self','owned_reference','fictional','brand_character','unknown'));
END
$$;

-- ── 6. Extend generation_jobs table ──────────────────────────────────────────
ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS mode text NULL;

-- ── 7. Extend assets table ────────────────────────────────────────────────────
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS style_ids     uuid[]  NULL,
  ADD COLUMN IF NOT EXISTS source_studio text    NULL,
  ADD COLUMN IF NOT EXISTS mode          text    NULL;

-- ── 8. styles table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS styles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  category         text NOT NULL CHECK (category IN ('cinematic','editorial','street','fashion','anime','realistic','fantasy','commercial','ugc','custom')),
  description      text NULL,
  prompt_template  text NOT NULL,
  negative_prompt  text NULL,
  preview_asset_id uuid NULL,
  is_system        boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE styles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'styles' AND policyname = 'Anyone can read system styles'
  ) THEN
    CREATE POLICY "Anyone can read system styles" ON styles
      FOR SELECT USING (is_system = true AND is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'styles' AND policyname = 'Users manage own styles'
  ) THEN
    CREATE POLICY "Users manage own styles" ON styles
      FOR ALL USING (user_id = auth.uid());
  END IF;
END
$$;

-- ── 9. character_styles table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS character_styles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  style_id     uuid NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  weight       numeric NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 2.0),
  is_primary   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(character_id, style_id)
);

ALTER TABLE character_styles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'character_styles' AND policyname = 'Users manage own character_styles'
  ) THEN
    CREATE POLICY "Users manage own character_styles" ON character_styles
      FOR ALL USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));
  END IF;
END
$$;

-- ── 10. System style seeds ────────────────────────────────────────────────────
INSERT INTO styles (name, category, description, prompt_template, negative_prompt, is_system, is_active)
VALUES
  ('Cinematic Portrait', 'cinematic', 'Film-quality character portrait with dramatic lighting',
   'cinematic portrait, dramatic lighting, film grain, shallow depth of field, professional photography',
   'cartoon, anime, illustration, low quality, blurry', true, true),

  ('Editorial Glow', 'editorial', 'High-fashion editorial look with radiant skin',
   'editorial fashion photography, radiant skin, high contrast, magazine quality, clean background',
   'casual, street, noise, low resolution', true, true),

  ('Street Campaign', 'street', 'Urban streetwear aesthetic',
   'street photography, urban environment, authentic style, natural light, lifestyle',
   'studio, formal, artificial lighting', true, true),

  ('Luxury Fashion', 'fashion', 'Premium luxury fashion shoot',
   'luxury fashion, premium clothing, aspirational lifestyle, elegant setting, high end',
   'casual, low budget, noisy', true, true),

  ('Anime Soft', 'anime', 'Soft anime illustration style',
   'anime style, soft colors, detailed character art, vibrant, clean linework',
   'photorealistic, 3d render, dark', true, true),

  ('Photoreal Studio', 'realistic', 'Clean studio photorealism',
   'photorealistic, studio lighting, white background, sharp detail, professional headshot quality',
   'cartoon, stylized, illustration, blurry', true, true),

  ('UGC Creator', 'ugc', 'Authentic creator style for social content',
   'authentic creator style, natural environment, casual tone, relatable, lifestyle content',
   'studio, formal, polished, overly perfect', true, true),

  ('Fantasy Hero', 'fantasy', 'Epic fantasy character style',
   'fantasy character art, epic lighting, detailed armor or costume, heroic pose, vibrant environment',
   'modern, casual, realistic photo', true, true),

  ('Minimal Commercial', 'commercial', 'Clean minimal commercial aesthetic',
   'clean commercial photography, minimal background, product-ready, professional, neutral tones',
   'busy background, casual, artistic', true, true)
ON CONFLICT DO NOTHING;
