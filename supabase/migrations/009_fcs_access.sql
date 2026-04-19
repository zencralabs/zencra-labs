-- ─────────────────────────────────────────────────────────────────────────────
-- 009_fcs_access.sql
--
-- Adds `fcs_enabled` flag to profiles.
-- FCS (Fal Cinematic Studio) access is manually granted per user by admin.
-- Default: false — no one has access until explicitly enabled.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS fcs_enabled BOOLEAN NOT NULL DEFAULT false;
