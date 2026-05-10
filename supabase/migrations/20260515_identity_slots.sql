-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: identity_slots — multi-lock influencer system
--
-- Changes:
--   1. Add parent_influencer_id to ai_influencers (sibling tracking)
--   2. Add handle + display_name + style_category columns (idempotent guards)
--   3. Index for parent → sibling lookups
--
-- Slot limits are enforced in TypeScript (identity-slots.ts), not in the DB.
-- Delete = set status = 'archived' (soft-delete). FK remains intact.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add parent_influencer_id (self-referential, nullable) ──────────────────
ALTER TABLE public.ai_influencers
  ADD COLUMN IF NOT EXISTS parent_influencer_id UUID
    REFERENCES public.ai_influencers(id) ON DELETE SET NULL;

-- ── 2. Index for sibling queries ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_influencers_parent_id
  ON public.ai_influencers(parent_influencer_id)
  WHERE parent_influencer_id IS NOT NULL;

-- ── 3. Index: user_id + status (already exists in 039, but add IF NOT EXISTS) ─
CREATE INDEX IF NOT EXISTS idx_ai_influencers_user_status
  ON public.ai_influencers(user_id, status);
