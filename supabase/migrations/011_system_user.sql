-- Migration 011: System user flag
--
-- Purpose: Mark synthetic / demo users so they are excluded from real auth flows,
--          admin stats, and analytics aggregations.
--
-- Applied manually via Supabase dashboard before this migration was written.
-- Recorded here for version-control completeness.
-- Safe to re-apply — all statements are idempotent.

-- 1. Add column (idempotent via IF NOT EXISTS)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_system IS
  'TRUE for synthetic / demo users that should be excluded from all real auth flows, '
  'admin stats, and analytics. Set once at seed time and never changed at runtime.';

-- 2. Mark the known demo / seed user
UPDATE public.profiles
  SET is_system = true
  WHERE id = '00000000-0000-0000-0000-000000000001';

-- 3. Verification queries (run manually to confirm)
-- SELECT id, email, is_system FROM public.profiles WHERE is_system = true;
-- SELECT COUNT(*) FROM public.profiles WHERE is_system = false;
