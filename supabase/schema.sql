-- ============================================================
-- Zencra Labs — Full Database Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- Extended user data beyond Supabase auth.users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE,
  full_name     TEXT,
  bio           TEXT,
  website       TEXT,
  avatar_color  TEXT DEFAULT 'gradient-1',  -- gradient-1 to gradient-5
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'creator')),
  credits       INTEGER NOT NULL DEFAULT 10,  -- free signup bonus
  referral_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  referred_by   UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), ' ', '_'))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CREDIT TRANSACTIONS
-- Every credit change (top-up, spend, gift, refund) is logged
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
                  'purchase',   -- bought a credit pack
                  'spend',      -- used credits to generate
                  'gift_sent',  -- gifted credits to someone
                  'gift_recv',  -- received gift credits
                  'referral',   -- earned from referral
                  'promo',      -- redeemed promo code
                  'refund',     -- refund from failed generation
                  'admin'       -- manual adjustment by admin
                )),
  amount        INTEGER NOT NULL,   -- positive = earned, negative = spent
  balance_after INTEGER NOT NULL,   -- snapshot of balance after transaction
  description   TEXT,
  metadata      JSONB DEFAULT '{}', -- tool name, generation id, pack id, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_tx_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_tx_created_at ON public.credit_transactions(created_at DESC);

-- ============================================================
-- GENERATIONS
-- Every AI generation request (image, video, audio)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tool            TEXT NOT NULL,           -- 'dalle3', 'kling', 'runway', etc.
  tool_category   TEXT NOT NULL CHECK (tool_category IN ('image', 'video', 'audio', 'text')),
  prompt          TEXT NOT NULL,
  negative_prompt TEXT,
  parameters      JSONB DEFAULT '{}',      -- size, style, duration, etc.
  result_url      TEXT,                    -- output file URL (Supabase storage)
  result_urls     TEXT[],                  -- multiple outputs
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  credits_used    INTEGER NOT NULL DEFAULT 0,
  api_cost_usd    NUMERIC(10, 6),          -- actual API cost (internal)
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_status ON public.generations(status);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);

-- ============================================================
-- PAYMENTS
-- Razorpay payment records for credit top-ups and subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature  TEXT,
  type                TEXT NOT NULL CHECK (type IN ('credit_pack', 'subscription')),
  amount_usd          NUMERIC(10, 2) NOT NULL,
  credits_purchased   INTEGER,
  pack_id             TEXT,                -- 'starter_50', 'pro_200', etc.
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_razorpay_order ON public.payments(razorpay_order_id);

-- ============================================================
-- GIFT CARDS
-- Credit gifts between users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 12)),
  sender_id     UUID NOT NULL REFERENCES public.profiles(id),
  recipient_id  UUID REFERENCES public.profiles(id),
  recipient_email TEXT,
  credits       INTEGER NOT NULL,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'redeemed', 'expired')),
  redeemed_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROMO CODES
-- Discount / free credit codes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT UNIQUE NOT NULL,
  credits         INTEGER NOT NULL DEFAULT 0,
  discount_pct    INTEGER DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  max_uses        INTEGER,
  current_uses    INTEGER NOT NULL DEFAULT 0,
  valid_from      TIMESTAMPTZ DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default promo codes
INSERT INTO public.promo_codes (code, credits, max_uses) VALUES
  ('ZENCRA2024',  25, 1000),
  ('WELCOME25',   25, 5000),
  ('CREATOR50',   50,  500),
  ('LAUNCHDAY',  100,  200)
ON CONFLICT (code) DO NOTHING;

-- Track which users redeemed which promo codes
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_id    UUID NOT NULL REFERENCES public.promo_codes(id),
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(promo_id, user_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Users can only see/edit their own data
-- ============================================================
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions   ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Credit transactions
CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- Generations
CREATE POLICY "Users can view own generations"
  ON public.generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generations"
  ON public.generations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payments
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- Gift cards
CREATE POLICY "Users can view sent/received gifts"
  ON public.gift_cards FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can insert gift cards"
  ON public.gift_cards FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Promo codes (everyone can read active codes to validate)
CREATE POLICY "Anyone can read active promo codes"
  ON public.promo_codes FOR SELECT USING (is_active = true);

-- Promo redemptions
CREATE POLICY "Users can view own redemptions"
  ON public.promo_redemptions FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- ADMIN VIEW (bypasses RLS for admin dashboard)
-- Admins use service role key — no policies needed
-- ============================================================

-- Helpful admin stats view
CREATE OR REPLACE VIEW public.admin_stats AS
SELECT
  (SELECT COUNT(*) FROM public.profiles) as total_users,
  (SELECT COUNT(*) FROM public.profiles WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
  (SELECT COUNT(*) FROM public.generations) as total_generations,
  (SELECT COUNT(*) FROM public.generations WHERE created_at > NOW() - INTERVAL '24 hours') as generations_24h,
  (SELECT COALESCE(SUM(amount_usd), 0) FROM public.payments WHERE status = 'paid') as total_revenue_usd,
  (SELECT COUNT(*) FROM public.payments WHERE status = 'paid') as total_orders;
