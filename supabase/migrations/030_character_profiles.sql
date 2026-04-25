-- ─────────────────────────────────────────────────────────────────────────────
-- 030_character_profiles.sql
-- Extended profile data for characters (descriptor metadata, style prefs, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_profiles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id         uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  character_type       text,
  age_range            text,
  gender_presentation  text,
  ethnicity_description text,
  body_type            text,
  personality_traits   jsonb DEFAULT '[]',
  style_preferences    jsonb DEFAULT '{}',
  platform_intent      text,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(character_id)
);

ALTER TABLE character_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own character profiles" ON character_profiles
  FOR ALL USING (
    character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
  );
