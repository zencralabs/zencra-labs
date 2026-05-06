-- Migration: credit_model_costs key sync — align DB keys with code registry
--
-- Problem: Several model_key values in credit_model_costs did not match
-- the exact modelKey strings used in the TypeScript provider registry.
-- lookupModelCost(key) does an exact-string match — any mismatch causes
-- the model to fall back to provisional studio-level pricing.
--
-- Changes:
--   IMAGE STUDIO
--   1. Deactivate 'nano-banana'    → insert 'nano-banana-standard' (8cr)
--   2. Insert 'nano-banana-2'      (10cr) — was missing entirely
--   3. Deactivate 'seedream'       → insert 'seedream-v5' (15cr)
--   4. Insert 'seedream-4-5'       (10cr) — was missing entirely
--
--   VIDEO STUDIO
--   5. Deactivate 'kling-25-turbo' → insert 'kling-25' (150cr)
--      (registry key is 'kling-25'; 'turbo' is the Kling API model ID suffix,
--       not the Zencra model key)
--
-- All deactivated rows are kept for audit history (active = false).
-- Applied directly to production on 2026-05-05 via Supabase MCP.

-- ── IMAGE: deactivate old generic keys ───────────────────────────────────────
UPDATE public.credit_model_costs
SET active = false, updated_at = NOW()
WHERE model_key IN ('nano-banana', 'seedream');

-- ── IMAGE: insert correct keys ────────────────────────────────────────────────
INSERT INTO public.credit_model_costs
  (model_key, studio, label, base_credits, is_addon, active)
VALUES
  ('nano-banana-standard', 'image', 'Nano Banana Standard', 8,  false, true),
  ('nano-banana-2',        'image', 'Nano Banana 2',        10, false, true),
  ('seedream-v5',          'image', 'Seedream v5',          15, false, true),
  ('seedream-4-5',         'image', 'Seedream 4.5',         10, false, true)
ON CONFLICT (model_key) DO UPDATE
  SET studio       = EXCLUDED.studio,
      label        = EXCLUDED.label,
      base_credits = EXCLUDED.base_credits,
      is_addon     = EXCLUDED.is_addon,
      active       = EXCLUDED.active,
      updated_at   = NOW();

-- ── VIDEO: deactivate old key ─────────────────────────────────────────────────
UPDATE public.credit_model_costs
SET active = false, updated_at = NOW()
WHERE model_key = 'kling-25-turbo';

-- ── VIDEO: insert correct key ─────────────────────────────────────────────────
INSERT INTO public.credit_model_costs
  (model_key, studio, label, base_credits, is_addon, active)
VALUES
  ('kling-25', 'video', 'Kling 2.5 Turbo', 150, false, true)
ON CONFLICT (model_key) DO UPDATE
  SET studio       = EXCLUDED.studio,
      label        = EXCLUDED.label,
      base_credits = EXCLUDED.base_credits,
      is_addon     = EXCLUDED.is_addon,
      active       = EXCLUDED.active,
      updated_at   = NOW();
