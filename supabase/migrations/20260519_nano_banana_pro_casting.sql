-- Migration: 20260519_nano_banana_pro_casting
-- Purpose: Register nano-banana-pro-casting as the new default Character Studio casting provider.
--
-- Context:
--   The casting engine is switching from Seedream V5 (15 cr) to Nano Banana Pro (8 cr).
--   - Same async polling architecture (task-based via NB record-info endpoint)
--   - Same output URL shape (successFlag + resultImageUrl)
--   - Lower cost per candidate: 15 cr → 8 cr (casting is exploratory; price should be repeatable)
--   - seedream-v5-identity row is preserved for historical records + rollback
--
-- Pricing rationale:
--   Stage 1 casting = exploration. 8 cr/candidate feels friendly and encourages iteration.
--   Premium continuity (Identity Lock, Identity Chain) will price higher in later stages.
--
-- After this migration:
--   DEFAULT_MODEL_KEY in generate/route.ts → "nano-banana-pro-casting"
--   UI credit displays in InfluencerControls.tsx and InfluencerCanvas.tsx → 8 cr/candidate

-- ── Add nano-banana-pro-casting row ───────────────────────────────────────────
INSERT INTO public.credit_model_costs (
  model_key,
  studio,
  label,
  base_credits,
  is_addon,
  active
)
VALUES (
  'nano-banana-pro-casting',
  'character',
  'Nano Banana Pro Casting',
  8,
  false,
  true
)
ON CONFLICT (model_key) DO UPDATE SET
  studio       = 'character',
  label        = 'Nano Banana Pro Casting',
  base_credits = 8,
  is_addon     = false,
  active       = true,
  updated_at   = now();

-- ── Deactivate seedream-v5-identity (keep row for history / rollback) ─────────
-- To roll back: set active = true here and change DEFAULT_MODEL_KEY back.
UPDATE public.credit_model_costs
SET    active     = false,
       updated_at = now()
WHERE  model_key  = 'seedream-v5-identity';
