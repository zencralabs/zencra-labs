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

-- Add nano-banana-pro-identity to credit_model_costs
INSERT INTO credit_model_costs (model_key, studio, base_credits, is_active)
VALUES ('nano-banana-pro-identity', 'character', 8, true)
ON CONFLICT (model_key)
DO UPDATE SET
  studio       = EXCLUDED.studio,
  base_credits = EXCLUDED.base_credits,
  is_active    = EXCLUDED.is_active,
  updated_at   = now();
