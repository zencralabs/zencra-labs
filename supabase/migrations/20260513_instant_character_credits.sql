-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Instant Character credit costs + flux-character backfill
-- Step 6A.2 — fal.ai Instant Character provider activation
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds:
--   • instant-character (8 credits flat) — primary influencer candidate engine
--   • flux-character backfill (8 credits flat) — ensures existing rows don't fail
--     credit estimation if any jobs still route through the FLUX fallback.
--
-- Both are character studio, polling async, portrait-first.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO credit_model_costs (
  model_key,
  studio_type,
  base_credits,
  credit_multiplier,
  notes
)
VALUES
  -- Primary: fal.ai Instant Character
  -- Flat 8 credits per candidate image. No duration add-ons (images only).
  (
    'instant-character',
    'character',
    8,
    1.0,
    'fal.ai Instant Character — 8 cr flat per portrait image, no add-ons'
  ),
  -- Fallback: FLUX.1 Pro via fal.ai (flux-character)
  -- Matches the existing hardcoded estimate of 5–10 cr; set at 8 cr to align.
  (
    'flux-character',
    'character',
    8,
    1.0,
    'FLUX.1 Pro via fal.ai — 8 cr flat per portrait image (fallback path)'
  )
ON CONFLICT (model_key) DO UPDATE
  SET
    base_credits      = EXCLUDED.base_credits,
    credit_multiplier = EXCLUDED.credit_multiplier,
    notes             = EXCLUDED.notes,
    updated_at        = NOW();
