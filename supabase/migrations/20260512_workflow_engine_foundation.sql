-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260512_workflow_engine_foundation
-- Phase 2A: Persistent Workflow Engine — Schema Foundation
--
-- Strategy: RENAME LEGACY + CREATE NEW. No data deleted. No rows dropped.
--
-- Step 1: Rename legacy FlowContext/StudioShell tables to *_legacy.
--         These tables were created in Migration 056 (CreativeDirector/StudioShell era).
--         They are a flat generation-log concept, not an orchestration engine.
--         All existing rows are preserved under the legacy names.
--
-- Step 2: Create Phase 2A workflow engine tables with correct schema.
--         workflow_runs + workflow_steps are the orchestration primitives.
--
-- Design rules (Phase 2A):
--   - Engine calls capabilities, not providers directly.
--   - Credits reserved at run creation, used per completed step,
--     released at terminal state. Never double-charged on retry.
--   - idempotency_key globally unique — prevents double-dispatch on retry.
--   - Deleting a workflow_run cascades to workflow_steps.
--   - Deleting a workflow_run does NOT delete assets (soft references only).
--
-- Status machines:
--   workflow_runs:  pending → running → completed | failed | cancelled
--   workflow_steps: pending → running → retrying → completed | failed
--
-- Rollback:
--   DROP TABLE IF EXISTS workflow_steps;
--   DROP TABLE IF EXISTS workflow_runs;
--   ALTER TABLE workflow_step_assets_legacy RENAME TO workflow_step_assets;
--   ALTER TABLE workflow_steps_legacy       RENAME TO workflow_steps;
--   ALTER TABLE workflows_legacy            RENAME TO workflows;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Rename legacy tables ──────────────────────────────────────────────

-- Rename in dependency order: child tables first, then parent
ALTER TABLE workflow_step_assets RENAME TO workflow_step_assets_legacy;
ALTER TABLE workflow_steps       RENAME TO workflow_steps_legacy;
ALTER TABLE workflows            RENAME TO workflows_legacy;

-- Mark legacy tables with comments
COMMENT ON TABLE workflows_legacy IS
  'LEGACY (Phase 1 FlowContext/StudioShell): project/folder concept. '
  'Superseded by Phase 2A workflow_runs. Do not write new data here. '
  'Renamed from "workflows" — all rows preserved.';

COMMENT ON TABLE workflow_steps_legacy IS
  'LEGACY (Phase 1 FlowContext/StudioShell): flat generation-log table. '
  'Not an orchestration engine. Superseded by Phase 2A workflow_steps. '
  'Renamed from "workflow_steps" — all rows preserved.';

COMMENT ON TABLE workflow_step_assets_legacy IS
  'LEGACY (Phase 1 FlowContext/StudioShell): asset links for workflow_steps_legacy. '
  'Renamed from "workflow_step_assets" — all rows preserved.';

-- ── Step 2: Create Phase 2A workflow engine tables ────────────────────────────

-- ── workflow_runs ─────────────────────────────────────────────────────────────

CREATE TABLE workflow_runs (
  -- Identity
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id      UUID        NULL,  -- Phase 4 workspace backfill; nullable intentionally

  -- Provenance
  source            TEXT        NOT NULL DEFAULT 'studio',
    -- e.g. 'studio', 'api', 'fcs', 'scheduled'
  intent_type       TEXT        NOT NULL,
    -- e.g. 'reference_stack_render', 'cinematic_sequence', 'lip_sync'

  -- Lifecycle
  status            TEXT        NOT NULL DEFAULT 'pending'
    CONSTRAINT workflow_runs_status_check
      CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Payloads
  input_payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  error_message     TEXT        NULL,

  -- Asset link (set when run reaches completed — soft reference, no FK cascade)
  final_asset_id    UUID        NULL,

  -- Credit accounting
  --   reserve:  set at run creation (estimated full cost)
  --   used:     incremented per completed step
  --   released: set at terminal state (reserved - used; may be 0)
  credit_reserved   INTEGER     NOT NULL DEFAULT 0
    CONSTRAINT workflow_runs_credit_reserved_non_negative CHECK (credit_reserved >= 0),
  credit_used       INTEGER     NOT NULL DEFAULT 0
    CONSTRAINT workflow_runs_credit_used_non_negative     CHECK (credit_used >= 0),
  credit_released   INTEGER     NOT NULL DEFAULT 0
    CONSTRAINT workflow_runs_credit_released_non_negative CHECK (credit_released >= 0),

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ NULL
);

-- Indexes
CREATE INDEX idx_workflow_runs_user_id
  ON workflow_runs (user_id);

CREATE INDEX idx_workflow_runs_status
  ON workflow_runs (status)
  WHERE status IN ('pending', 'running');

CREATE INDEX idx_workflow_runs_workspace_id
  ON workflow_runs (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX idx_workflow_runs_intent_type
  ON workflow_runs (intent_type);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_workflow_runs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workflow_runs_updated_at
  BEFORE UPDATE ON workflow_runs
  FOR EACH ROW EXECUTE FUNCTION update_workflow_runs_updated_at();

-- ── workflow_steps ────────────────────────────────────────────────────────────

CREATE TABLE workflow_steps (
  -- Identity
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id     UUID        NOT NULL
    REFERENCES workflow_runs(id) ON DELETE CASCADE,

  -- Ordering and retry
  step_index          INTEGER     NOT NULL
    CONSTRAINT workflow_steps_step_index_non_negative CHECK (step_index >= 0),
  attempt             INTEGER     NOT NULL DEFAULT 1
    CONSTRAINT workflow_steps_attempt_positive CHECK (attempt >= 1),

  -- Idempotency: '{run_id}:{step_index}:{attempt}'
  -- Passed to provider adapters to prevent double-dispatch on retry.
  idempotency_key     TEXT        NOT NULL,

  -- Capability routing (engine vocabulary, not provider vocabulary)
  capability          TEXT        NOT NULL,
    -- e.g. 'renderWithQuality', 'lipSync', 'upscale'
  provider_key        TEXT        NULL,
    -- resolved at dispatch time; e.g. 'openai', 'kling', 'nano-banana'
  model_key           TEXT        NULL,
    -- resolved at dispatch time; e.g. 'gpt-image-2', 'kling-v2'

  -- Lifecycle
  status              TEXT        NOT NULL DEFAULT 'pending'
    CONSTRAINT workflow_steps_status_check
      CHECK (status IN ('pending', 'running', 'retrying', 'completed', 'failed')),

  -- Payloads
  input_payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  output_payload      JSONB       NULL,    -- raw provider response (audit only, not exposed to UI)
  error_message       TEXT        NULL,

  -- Asset link (soft reference — no FK cascade so assets survive step deletion)
  output_asset_id     UUID        NULL,

  -- Credit accounting (per step)
  credits_estimated   INTEGER     NOT NULL DEFAULT 0
    CONSTRAINT workflow_steps_credits_estimated_non_negative CHECK (credits_estimated >= 0),
  credits_used        INTEGER     NOT NULL DEFAULT 0
    CONSTRAINT workflow_steps_credits_used_non_negative     CHECK (credits_used >= 0),

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ NULL,
  completed_at        TIMESTAMPTZ NULL,

  -- Uniqueness
  CONSTRAINT workflow_steps_run_step_attempt_unique
    UNIQUE (workflow_run_id, step_index, attempt),

  CONSTRAINT workflow_steps_idempotency_key_unique
    UNIQUE (idempotency_key)
);

-- Indexes
CREATE INDEX idx_workflow_steps_run_id
  ON workflow_steps (workflow_run_id);

CREATE INDEX idx_workflow_steps_status
  ON workflow_steps (status)
  WHERE status IN ('pending', 'running', 'retrying');

CREATE INDEX idx_workflow_steps_capability
  ON workflow_steps (capability);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_workflow_steps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workflow_steps_updated_at
  BEFORE UPDATE ON workflow_steps
  FOR EACH ROW EXECUTE FUNCTION update_workflow_steps_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE workflow_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

-- workflow_runs: users own their runs
CREATE POLICY "workflow_runs_user_select"
  ON workflow_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "workflow_runs_user_insert"
  ON workflow_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workflow_runs_user_update"
  ON workflow_runs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- workflow_steps: users read steps belonging to their runs
-- Steps are written exclusively by the server-side engine (service role bypasses RLS)
CREATE POLICY "workflow_steps_user_select"
  ON workflow_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_runs wr
      WHERE wr.id = workflow_steps.workflow_run_id
        AND wr.user_id = auth.uid()
    )
  );

-- ── Table comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE workflow_runs IS
  'Phase 2A: Top-level workflow intent. One row per user-initiated orchestration. '
  'Credits reserved at creation, consumed per completed step, released at terminal state.';

COMMENT ON TABLE workflow_steps IS
  'Phase 2A: Individual capability execution units within a workflow_run. '
  'idempotency_key prevents double-dispatch on retry. '
  'Engine writes via service role; users read via RLS-scoped SELECT policy.';

COMMENT ON COLUMN workflow_runs.source IS
  'Originating surface: studio | api | fcs | scheduled';

COMMENT ON COLUMN workflow_runs.intent_type IS
  'Semantic workflow type: reference_stack_render | cinematic_sequence | lip_sync | ...';

COMMENT ON COLUMN workflow_runs.credit_reserved IS
  'Estimated total cost reserved at run creation.';

COMMENT ON COLUMN workflow_runs.credit_released IS
  'Difference returned to user balance when run reaches terminal state (reserved - used).';

COMMENT ON COLUMN workflow_steps.idempotency_key IS
  'Format: {run_id}:{step_index}:{attempt}. Passed to provider adapters to prevent double-dispatch.';

COMMENT ON COLUMN workflow_steps.capability IS
  'Engine vocabulary (not provider vocabulary). e.g. renderWithQuality, lipSync, upscale.';

COMMENT ON COLUMN workflow_steps.provider_key IS
  'Resolved at dispatch time by capability registry. e.g. openai, kling, nano-banana.';

COMMENT ON COLUMN workflow_steps.output_payload IS
  'Raw provider response — stored for audit and debugging only. Not exposed to UI.';
