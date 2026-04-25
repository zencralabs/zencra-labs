-- ─────────────────────────────────────────────────────────────────────────────
-- 036_characters_extend.sql
-- Extend characters table with project linkage, status, cover asset, and type.
-- projects table exists (from 029_project_system.sql), so FK is safe.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cover_asset_id  uuid REFERENCES assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_intent text;
