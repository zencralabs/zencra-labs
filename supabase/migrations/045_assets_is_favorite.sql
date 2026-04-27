-- Migration 045 — Add is_favorite column to assets table
-- Allows users to mark/unmark assets as favourites

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- Index for fast favourites queries per user
CREATE INDEX IF NOT EXISTS idx_assets_user_favorite
  ON assets(user_id, is_favorite)
  WHERE is_favorite = true;
