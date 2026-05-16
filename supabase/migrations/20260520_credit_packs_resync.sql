-- ============================================================
-- Migration 20260520: credit_packs_resync
--
-- Purpose: Deactivate stale seeded credit packs and replace
-- with four locked active booster packs.
--
-- Safety rules:
--   - Does NOT edit migration history
--   - Does NOT delete old rows (preserves FK integrity with orders table)
--   - Uses additive UPDATE + INSERT pattern only
--
-- Old rows (Starter/Creator/Studio/Pro from 003_credit_packs.sql)
-- are retained with active = false so historical order records
-- continue to resolve correctly.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Deactivate all currently active credit packs
UPDATE public.credit_packs
SET    active = false
WHERE  active = true;

-- Step 2: Insert the four locked booster packs
INSERT INTO public.credit_packs
  (name, credits, price_cents, currency, active, sort_order, metadata)
VALUES
  (
    'Light Boost',   500,  1500, 'usd', TRUE, 1,
    '{"color": "#2563EB", "popular": false, "description": "Quick top-up for everyday creation"}'
  ),
  (
    'Creator Boost', 1000, 2500, 'usd', TRUE, 2,
    '{"color": "#A855F7", "popular": true, "description": "Most popular — perfect for regular creators"}'
  ),
  (
    'Pro Boost',     2500, 5900, 'usd', TRUE, 3,
    '{"color": "#0EA5A0", "popular": false, "description": "High-volume generation at a great rate"}'
  ),
  (
    'Studio Boost',  5000, 9900, 'usd', TRUE, 4,
    '{"color": "#F59E0B", "popular": false, "description": "Maximum credits for power creators"}'
  );
