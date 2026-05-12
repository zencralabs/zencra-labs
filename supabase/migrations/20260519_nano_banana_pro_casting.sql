-- Migration: 20260519_nano_banana_pro_casting
-- Purpose: Register nano-banana-pro-casting as the new default Character Studio casting provider.
--
-- Context:
--   The casting engine is switching from Seedream V5 (15 cr) to Nano Banana Pro (12 cr).
--   - Same async polling architecture (task-based via NB record-info endpoint)
--   - Same output URL shape (successFlag + resultImageUrl)
--   - Lower cost per candidate: 15 cr → 12 cr
--   - seedream-v5-identity row is preserved for historical records + rollback
--
-- After this migration:
--   DEFAULT_MODEL_KEY in generate/route.ts → "nano-banana-pro-casting"
--   UI credit displays in InfluencerControls.tsx and InfluencerCanvas.tsx → 12 cr/candidate

-- ── Add nano-banana-pro-casting row ───────────────────────────────────────────
INSERT INTO public.credit_model_costs (
  model_key,
  studio_type,
  display_name,
  base_credits,
  is_premium,
  active
)
VALUES (
  'nano-banana-pro-casting',
  'character',
  'Nano Banana Pro Casting',
  12,
  false,
  true
)
ON CONFLICT (model_key) DO UPDATE SET
  studio_type  = 'character',
  display_name = 'Nano Banana Pro Casting',
  base_credits = 12,
  is_premium   = false,
  active       = true,
  updated_at   = now();

-- ── Deactivate seedream-v5-identity (keep row for history / rollback) ─────────
-- To roll back: set active = true here and change DEFAULT_MODEL_KEY back.
UPDATE public.credit_model_costs
SET    active     = false,
       updated_at = now()
WHERE  model_key  = 'seedream-v5-identity';
