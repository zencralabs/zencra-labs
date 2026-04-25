-- ─────────────────────────────────────────────────────────────────────────────
-- 032_character_versions.sql
-- Tracks versioned outputs for each character (base, refinements, scenes, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id       uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  soul_id            uuid REFERENCES soul_ids(id) ON DELETE SET NULL,
  parent_version_id  uuid REFERENCES character_versions(id) ON DELETE SET NULL,
  asset_id           uuid REFERENCES assets(id) ON DELETE SET NULL,
  version_type       text NOT NULL CHECK (version_type IN ('base','refinement','lookbook','scene','upscale','motion')),
  metadata           jsonb DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE character_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own character versions" ON character_versions
  FOR ALL USING (
    character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS character_versions_character_id_idx ON character_versions(character_id);
