-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 040 — AI Influencer Style Category
--
-- Adds style_category to ai_influencers.
-- Each influencer belongs to exactly one style category.
-- Style category controls visual rendering language in all prompts.
--
-- Categories:
--   hyper-real        — photorealistic, camera lens language
--   3d-animation      — Pixar-quality render, stylized proportions
--   anime-manga       — 2D cel-shaded, line art, stylized expressions
--   fine-art          — oil painting / watercolor, classical composition
--   game-concept      — high-detail cinematic concept art, fantasy/sci-fi
--   physical-texture  — clay / wool / fabric / craft material aesthetic
--   retro-pixel       — 8-bit / 16-bit pixel art, retro game style
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_influencers
  ADD COLUMN IF NOT EXISTS style_category TEXT NOT NULL DEFAULT 'hyper-real'
  CHECK (style_category IN (
    'hyper-real',
    '3d-animation',
    'anime-manga',
    'fine-art',
    'game-concept',
    'physical-texture',
    'retro-pixel'
  ));

-- Index for filtering influencers by style category
CREATE INDEX IF NOT EXISTS idx_ai_influencers_style_category
  ON public.ai_influencers(user_id, style_category);

COMMENT ON COLUMN public.ai_influencers.style_category IS
  'Visual rendering style for this influencer. Immutable after candidate generation is triggered. Controls all prompt language.';
