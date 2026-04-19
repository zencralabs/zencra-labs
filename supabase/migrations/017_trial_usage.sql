-- ──────────────────────────────────────────────────────────────────────────────
-- 017_trial_usage.sql
--
-- Isolated trial tracking. NEVER touches profiles.credits or credit_transactions.
-- Per-category limits: 10 images, 3 videos, 3 audio.
-- Trial duration: 7 days maximum.
-- Hard stop on exhaustion — no fallback generation.
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── trial_usage ───────────────────────────────────────────────────────────────
-- One row per user. Created on signup alongside the trialing subscription.
-- images_max/videos_max/audio_max are seeded as constants — do not change.
-- trial_ends_at = subscription.created_at + 7 days (set at signup).
-- exhausted_at: set when ALL three categories hit their max.
-- converted_at: set when the user completes their first confirmed payment.

CREATE TABLE IF NOT EXISTS public.trial_usage (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  images_used  INTEGER     NOT NULL DEFAULT 0,
  images_max   INTEGER     NOT NULL DEFAULT 10,
  videos_used  INTEGER     NOT NULL DEFAULT 0,
  videos_max   INTEGER     NOT NULL DEFAULT 3,
  audio_used   INTEGER     NOT NULL DEFAULT 0,
  audio_max    INTEGER     NOT NULL DEFAULT 3,
  trial_ends_at TIMESTAMPTZ NOT NULL,
  exhausted_at  TIMESTAMPTZ,
  converted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS trial_usage_user_id_idx ON public.trial_usage (user_id);

-- ── consume_trial_usage ───────────────────────────────────────────────────────
-- Atomically checks and increments the appropriate trial counter.
-- Called AFTER a successful trial generation (not before dispatch).
--
-- p_user_id     : the generating user's UUID
-- p_studio_type : 'image' | 'video' | 'audio' | 'character' | 'ugc' | 'fcs'
--
-- Returns JSONB:
--   { allowed: true,  remaining: { images, videos, audio } }
--   { allowed: false, reason: 'TRIAL_EXPIRED' | 'TRIAL_EXHAUSTED' | 'FCS_NOT_ALLOWED' | ... }
--
-- Category mapping:
--   character → image slot
--   ugc       → video slot
--   fcs       → always blocked (FCS requires paid Pro/Business)

CREATE OR REPLACE FUNCTION public.consume_trial_usage(
  p_user_id     UUID,
  p_studio_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row   public.trial_usage%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.trial_usage WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'NO_TRIAL_RECORD');
  END IF;

  -- FCS is always blocked during trial regardless of usage state
  IF p_studio_type = 'fcs' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'FCS_NOT_ALLOWED');
  END IF;

  -- Check trial time window
  IF v_row.trial_ends_at < now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'TRIAL_EXPIRED');
  END IF;

  -- Route to correct category and check/increment
  IF p_studio_type IN ('image', 'character') THEN
    IF v_row.images_used >= v_row.images_max THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'TRIAL_EXHAUSTED', 'category', 'images');
    END IF;
    UPDATE public.trial_usage
      SET images_used = images_used + 1
      WHERE user_id = p_user_id;

  ELSIF p_studio_type IN ('video', 'ugc') THEN
    IF v_row.videos_used >= v_row.videos_max THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'TRIAL_EXHAUSTED', 'category', 'videos');
    END IF;
    UPDATE public.trial_usage
      SET videos_used = videos_used + 1
      WHERE user_id = p_user_id;

  ELSIF p_studio_type = 'audio' THEN
    IF v_row.audio_used >= v_row.audio_max THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'TRIAL_EXHAUSTED', 'category', 'audio');
    END IF;
    UPDATE public.trial_usage
      SET audio_used = audio_used + 1
      WHERE user_id = p_user_id;

  ELSE
    RETURN jsonb_build_object('allowed', false, 'reason', 'UNKNOWN_STUDIO_TYPE');
  END IF;

  -- Re-fetch updated row to return accurate remaining counts
  SELECT * INTO v_row FROM public.trial_usage WHERE user_id = p_user_id;

  -- Mark exhausted if all categories are now at max
  IF  v_row.images_used >= v_row.images_max
  AND v_row.videos_used >= v_row.videos_max
  AND v_row.audio_used  >= v_row.audio_max
  AND v_row.exhausted_at IS NULL THEN
    UPDATE public.trial_usage
      SET exhausted_at = now()
      WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', jsonb_build_object(
      'images', GREATEST(0, v_row.images_max - v_row.images_used),
      'videos', GREATEST(0, v_row.videos_max - v_row.videos_used),
      'audio',  GREATEST(0, v_row.audio_max  - v_row.audio_used)
    )
  );
END;
$$;
