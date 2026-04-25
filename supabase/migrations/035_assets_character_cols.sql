-- ─────────────────────────────────────────────────────────────────────────────
-- 035_assets_character_cols.sql
-- Extend assets table with character + soul identity linkage.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS soul_id      uuid REFERENCES soul_ids(id) ON DELETE SET NULL;
