-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Lip Sync Studio — credit_model_costs entry
-- Studio:    lipsync
-- Model key: sync-lipsync-v3
-- Provider:  Sync Labs v3 via fal.ai (fal-ai/sync-lipsync/v3)
--
-- Billing:
--   • 18 credits per second of output video (round up to nearest 5s block = 90cr/block)
--   • Pro mode multiplier: 1.5× applied in TypeScript hooks, not here
--   • Hard cap: 300 seconds (5 minutes) = max 5,400 credits per job
--
-- Completely separate from:
--   • The existing /api/lipsync/* legacy system (uses generations table, no credit_model_costs row)
--   • The Kling Lip Sync coming-soon placeholder in video registry
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO credit_model_costs (
  model_key,
  studio,
  base_credits,
  per_second_credits,
  per_image_credits,
  max_credits,
  active,
  notes
)
VALUES (
  'sync-lipsync-v3',
  'lipsync',
  90,         -- base cost for first 5s block
  18,         -- credits per second of output duration (18 × 5 = 90 per block)
  0,          -- no per-image charge
  5400,       -- hard cap: 300s × 18cr/s
  true,
  'Sync Labs v3 lip sync via fal.ai. 18cr/s rounded up to nearest 5s block (90cr min). Pro mode = 1.5× applied in TypeScript.'
)
ON CONFLICT (model_key) DO UPDATE SET
  studio             = EXCLUDED.studio,
  base_credits       = EXCLUDED.base_credits,
  per_second_credits = EXCLUDED.per_second_credits,
  per_image_credits  = EXCLUDED.per_image_credits,
  max_credits        = EXCLUDED.max_credits,
  active             = EXCLUDED.active,
  notes              = EXCLUDED.notes;
