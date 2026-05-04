-- ──────────────────────────────────────────────────────────────────────────────
-- 000_create_profiles.sql
--
-- Creates public.profiles — the core user-profile table that almost every
-- other table, function, and policy in the system depends on.
--
-- HISTORY: The profiles table was originally created via the Supabase dashboard
-- (not a migration). This caused branch replay to fail because the earliest
-- tracked migration (20260414102650 create_site_settings) and the second one
-- (20260414110541 add_avatar_url_to_profiles) both reference public.profiles
-- without any preceding CREATE TABLE.
--
-- This file backfills the CREATE TABLE so that branch replay works end-to-end.
-- It must be applied with a version ≤ 20260413999999 so it sorts before
-- 20260414102650 in Supabase's migration replay order.
--
-- RELATIONSHIP TO TRACKED MIGRATIONS:
--   20260414110541 add_avatar_url_to_profiles → adds avatar_url (DO NOT include here)
--   20260418075200 add_fcs_access_to_profiles → adds fcs_access (DO NOT include here)
--
-- All remaining columns (avatar_color, phone, phone_verified, email_verified,
-- totp_enabled, passkey_registered, subscription_purchased_at,
-- email_lock_expires_at, updated_at, is_system) were in the table before
-- any tracked migration and are included in the base CREATE TABLE below.
--
-- IDEMPOTENT:
--   • CREATE TABLE IF NOT EXISTS — no-op if profiles already exists
--   • CREATE OR REPLACE FUNCTION — always safe to reapply
--   • DROP TRIGGER IF EXISTS + CREATE TRIGGER — drops and recreates (safe, same body)
--   • RLS and policies — DO blocks with pg_policies check, skip if already present
-- ──────────────────────────────────────────────────────────────────────────────


-- ── 1. Trigger helper functions ───────────────────────────────────────────────
-- Both do the same thing; named differently from different points in history.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ── 2. Base profiles table ────────────────────────────────────────────────────
-- All 21 columns that existed before tracked migration 20260414110541 ran.
-- avatar_url  → added by 20260414110541 (add_avatar_url_to_profiles)
-- fcs_access  → added by 20260418075200 (add_fcs_access_to_profiles)

CREATE TABLE IF NOT EXISTS public.profiles (
  id                       uuid        NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username                 text        UNIQUE,
  full_name                text,
  bio                      text,
  website                  text,
  avatar_color             text        DEFAULT 'gradient-1',
  role                     text        NOT NULL DEFAULT 'user',
  plan                     text        NOT NULL DEFAULT 'free',
  credits                  integer     NOT NULL DEFAULT 10,
  referral_code            text        DEFAULT substr(md5(random()::text), 1, 8) UNIQUE,
  referred_by              uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  phone                    text,
  phone_verified           boolean     NOT NULL DEFAULT false,
  email_verified           boolean     NOT NULL DEFAULT false,
  totp_enabled             boolean     NOT NULL DEFAULT false,
  passkey_registered       boolean     NOT NULL DEFAULT false,
  subscription_purchased_at timestamptz,
  email_lock_expires_at    timestamptz,
  is_system                boolean     NOT NULL DEFAULT false
);


-- ── 3. Non-unique index on plan (for billing/entitlement queries) ─────────────
CREATE INDEX IF NOT EXISTS profiles_plan_idx ON public.profiles (plan);


-- ── 4. Row-level security ─────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY "profiles_select_own"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END;
$$;


-- ── 5. Updated-at trigger ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 6. handle_new_user — auth trigger ────────────────────────────────────────
-- Fires on INSERT into auth.users; creates the corresponding profiles row.
-- email_verified is safe to write here — the column exists in the base table.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email_verified, plan, credits, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'User'),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    'free',
    50,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 7. sync_email_verified — auth trigger ─────────────────────────────────────
-- Syncs email_verified flag when Supabase confirms the user's email address.

CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
      SET email_verified = true
      WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_email_verified();


-- ── Verification query (run after migration to confirm) ───────────────────────
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles'
-- ORDER BY ordinal_position;
