-- ──────────────────────────────────────────────────────────────────────────────
-- 20260505_generation_jobs_audit_cols.sql
--
-- Phase 1B: Add credit-audit and job-lifecycle columns to generation_jobs.
--
-- WHY: The assets table already records credits_cost + external_job_id per
-- generation via saveAssetMetadata(). generation_jobs is the supplementary
-- audit table that tracks the full lifecycle — estimate → reserve → finalize/
-- rollback. Without these columns the hooks.ts lifecycle has nowhere to persist
-- audit state, making credit disputes impossible to investigate.
--
-- COLUMNS ADDED:
--   estimated_credits  integer  — credits reserved at job start (hooks.reserve)
--   final_credits      integer  — credits actually charged (hooks.finalize)
--   idempotency_key    text     — client-supplied key; deduplicates retried jobs
--   external_job_id    text     — provider job ID returned from dispatch
--   refunded_at        timestamptz — set when the job is rolled back / refunded
--
-- All columns are nullable — existing rows have no credit-audit data and must
-- not be broken. Backfilling is not attempted (historical data unavailable).
--
-- IDEMPOTENT: uses ADD COLUMN IF NOT EXISTS; safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────


-- ── 1. Credit audit columns ───────────────────────────────────────────────────

-- Credits reserved (deducted) at the moment of job dispatch.
-- Written by hooks.reserve(); NULL until reserve fires.
ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS estimated_credits integer;

-- Credits actually charged after job completes.
-- Written by hooks.finalize(); NULL until finalize fires.
-- May differ from estimated_credits when actual cost varies (e.g. longer video).
ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS final_credits integer;


-- ── 2. Job deduplication / tracing columns ────────────────────────────────────

-- Client-supplied idempotency key passed in the generation request.
-- Allows safe retries: if a second request arrives with the same key within
-- a session window, the API returns the existing job instead of creating a new one.
-- NULL for legacy jobs (no key was passed). Must be unique when non-NULL
-- (enforced by the partial unique index below).
ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Provider-assigned job ID returned by the dispatch layer.
-- Mirrors assets.external_job_id; stored here for webhook correlation when
-- no asset has been created yet (e.g. job failed before asset was saved).
-- NULL until the provider confirms job acceptance.
ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS external_job_id text;


-- ── 3. Refund timestamp ───────────────────────────────────────────────────────

-- Set when hooks.rollback() fires or an admin issues a manual credit refund.
-- NULL = job was never rolled back. Non-NULL = refunded (credits restored).
ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;


-- ── 4. Indexes ───────────────────────────────────────────────────────────────

-- Partial unique index: idempotency_key must be unique per user when non-NULL.
-- Allows: two users to share the same client-generated key (UUID from client).
-- Prevents: double-spend from a retried request with the same key.
CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_idempotency_key_idx
  ON public.generation_jobs (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Fast lookup of jobs by external provider job ID (webhook correlation).
CREATE INDEX IF NOT EXISTS generation_jobs_external_job_id_idx
  ON public.generation_jobs (external_job_id)
  WHERE external_job_id IS NOT NULL;

-- Fast lookup of refunded jobs (admin / billing audit queries).
CREATE INDEX IF NOT EXISTS generation_jobs_refunded_at_idx
  ON public.generation_jobs (refunded_at)
  WHERE refunded_at IS NOT NULL;


-- ── Verification query (run after migration to confirm) ───────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'generation_jobs'
-- ORDER BY ordinal_position;
