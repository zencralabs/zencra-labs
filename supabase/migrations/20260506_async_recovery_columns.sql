-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260506_async_recovery_columns.sql
--
-- Adds async job recovery tracking columns to the `assets` table.
--
-- ─── Purpose ─────────────────────────────────────────────────────────────────
--
--   The Phase 1 Async Recovery system (job-polling.ts, job-recovery.ts,
--   stale-job-detector.ts) needs observable state in the DB so that:
--
--     • The GET /api/jobs/pending endpoint can surface genuinely in-flight
--       jobs (assets that are "pending" and not overdue).
--     • Stale detection can be confirmed server-side on recovery.
--     • Retry lineage can be traced (retry_of links the new asset to the
--       original, enabling credit audit and UX attribution).
--     • FCS multi-pass orchestration has parent/child slots ready for Phase 2.
--
-- ─── Columns added ───────────────────────────────────────────────────────────
--
--   last_polled_at  — SET by the status route each time a client successfully
--                     polls the job. Lets the server identify jobs where no
--                     client is polling (e.g. user closed tab) vs. jobs that
--                     are actively being watched.
--
--   stale_at        — SET when the stale-job-detector or polling engine marks
--                     the job stale. Used by admin queries to distinguish
--                     "genuinely lost" from "still in queue" jobs.
--
--   poll_attempts   — Incremented by the status route on each client poll.
--                     Useful for debugging runaway polling loops and for
--                     understanding provider latency distributions.
--
--   recovered       — TRUE when the job was re-registered by recoverPendingJobs()
--                     after a page refresh or tab reopen. Distinguishes jobs
--                     first seen in this session vs. recovered from persistence.
--
--   retry_of        — UUID pointing to the assets.id of the original job this
--                     is a retry of. NULL for non-retry jobs. Allows the UI to
--                     group retry chains in history views.
--
--   parent_job_id   — UUID for FCS multi-pass orchestration. NULL for all
--                     standard (non-FCS) jobs. When FCS ships, the child
--                     video/audio assets will reference the root FCS job here.
--
-- ─── Additive / backward-compatible ──────────────────────────────────────────
--
--   All columns are nullable with sensible defaults. No existing rows are
--   modified. No existing NOT NULL constraints are added. Fully safe to apply
--   to a production database with live traffic.
--
-- ─── Indexes ─────────────────────────────────────────────────────────────────
--
--   Indexes on last_polled_at (for admin stale-job queries) and retry_of /
--   parent_job_id (for lineage lookups) are added as partial indexes
--   (WHERE NOT NULL) to keep the index small.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- last_polled_at — ISO timestamp of the most recent client poll of this job.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS last_polled_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.assets.last_polled_at IS
  'Timestamp of the most recent client status poll for this job. '
  'NULL if the job has never been polled (e.g. was recovered from a crashed tab before any poll).';

-- stale_at — Set when the job is definitively marked stale.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS stale_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.assets.stale_at IS
  'Timestamp when this job was marked stale by the client-side stale-job-detector '
  'or by the polling engine max-duration guard. NULL for non-stale jobs.';

-- poll_attempts — Running count of client poll requests for this job.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS poll_attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.assets.poll_attempts IS
  'Number of times a client has polled the status endpoint for this job. '
  'Incremented on each successful status check. Used for debugging and analytics.';

-- recovered — TRUE when the job was re-registered by the recovery engine.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS recovered boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assets.recovered IS
  'Set to true when this job was re-attached by the client-side job recovery engine '
  'after a page refresh or tab reopen. False for jobs first seen in their originating session.';

-- retry_of — UUID of the original asset this job is retrying.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS retry_of uuid DEFAULT NULL;

COMMENT ON COLUMN public.assets.retry_of IS
  'References assets.id of the original failed/stale job this job is retrying. '
  'NULL for non-retry generations. Allows retry chain auditing and UX grouping.';

-- parent_job_id — UUID for FCS multi-pass job orchestration (Phase 2 hook).
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS parent_job_id uuid DEFAULT NULL;

COMMENT ON COLUMN public.assets.parent_job_id IS
  'FCS multi-pass orchestration: references assets.id of the parent/root FCS job. '
  'NULL for all standard single-pass generations. Reserved for Phase 2 FCS orchestration.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow admin queries to find "pending + not recently polled" jobs quickly.
CREATE INDEX IF NOT EXISTS assets_last_polled_at_idx
  ON public.assets (last_polled_at)
  WHERE last_polled_at IS NOT NULL;

-- Allow queries to find all stale jobs without a full table scan.
CREATE INDEX IF NOT EXISTS assets_stale_at_idx
  ON public.assets (stale_at)
  WHERE stale_at IS NOT NULL;

-- Allow retry chain lookups.
CREATE INDEX IF NOT EXISTS assets_retry_of_idx
  ON public.assets (retry_of)
  WHERE retry_of IS NOT NULL;

-- Allow FCS parent job lookups.
CREATE INDEX IF NOT EXISTS assets_parent_job_id_idx
  ON public.assets (parent_job_id)
  WHERE parent_job_id IS NOT NULL;
