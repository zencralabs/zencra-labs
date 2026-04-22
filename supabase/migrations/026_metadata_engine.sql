-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 026 — Metadata Engine
--
-- Adds two JSONB columns to `assets` for structured generation provenance:
--
--   generation_metadata  — raw facts written at creation time (never mutated)
--   enriched_metadata    — derived/inferred data written async after creation
--   metadata_enriched_at — timestamp when enrichment last ran
--   metadata_version     — bumped when enrichment schema changes
--
-- Existing rows default to NULL for both JSONB columns.
-- The application layer handles NULL gracefully (shows only what exists).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS generation_metadata  JSONB,
  ADD COLUMN IF NOT EXISTS enriched_metadata    JSONB,
  ADD COLUMN IF NOT EXISTS metadata_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata_version     INT DEFAULT 1;

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN assets.generation_metadata IS
  'Raw generation provenance: prompt, model, AR, dimensions, format, credits, etc. Written once at asset creation. Never overwritten.';

COMMENT ON COLUMN assets.enriched_metadata IS
  'Derived cinematic metadata: camera, lens, lighting, mood, style tags, composition. Written async after creation. Additive only — never merges with generation_metadata.';

COMMENT ON COLUMN assets.metadata_enriched_at IS
  'Timestamp when enriched_metadata was last written.';

COMMENT ON COLUMN assets.metadata_version IS
  'Schema version for enriched_metadata. Bump when enrichment output shape changes to allow backfill detection.';
