-- ============================================================
-- Migration 007 — Projects + Visibility System
-- Run in Supabase SQL Editor after schema.sql
-- ============================================================

-- ── PROJECTS TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My First Project',
  description TEXT,
  cover_url   TEXT,          -- URL of first asset in project (set automatically)
  asset_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_projects_user_id ON public.projects(user_id);

-- ── EXTEND GENERATIONS TABLE ─────────────────────────────────
-- visibility: project (default) | private | public
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'project'
    CHECK (visibility IN ('project', 'private', 'public')),
  ADD COLUMN IF NOT EXISTS project_id UUID
    REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_generations_visibility
  ON public.generations(visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_project_id
  ON public.generations(project_id);

-- Index for tool+category combos (used in gallery filters)
CREATE INDEX IF NOT EXISTS idx_generations_tool_cat
  ON public.generations(tool_category, visibility, created_at DESC);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

-- Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Generations: drop old policy and replace with visibility-aware one
DROP POLICY IF EXISTS "Users can view own generations" ON public.generations;

-- Owners see everything; public visibility visible to all (including anon)
CREATE POLICY "View own or public generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id OR visibility = 'public');

-- Insert unchanged — only owner can insert
-- (policy "Users can insert own generations" already exists)

-- Update visibility: only owner
CREATE POLICY "Users can update own generation visibility"
  ON public.generations FOR UPDATE
  USING (auth.uid() = user_id);

-- ── ASSET COUNT TRIGGER ──────────────────────────────────────
-- Keeps projects.asset_count in sync automatically

CREATE OR REPLACE FUNCTION public.sync_project_asset_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.project_id IS NOT NULL THEN
    UPDATE public.projects
    SET asset_count = asset_count + 1
    WHERE id = NEW.project_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Moved out of a project
    IF OLD.project_id IS NOT NULL AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      UPDATE public.projects
      SET asset_count = GREATEST(0, asset_count - 1)
      WHERE id = OLD.project_id;
    END IF;
    -- Moved into a project
    IF NEW.project_id IS NOT NULL AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      UPDATE public.projects
      SET asset_count = asset_count + 1
      WHERE id = NEW.project_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.project_id IS NOT NULL THEN
    UPDATE public.projects
    SET asset_count = GREATEST(0, asset_count - 1)
    WHERE id = OLD.project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_project_asset_count ON public.generations;
CREATE TRIGGER trg_sync_project_asset_count
  AFTER INSERT OR UPDATE OF project_id OR DELETE
  ON public.generations
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_asset_count();

-- ── ENSURE DEFAULT PROJECT FOR EXISTING USERS ─────────────────
-- (For new users this happens via API; this backfills existing ones)
INSERT INTO public.projects (user_id, name)
SELECT id, 'My First Project'
FROM public.profiles
WHERE id NOT IN (SELECT DISTINCT user_id FROM public.projects)
ON CONFLICT DO NOTHING;
