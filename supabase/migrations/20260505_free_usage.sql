-- ──────────────────────────────────────────────────────────────────────────────
-- 20260505_free_usage.sql
--
-- Phase 1C: Free-tier usage tracking for users with no active subscription.
--
-- DESIGN INTENT:
--   Zencra offers a permanent free tier — 10 images and 3 videos — with no
--   time limit. This is architecturally distinct from trial_usage (which is
--   time-gated at 7 days). Free-tier users can generate within limits at any
--   time; once exhausted they are redirected to /pricing to subscribe.
--
-- WHY A SEPARATE TABLE (not reusing trial_usage):
--   trial_usage carries a trial_ends_at column and the consume_trial_usage RPC
--   blocks when trial_ends_at < now(). Free tier has no time gate — reusing
--   trial_usage would require removing or hacking that check, polluting the
--   trial path with free-tier logic. A separate table keeps the two paths clean.
--
-- COLUMNS:
--   user_id      — FK to auth.users; one row per user
--   images_used  — lifetime image generations consumed (image + character modes)
--   images_max   — cap (default 10)
--   videos_used  — lifetime video generations consumed (video + ugc modes)
--   videos_max   — cap (default 3)
--   audio_used   — lifetime audio generations consumed
--   audio_max    — cap (default 3)
--   created_at   — row creation timestamp
--   updated_at   — last increment timestamp
--
-- IDEMPOTENT: uses CREATE TABLE IF NOT EXISTS and CREATE OR REPLACE FUNCTION.
-- ──────────────────────────────────────────────────────────────────────────────


-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.free_usage (
  user_id      uuid        NOT NULL PRIMARY KEY
                           REFERENCES auth.users (id) ON DELETE CASCADE,
  images_used  integer     NOT NULL DEFAULT 0,
  images_max   integer     NOT NULL DEFAULT 10,
  videos_used  integer     NOT NULL DEFAULT 0,
  videos_max   integer     NOT NULL DEFAULT 3,
  audio_used   integer     NOT NULL DEFAULT 0,
  audio_max    integer     NOT NULL DEFAULT 3,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Users may read their own row (e.g. for a "X / 10 free images" display)
ALTER TABLE public.free_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own free_usage"
  ON public.free_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- service_role (used by supabaseAdmin) bypasses RLS automatically; no extra policy needed.


-- ── 2. RPC: consume_free_usage ─────────────────────────────────────────────────
--
-- Called AFTER a successful free-tier generation to atomically increment the
-- relevant counter. Does NOT re-check the limit (that happens in checkEntitlement
-- before dispatch — same optimistic pre-check pattern as consume_trial_usage).
--
-- Parameters:
--   p_user_id     — the generating user's ID
--   p_studio_type — one of: 'image', 'character', 'video', 'ugc', 'audio',
--                   'fcs' (fcs is always blocked for free users — never reaches here)
--
-- Returns: jsonb { remaining: { images: int, videos: int, audio: int } }
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consume_free_usage(
  p_user_id     uuid,
  p_studio_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col_used  text;
  v_row       public.free_usage%ROWTYPE;
BEGIN
  -- Map studio type to the column to increment
  CASE p_studio_type
    WHEN 'image', 'character' THEN v_col_used := 'images_used';
    WHEN 'video',  'ugc'      THEN v_col_used := 'videos_used';
    ELSE                           v_col_used := 'audio_used';
  END CASE;

  -- Ensure the row exists (idempotent; first generation creates it)
  INSERT INTO public.free_usage (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Atomically increment the counter
  EXECUTE format(
    'UPDATE public.free_usage SET %I = %I + 1, updated_at = now() WHERE user_id = $1',
    v_col_used, v_col_used
  ) USING p_user_id;

  -- Return remaining counts after increment
  SELECT * INTO v_row FROM public.free_usage WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'remaining', jsonb_build_object(
      'images', GREATEST(0, v_row.images_max - v_row.images_used),
      'videos', GREATEST(0, v_row.videos_max - v_row.videos_used),
      'audio',  GREATEST(0, v_row.audio_max  - v_row.audio_used)
    )
  );
END;
$$;

-- Grant execute to service_role (used by supabaseAdmin in entitlement.ts)
GRANT EXECUTE ON FUNCTION public.consume_free_usage(uuid, text) TO service_role;


-- ── Verification query (run after migration to confirm) ───────────────────────
-- SELECT table_name, column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'free_usage'
-- ORDER BY ordinal_position;
--
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name = 'consume_free_usage';
