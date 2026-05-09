-- Migration: 20260511_gpt_image_2_quality_pricing.sql
--
-- PURPOSE
--   Switch gpt-image-2 from flat 20 cr pricing to tiered quality pricing using
--   Zencra's abstraction layer (fast / cinematic / ultra).
--
-- ABSTRACTION LAYER POLICY
--   Zencra quality names are NEVER exposed as OpenAI provider terminology.
--   The translation fast→low / cinematic→medium / ultra→high lives in gpt-image.ts
--   (ZENCRA_TO_OPENAI_QUALITY constant). The DB only stores Zencra vocabulary.
--
-- NEW PRICING
--   fast      = 1.0  × 15 cr =  15 cr  (OpenAI "low"    | ~$0.006/gen)
--   cinematic = 3.667× 15 cr =  55 cr  (OpenAI "medium" | ~$0.063/gen) — DEFAULT
--   ultra     = 12.0 × 15 cr = 180 cr  (OpenAI "high"   | ~$0.211/gen) — hidden in UI
--
-- COMPANION FILES (must stay in sync)
--   src/lib/credits/model-costs.ts  → MODEL_BASE_CREDITS["gpt-image-2"] = 15
--   src/lib/providers/image/gpt-image.ts → ZENCRA_TO_OPENAI_QUALITY constant
--   src/app/studio/image/page.tsx   → qualityOptions for gpt-image-2 model entry
--
-- ROLLBACK
--   UPDATE credit_model_costs
--   SET base_credits = 20, quality_multipliers = NULL
--   WHERE model_key = 'gpt-image-2';

UPDATE credit_model_costs
SET
  base_credits        = 15,
  quality_multipliers = '{"fast": 1.0, "cinematic": 3.667, "ultra": 12.0}'::jsonb
WHERE model_key = 'gpt-image-2';
