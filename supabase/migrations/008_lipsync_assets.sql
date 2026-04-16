-- ============================================================
-- Migration 008: Lip Sync — Assets, Generation Inputs, and
--                extended Generations columns
--
-- Run in: Supabase Dashboard → SQL Editor
-- IMPORTANT: Run once. All statements are idempotent.
-- ============================================================

BEGIN;

-- ── 1. Extend generations.tool_category CHECK ──────────────────────────────
-- Add 'lipsync' as a valid category alongside image|video|audio|text.
ALTER TABLE public.generations
  DROP CONSTRAINT IF EXISTS generations_tool_category_check;

ALTER TABLE public.generations
  ADD CONSTRAINT generations_tool_category_check
    CHECK (tool_category IN ('image', 'video', 'audio', 'text', 'lipsync'));

-- ── 2. Extend generations.status CHECK ────────────────────────────────────
-- Add 'queued' and 'cancelled' alongside pending|processing|completed|failed.
ALTER TABLE public.generations
  DROP CONSTRAINT IF EXISTS generations_status_check;

ALTER TABLE public.generations
  ADD CONSTRAINT generations_status_check
    CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'));

-- ── 3. Add new columns to generations ─────────────────────────────────────
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS provider          TEXT,              -- 'lipsync_standard' | 'lipsync_pro' | 'kling' | etc.
  ADD COLUMN IF NOT EXISTS engine            TEXT,              -- hidden internal engine identifier
  ADD COLUMN IF NOT EXISTS quality_mode      TEXT,              -- 'standard' | 'pro'
  ADD COLUMN IF NOT EXISTS thumbnail_url     TEXT,              -- generated thumbnail for output video
  ADD COLUMN IF NOT EXISTS output_url        TEXT,              -- explicit output video URL (mirrors result_url)
  ADD COLUMN IF NOT EXISTS title             TEXT,              -- optional human-readable title
  ADD COLUMN IF NOT EXISTS duration_seconds  INTEGER,           -- video duration in seconds
  ADD COLUMN IF NOT EXISTS aspect_ratio      TEXT;              -- '9:16' | '16:9' | '1:1'

-- Populate output_url from existing result_url where missing
UPDATE public.generations
SET output_url = result_url
WHERE output_url IS NULL AND result_url IS NOT NULL;

-- ── 4. Create assets table ─────────────────────────────────────────────────
-- Stores uploaded source files: face images, audio, thumbnails.
CREATE TABLE IF NOT EXISTS public.assets (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_type        TEXT        NOT NULL CHECK (asset_type IN ('image', 'audio', 'video', 'thumbnail')),
  storage_path      TEXT        NOT NULL,                    -- Supabase storage path (bucket relative)
  public_url        TEXT,                                    -- signed or public URL (may expire)
  mime_type         TEXT,
  file_size_bytes   BIGINT,
  width             INTEGER,                                 -- image/video width in px
  height            INTEGER,                                 -- image/video height in px
  duration_seconds  NUMERIC,                                 -- audio/video duration
  source            TEXT        NOT NULL DEFAULT 'upload'
                    CHECK (source IN ('upload', 'generated', 'extracted')),
  visibility        TEXT        NOT NULL DEFAULT 'private'
                    CHECK (visibility IN ('private', 'public')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id    ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON public.assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON public.assets(created_at DESC);

-- RLS: users can only access their own assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_user_only" ON public.assets;
CREATE POLICY "assets_user_only" ON public.assets
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Create generation_inputs table ─────────────────────────────────────
-- Junction table: maps assets to generations by role.
CREATE TABLE IF NOT EXISTS public.generation_inputs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id   UUID        NOT NULL REFERENCES public.generations(id)  ON DELETE CASCADE,
  asset_id        UUID        NOT NULL REFERENCES public.assets(id)        ON DELETE CASCADE,
  role            TEXT        NOT NULL
                  CHECK (role IN ('source_face', 'source_audio', 'output_thumbnail', 'output_video')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gen_inputs_generation_id ON public.generation_inputs(generation_id);
CREATE INDEX IF NOT EXISTS idx_gen_inputs_asset_id      ON public.generation_inputs(asset_id);

-- RLS: scoped via generations ownership
ALTER TABLE public.generation_inputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gen_inputs_user_only" ON public.generation_inputs;
CREATE POLICY "gen_inputs_user_only" ON public.generation_inputs
  FOR ALL
  USING (
    generation_id IN (
      SELECT id FROM public.generations WHERE user_id = auth.uid()
    )
  );

COMMIT;

-- ── POST-MIGRATION NOTES ───────────────────────────────────────────────────
-- Storage bucket setup (do this in Supabase Dashboard → Storage):
--
-- 1. Create a bucket named: lipsync
-- 2. Set to PRIVATE (not public)
-- 3. Enable RLS on the bucket
-- 4. File size limit: 50 MB
-- 5. Allowed MIME types: image/jpeg, image/png, image/webp, audio/mpeg, audio/wav, video/mp4
--
-- Storage path structure:
--   users/{userId}/lipsync/source-face/{assetId}.{ext}
--   users/{userId}/lipsync/source-audio/{assetId}.{ext}
--   users/{userId}/lipsync/output/{generationId}.mp4
--   users/{userId}/lipsync/thumbnails/{generationId}.jpg
