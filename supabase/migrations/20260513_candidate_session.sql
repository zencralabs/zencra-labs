-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: candidate_session column on ai_influencers
--
-- Problem: Candidate selection state (URLs + snapshot) is ephemeral React state.
-- If the user refreshes after a paid generation, the candidates disappear from
-- the Character Studio selection screen even though credits were already charged.
--
-- Solution: Single JSONB column on the draft ai_influencers record.
-- Written by the client when all polling jobs resolve.
-- Read on AIInfluencerBuilder mount to restore the selection step.
--
-- Shape:
--   {
--     "status":          "generating" | "ready" | "discarded",
--     "expected_count":  number,
--     "candidate_urls":  string[],
--     "snapshot_extra":  {
--       "bodyType":  string,
--       "leftArm":   string,
--       "rightArm":  string,
--       "leftLeg":   string,
--       "rightLeg":  string,
--       "skinArt":   string[]
--     }
--   }
--
-- Lifecycle:
--   generating → set by generate route after dispatching all jobs
--   ready       → set by client after all polling jobs resolve (includes URLs)
--   discarded   → set when user clicks "Discard All" or confirms "+ New" reset
--
-- The profile row already stores all other builder selections (gender, skin_tone,
-- ethnicity_region, Phase A traits, etc.) so snapshot_extra only stores the
-- transient Body Architecture fields that are never persisted elsewhere.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_influencers
  ADD COLUMN IF NOT EXISTS candidate_session jsonb DEFAULT NULL;

-- Partial index — only draft records with a non-null session matter for hydration.
-- Keeps the lookup fast without scanning every ai_influencers row.
CREATE INDEX IF NOT EXISTS idx_ai_influencers_pending_session
  ON public.ai_influencers (user_id, created_at DESC)
  WHERE status = 'draft' AND candidate_session IS NOT NULL;

COMMENT ON COLUMN public.ai_influencers.candidate_session IS
  'JSONB blob persisted when candidate generation completes. '
  'status=generating|ready|discarded. '
  'ready = safe to hydrate on page load. '
  'discarded = user rejected the batch. '
  'candidate_urls = array of image URLs for all completed candidates. '
  'snapshot_extra = transient Body Architecture params (not stored in profile).';
