-- ─────────────────────────────────────────────────────────────────────────────
-- 034_generation_jobs_character_cols.sql
-- Extends generation_jobs with character identity columns.
-- Creates the table if it doesn't exist yet (the codebase calls it generation_jobs
-- but it may be named differently in older migrations — this ensures it exists).
-- ─────────────────────────────────────────────────────────────────────────────

-- Create generation_jobs if it doesn't exist (idempotent)
CREATE TABLE IF NOT EXISTS generation_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_type  text,
  model_key    text,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- Add character linkage columns
ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS soul_id      uuid REFERENCES soul_ids(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_context  text;

CREATE INDEX IF NOT EXISTS generation_jobs_character_id_idx ON generation_jobs(character_id);

-- RLS: users see only their own jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'generation_jobs' AND policyname = 'users_own_generation_jobs'
  ) THEN
    CREATE POLICY "users_own_generation_jobs" ON generation_jobs
      FOR ALL USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;
