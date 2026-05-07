-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260509_asset_ownership_layer
-- Phase 1: Unified Asset Ownership Architecture — Additive Schema Only
--
-- Strategy: ADDITIVE ONLY. No backfill. No RLS changes. No data rewrites.
-- All new columns are nullable or have safe defaults.
-- Existing insert flows, gallery APIs, and generation pipelines are unaffected.
--
-- NOTE: workspace_id deferred to a separate migration once
-- 20260506_business_workspace.sql is applied to production.
-- workspace_id is Phase 4 and is not needed for Phase 1 correctness.
--
-- Rollback (if needed):
--   ALTER TABLE assets DROP COLUMN IF EXISTS owner_project_type;
--   ALTER TABLE assets DROP COLUMN IF EXISTS slug;
--   ALTER TABLE assets DROP COLUMN IF EXISTS is_featured;
--   DROP INDEX IF EXISTS idx_assets_slug_unique;
--   DROP INDEX IF EXISTS idx_assets_owner_project_type;
--   DROP INDEX IF EXISTS idx_assets_is_featured;
--   DROP INDEX IF EXISTS idx_assets_project_ownership;
--   ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_visibility_check;
--   ALTER TABLE assets ADD CONSTRAINT assets_visibility_check
--     CHECK (visibility IN ('private', 'public'));
--
-- Changes:
--   1. Fix assets.visibility CHECK constraint — extend to include 'project'
--   2. Add owner_project_type TEXT (nullable, intentionally NO CHECK constraint)
--   3. Add slug TEXT UNIQUE NULLABLE (permalink foundation)
--   4. Add is_featured BOOLEAN NOT NULL DEFAULT FALSE (editorial curation)
--   5. Indexes for future gallery filter and project ownership queries
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Fix assets.visibility CHECK constraint ─────────────────────────────────
--
-- Current constraint (migration 029): CHECK (visibility IN ('private', 'public'))
-- Live production bug: /api/assets/[assetId] PATCH already accepts 'project'
-- as a valid visibility value, but the DB CHECK rejects it at the constraint
-- level. This fix extends the allowed set to three values.
--
-- All existing rows have visibility='private' (the column default).
-- No data is touched — this is a constraint-only change.

ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_visibility_check;

ALTER TABLE assets
  ADD CONSTRAINT assets_visibility_check
  CHECK (visibility IN ('private', 'public', 'project'));


-- ── 2. owner_project_type ─────────────────────────────────────────────────────
--
-- Discriminator that makes the existing project_id FK unambiguous.
--
-- Without this column there is no way to know whether an asset's project_id
-- points to a row in `projects` (standard studio output) or should be
-- resolved through `creative_concepts` → `creative_projects` (CD output).
--
-- Intentionally NO CHECK constraint. Ownership types will grow over time:
-- 'standard'   → project_id → projects
-- 'creative'   → concept_id → creative_concepts → creative_projects
-- Future slots: 'fcs', 'workspace', 'template', 'marketplace', 'agent', etc.
-- Locking the enum now would create migration debt for each new studio type.
--
-- NULL = asset has no project ownership assigned (personal/unlinked asset).
-- Backfill ('standard' or 'creative' for existing rows) is Phase 2.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS owner_project_type TEXT;

COMMENT ON COLUMN assets.owner_project_type IS
  'Project ownership discriminator for project_id. '
  'standard = project_id → projects table. '
  'creative = project resolved via concept_id → creative_concepts → creative_projects. '
  'NULL = personal/unlinked asset. '
  'Intentionally unconstrained — ownership types will expand without migration.';


-- ── 3. slug ───────────────────────────────────────────────────────────────────
--
-- URL-safe permalink identifier for public asset pages (/p/[slug]).
-- Assigned by Phase 3 publishing routes when an asset is made public.
-- NULL = no permalink assigned (asset is private or has no slug yet).
--
-- Uniqueness enforced via partial unique index on non-NULL rows only.
-- PostgreSQL allows multiple NULLs under a UNIQUE index — only non-NULL
-- slugs must be globally unique.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_slug_unique
  ON assets(slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN assets.slug IS
  'URL-safe permalink slug for public asset pages (/p/[slug]). '
  'Unique across all assets when set. '
  'NULL = not yet published with a permalink. '
  'Assigned by Phase 3 publishing routes.';


-- ── 4. is_featured ────────────────────────────────────────────────────────────
--
-- Editorial/platform curation flag. Distinct from is_favorite (user preference).
-- is_featured = TRUE means the asset appears in curated showcases:
--   - Homepage hero gallery
--   - Featured section of the public gallery
--   - Landing page highlights
--
-- Set only by admin or platform curation logic — never by the asset owner.
-- Safe default FALSE ensures no existing asset is unexpectedly surfaced.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN assets.is_featured IS
  'Editorial/platform curation flag. TRUE = shown in featured showcases and homepage. '
  'Distinct from is_favorite (user preference flag). '
  'Set by admin only — not user-settable.';


-- ── 5. Indexes ────────────────────────────────────────────────────────────────

-- owner_project_type: gallery queries filtering by ownership type
-- Partial: NULL rows excluded (unlinked assets skip this index path)
CREATE INDEX IF NOT EXISTS idx_assets_owner_project_type
  ON assets(owner_project_type)
  WHERE owner_project_type IS NOT NULL;

-- is_featured: sparse index for featured gallery queries
-- Partial: only indexes TRUE rows — the vast majority remain FALSE
CREATE INDEX IF NOT EXISTS idx_assets_is_featured
  ON assets(is_featured, created_at DESC)
  WHERE is_featured = TRUE;

-- project ownership composite: resolves "all assets in project X of type Y"
-- Powers the project gallery query after Phase 2 backfill populates owner_project_type
CREATE INDEX IF NOT EXISTS idx_assets_project_ownership
  ON assets(owner_project_type, project_id)
  WHERE owner_project_type IS NOT NULL AND project_id IS NOT NULL;
