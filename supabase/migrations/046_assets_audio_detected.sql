-- Migration 046 — assets.audio_detected
-- Persists server-side MP4 audio track detection result so the
-- AudioBadge in VideoResultsLibrary survives page refreshes.
--
-- Values:
--   true  — audio track confirmed present with real samples (mp4box or manual scan)
--   false — no audio track, or track present but zero samples (stubbed/silent)
--   null  — detection inconclusive, or video not yet analysed (pre-migration rows)

ALTER TABLE assets ADD COLUMN IF NOT EXISTS audio_detected BOOLEAN;

COMMENT ON COLUMN assets.audio_detected IS
  'MP4 audio track detection result written by mirrorVideoToStorage. '
  'true=audio confirmed, false=no audio, null=inconclusive/not-yet-checked.';
