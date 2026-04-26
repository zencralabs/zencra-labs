-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 041 — AI Influencer Handle & Display Name
--
-- Adds:
--   handle       TEXT  — user-facing @Handle, unique per user, auto-generated
--   display_name TEXT  — clean name without @, e.g. "Amanda"
--
-- Handle rules:
--   · Auto-generated from curated name list at creation time
--   · Always prefixed with @ in display
--   · Unique per user (not globally — two users can have @Nova)
--   · Stored without the @ prefix in the DB for clean querying
--   · Editable later (not exposed in UI yet)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_influencers
  ADD COLUMN IF NOT EXISTS handle TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Unique per user (partial index — allows NULL during migration window)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_influencers_user_handle
  ON public.ai_influencers(user_id, handle)
  WHERE handle IS NOT NULL;

COMMENT ON COLUMN public.ai_influencers.handle IS
  'User-facing identity handle, unique per user. Stored without @ prefix. Display as @handle.';

COMMENT ON COLUMN public.ai_influencers.display_name IS
  'Clean display name derived from handle. e.g. "Amanda" for handle "amanda".';
