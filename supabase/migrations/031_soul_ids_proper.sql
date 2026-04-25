-- ─────────────────────────────────────────────────────────────────────────────
-- 031_soul_ids_proper.sql
-- Proper soul_ids table with character FK.
-- The characters.soul_id text column (from 028) is kept but no longer the
-- primary reference — use this table going forward.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soul_ids (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id         uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  soul_code            text UNIQUE NOT NULL,
  identity_prompt      text,
  style_dna            jsonb DEFAULT '{}',
  reference_asset_ids  uuid[] DEFAULT '{}',
  embedding_ref        text,
  consistency_score    numeric,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE soul_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own soul ids" ON soul_ids
  FOR ALL USING (
    character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS soul_ids_character_id_idx ON soul_ids(character_id);
CREATE INDEX IF NOT EXISTS soul_ids_soul_code_idx ON soul_ids(soul_code);
