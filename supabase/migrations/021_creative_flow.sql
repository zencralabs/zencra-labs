-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021 — Creative Flow Engine
--
-- Adds three tables that back the Creative Flow UX system:
--   workflows            — one row per creative session (starts on first generation)
--   workflow_steps       — one row per generation within a workflow
--   workflow_step_assets — links each step to one or more Supabase assets
--
-- Design notes:
--   - A workflow begins implicitly when the user makes their first generation
--     in a session. The route creates the row after a successful dispatch.
--   - Each step carries the studio type, model key, and a prompt snapshot
--     so that "Create Variation" can pre-fill the prompt bar exactly.
--   - step_number is 1-based and sequential within a workflow.
--   - RLS: users can only read / insert their own rows.
--   - No DELETE exposed — soft-archived via `archived_at` on workflows.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── workflows ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflows (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title           TEXT,                          -- optional user-set label; NULL = unnamed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ                    -- soft-delete; NULL = active
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_workflows"
  ON public.workflows
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_workflows_user_active
  ON public.workflows (user_id, created_at DESC)
  WHERE archived_at IS NULL;

-- ── workflow_steps ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID        NOT NULL REFERENCES public.workflows (id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  step_number     SMALLINT    NOT NULL,          -- 1-based, sequential within workflow
  studio_type     TEXT        NOT NULL,          -- "image" | "video" | "audio" | "fcs"
  model_key       TEXT        NOT NULL,          -- e.g. "nano-banana-pro"
  prompt          TEXT        NOT NULL DEFAULT '',
  negative_prompt TEXT,
  aspect_ratio    TEXT,
  seed            INTEGER,
  result_url      TEXT,                          -- primary output URL (set after generation)
  result_urls     TEXT[],                        -- multi-output (batch)
  status          TEXT        NOT NULL DEFAULT 'pending',  -- "pending" | "success" | "error"
  credits_used    INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT workflow_steps_step_number_positive CHECK (step_number > 0),
  CONSTRAINT workflow_steps_status_check CHECK (status IN ('pending', 'success', 'error')),
  UNIQUE (workflow_id, step_number)
);

ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_workflow_steps"
  ON public.workflow_steps
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow
  ON public.workflow_steps (workflow_id, step_number ASC);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_user
  ON public.workflow_steps (user_id, created_at DESC);

-- ── workflow_step_assets ──────────────────────────────────────────────────────
-- Links a step to rows in the existing `generations` / assets table.
-- asset_id is intentionally TEXT (not a FK) so it works with any asset table
-- shape — the asset table name may change as the platform evolves.

CREATE TABLE IF NOT EXISTS public.workflow_step_assets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id         UUID        NOT NULL REFERENCES public.workflow_steps (id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  asset_id        TEXT        NOT NULL,          -- references generations.id or similar
  asset_type      TEXT        NOT NULL DEFAULT 'generation',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_step_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_workflow_step_assets"
  ON public.workflow_step_assets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_wsa_step_id
  ON public.workflow_step_assets (step_id);

-- ── updated_at trigger (shared helper) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_workflow_steps_updated_at
  BEFORE UPDATE ON public.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
