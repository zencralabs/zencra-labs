-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260516_influencer_ethnicity_region
--
-- Adds ethnicity_region to ai_influencer_profiles.
-- Used by:
--   • Name generator — picks culturally-matched names (Zara, Aanya, Yuna…)
--   • Prompt composer — injects facial genetics / heritage descriptor
--   • Builder UI — Ethnicity / Region structured selector
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ai_influencer_profiles
  ADD COLUMN IF NOT EXISTS ethnicity_region TEXT DEFAULT NULL;

COMMENT ON COLUMN ai_influencer_profiles.ethnicity_region IS
  'Cultural heritage / facial genetics region. Controls naming logic and prompt injection. '
  'e.g. "south-asian-indian", "east-asian", "middle-eastern", "european", "african", "latin-american"';
