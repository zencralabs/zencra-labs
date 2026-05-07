-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260510_pricing_engine_quality_multipliers
--
-- Adds quality_multipliers JSONB column to credit_model_costs.
--
-- Purpose:
--   Enables the centralized pricing engine to apply quality/resolution
--   multipliers without a code deploy. Phase 1 seeds initial values for
--   the three economically unsafe models. All other rows get NULL (= 1.0×
--   flat pricing, no change from today).
--
-- Zero destructive changes:
--   - No existing columns modified
--   - No existing rows removed
--   - All rows without quality_multipliers behave exactly as before
--
-- Format: { "tier": multiplier_float }
--   Image quality:   "1K" | "2K" | "4K"          (Nano Banana Pro, NB2)
--   Video resolution: "720p" | "1080p"            (Kling 3.0 Omni)
--   Multipliers are relative to base_credits.
--   e.g. NB Pro base=12, 4K multiplier=1.75 → 12 × 1.75 = 21 cr (rounded up)
--
-- Observe window:
--   After deploying this migration, the engine runs in OBSERVE mode.
--   Set PRICING_ENGINE_MODE=enforce to activate quality-scaled deductions
--   after the calibration window confirms multiplier accuracy.
--
-- Phase 2 readiness:
--   The frontend pricing manifest endpoint (/api/credits/model-costs) now
--   returns this column so the frontend can hydrate pricing without a
--   static table. In Phase 2 the static MODEL_BASE_CREDITS fallback in
--   model-costs.ts can be removed entirely.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1 — Add nullable column (additive, backwards-compatible)
ALTER TABLE credit_model_costs
  ADD COLUMN IF NOT EXISTS quality_multipliers JSONB DEFAULT NULL;

-- Step 2 — Seed initial multipliers for the three currently unsafe models.
--
-- Nano Banana Pro / NB2 (image quality tiers):
--   1K = 1.0× (no change — current base_credits is the 1K price)
--   2K = 1.25× (~HD surcharge)
--   4K = 1.75× (~Ultra HD surcharge)
--
-- These multipliers are conservative Phase 1 calibration values.
-- Adjust after reviewing provider compute costs during the observe window.
UPDATE credit_model_costs
SET    quality_multipliers = '{"1K": 1.0, "2K": 1.25, "4K": 1.75}'::jsonb
WHERE  model_key IN ('nano-banana-pro', 'nano-banana-2');

-- Kling 3.0 Omni (video resolution):
--   720p  = 1.0× (no change — current base_credits is the 720p price)
--   1080p = 1.5× (Kuaishou official Professional tier pricing ratio)
UPDATE credit_model_costs
SET    quality_multipliers = '{"720p": 1.0, "1080p": 1.5}'::jsonb
WHERE  model_key = 'kling-30-omni';

-- Step 3 — Verify seeding (informational, does not block migration)
DO $$
DECLARE
  nb_pro_ok   BOOLEAN;
  nb2_ok      BOOLEAN;
  omni_ok     BOOLEAN;
BEGIN
  SELECT quality_multipliers IS NOT NULL INTO nb_pro_ok
    FROM credit_model_costs WHERE model_key = 'nano-banana-pro';
  SELECT quality_multipliers IS NOT NULL INTO nb2_ok
    FROM credit_model_costs WHERE model_key = 'nano-banana-2';
  SELECT quality_multipliers IS NOT NULL INTO omni_ok
    FROM credit_model_costs WHERE model_key = 'kling-30-omni';

  IF NOT COALESCE(nb_pro_ok, FALSE) THEN
    RAISE WARNING 'quality_multipliers not set for nano-banana-pro — check migration';
  END IF;
  IF NOT COALESCE(nb2_ok, FALSE) THEN
    RAISE WARNING 'quality_multipliers not set for nano-banana-2 — check migration';
  END IF;
  IF NOT COALESCE(omni_ok, FALSE) THEN
    RAISE WARNING 'quality_multipliers not set for kling-30-omni — check migration';
  END IF;

  RAISE NOTICE 'pricing_engine migration complete: quality_multipliers column added and seeded';
END $$;
