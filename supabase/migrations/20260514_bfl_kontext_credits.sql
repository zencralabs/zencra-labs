-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: BFL Kontext credit cost row
-- Step 6B — Look Pack generation via direct Black Forest Labs API
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds:
--   • bfl-kontext (8 credits per image) — FLUX.1 Kontext [pro] via direct BFL API
--     Used exclusively for AI Influencer Look Pack generation (4-image batch).
--     4-image Look Pack total = 32 credits.
--
-- BFL pricing reference:
--   FLUX.1 Kontext [pro]  = $0.04/image infra
--   FLUX.1 Kontext [max]  = $0.08/image infra (not exposed in UI yet)
--   8 cr/image provides margin headroom at current credit pricing.
--
-- Architecture note:
--   bfl-kontext   = direct BFL API  → Look Pack identity-preserving variation
--   flux-kontext  = fal-hosted      → Image Studio general context editing (unchanged)
--   These are distinct model keys with distinct DB rows.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO credit_model_costs (
  model_key,
  studio_type,
  base_credits,
  credit_multiplier,
  notes
)
VALUES
  (
    'bfl-kontext',
    'image',
    8,
    1.0,
    'FLUX.1 Kontext [pro] via direct BFL API — 8 cr/image flat; 4-image Look Pack = 32 cr; infra $0.04/image'
  )
ON CONFLICT (model_key) DO UPDATE
  SET
    base_credits      = EXCLUDED.base_credits,
    credit_multiplier = EXCLUDED.credit_multiplier,
    notes             = EXCLUDED.notes,
    updated_at        = NOW();
