-- ─────────────────────────────────────────────────────────────────────────────
-- Zencra Labs — Auth Upgrade Migration
-- Run this in your Supabase SQL Editor or via `supabase db push`
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add new columns to the profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone                     text,
  ADD COLUMN IF NOT EXISTS phone_verified            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_color              smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS totp_enabled              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS passkey_registered        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_purchased_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_lock_expires_at     timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at                timestamptz NOT NULL DEFAULT now();

-- 2. Trigger to auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Auto-create a profiles row when a new auth user signs up
--    (idempotent — safe to re-run)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Sync email_verified flag when Supabase confirms the email
CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
      SET email_verified = true
      WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_email_verified();

-- 5. RLS: users can only read/update their own profile row
--    (assumes RLS is already enabled on profiles)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service-role (used by API routes) bypasses RLS automatically.

-- 6. Index for common lookups
CREATE INDEX IF NOT EXISTS profiles_plan_idx ON public.profiles(plan);
