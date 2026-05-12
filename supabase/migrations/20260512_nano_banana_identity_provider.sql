-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Nano Banana Pro Identity Provider
-- Date: 2026-05-12
-- Purpose:
--   Register nano-banana-pro-identity in credit_model_costs for the Character Studio.
--   This provider routes post-lock identity-sheet generation through Nano Banana Pro's
--   multi-reference generative conditioning, replacing instant-character as the
--   default identity-sheet engine.
--
-- Credit rate: 8 cr/shot (same as nano-banana-pro-casting — same base model).
-- Studio: character
-- Pack types: identity-sheet (and future: look-pack, scene-pack, pose-pack, social-pack)
--
-- Reversibility:
--   To revert to instant-character: change DEFAULT_MODEL_KEY in packs/route.ts.
--   This row stays active; it will simply not be billed if the model is not called.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Add nano-banana-pro-identity row ─────────────────────────────────────────
INSERT INTO public.credit_model_costs (
  model_key,
  studio,
  label,
  base_credits,
  is_addon,
  active
)
VALUES (
  'nano-banana-pro-identity',
  'character',
  'Nano Banana Pro Identity',
  8,
  false,
  true
)
ON CONFLICT (model_key) DO UPDATE SET
  studio       = 'character',
  label        = 'Nano Banana Pro Identity',
  base_credits = 8,
  is_addon     = false,
  active       = true,
  updated_at   = now();
