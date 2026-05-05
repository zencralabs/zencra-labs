-- Migration: seedream_v5_lite_model
--
-- Introduces seedream-v5-lite as a new distinct model key (fast + image-edit tier)
-- and retires seedream-4-5 (legacy v4.5 — superseded).
--
-- Context:
--   seedream-v5      → fal-ai/seedream       (primary quality t2i, 15cr)  ← already active
--   seedream-v5-lite → fal-ai/seedream/edit   (fast + edit tier, 8cr)      ← NEW
--   seedream-4-5     → fal-ai/seedream/v4.5   (legacy, was disabled by previous migration)
--
-- The previous migration (20260505_credit_model_key_sync.sql) already inserted
-- seedream-v5 (15cr) and seedream-4-5 (10cr) and deactivated the generic 'seedream' key.
-- This migration:
--   1. Inserts seedream-v5-lite (8cr, active)
--   2. Deactivates seedream-4-5 (legacy — DB row stays for audit history)
--
-- Applied directly to production on 2026-05-05 via Supabase MCP.

-- ── Insert seedream-v5-lite ───────────────────────────────────────────────────
INSERT INTO public.credit_model_costs
  (model_key, studio, label, base_credits, is_addon, active)
VALUES
  ('seedream-v5-lite', 'image', 'Seedream Lite', 8, false, true)
ON CONFLICT (model_key) DO UPDATE
  SET studio       = EXCLUDED.studio,
      label        = EXCLUDED.label,
      base_credits = EXCLUDED.base_credits,
      is_addon     = EXCLUDED.is_addon,
      active       = EXCLUDED.active,
      updated_at   = NOW();

-- ── Deactivate seedream-4-5 (legacy) ─────────────────────────────────────────
UPDATE public.credit_model_costs
SET active = false, updated_at = NOW()
WHERE model_key = 'seedream-4-5';
