-- Migration: Add seedream-v5-identity to credit_model_costs
-- Purpose: Register the character-studio Seedream V5 provider so credit_model_costs
--          returns a valid row for "seedream-v5-identity" at billing time.
--
-- Context:
--   "seedream-v5-identity" is a thin wrapper around fal-ai/seedream (Seedream V5)
--   re-registered under studio: "character" for initial AI Influencer candidate casting.
--   It uses the same fal.ai endpoint and the same credit cost as seedream-v5 (15 cr base).
--
-- Pricing:
--   15 cr base — mirrors seedream-v5 (Image Studio). No quality multipliers for casting.
--   Candidates are always 2:3 portrait at standard quality.
--
-- Reversibility:
--   To revert: change DEFAULT_MODEL_KEY in generate/route.ts back to "instant-character".
--   This row can stay; it will simply not be referenced.

INSERT INTO credit_model_costs (
  model_key,
  studio,
  label,
  base_credits,
  active
)
VALUES (
  'seedream-v5-identity',
  'character',
  'Seedream V5 casting engine — 15 cr base per candidate portrait (character studio t2i)',
  15,
  true
)
ON CONFLICT (model_key) DO UPDATE
  SET studio       = EXCLUDED.studio,
      label        = EXCLUDED.label,
      base_credits = EXCLUDED.base_credits,
      active       = EXCLUDED.active;
