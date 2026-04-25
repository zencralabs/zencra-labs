-- ─────────────────────────────────────────────────────────────────────────────
-- 033_reference_consent.sql
-- Audit log for reference image consent declarations.
-- Users must confirm the source type before using reference assets for
-- character identity creation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reference_consent (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id          uuid REFERENCES assets(id) ON DELETE SET NULL,
  character_id      uuid REFERENCES characters(id) ON DELETE SET NULL,
  consent_confirmed bool NOT NULL DEFAULT false,
  source_type       text NOT NULL CHECK (source_type IN ('self','owned_reference','fictional','brand_character')),
  declared_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reference_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own consent records" ON reference_consent
  FOR ALL USING (user_id = auth.uid());
