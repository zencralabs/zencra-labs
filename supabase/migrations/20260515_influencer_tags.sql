-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: influencer_tags
--
-- Adds a tags text[] column to ai_influencers for library filtering.
-- Tags are user-defined labels: Fashion, Luxury, Fitness, etc.
-- Enforced in application layer; DB stores raw string array.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_influencers
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Index for tag-based lookups (GIN — efficient for array containment queries)
CREATE INDEX IF NOT EXISTS idx_ai_influencers_tags
  ON public.ai_influencers USING GIN (tags);
