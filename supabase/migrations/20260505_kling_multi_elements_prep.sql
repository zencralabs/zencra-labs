-- ──────────────────────────────────────────────────────────────────────────────
-- 20260505_kling_multi_elements_prep.sql
--
-- Phase 1A billing prep: insert credit_model_costs placeholder for
-- Kling Multi-Elements Editing.
--
-- STATUS: active = false — not callable in production.
-- The route /api/studio/video/multi-elements returns 503 until:
--   1. KLING_MULTI_ELEMENTS_ENABLED=true is set
--   2. base_credits is updated to a locked confirmed value
--   3. active is set to true in a follow-up migration
--
-- ⚠️  DO NOT change base_credits or active to true without locked pricing.
--     The placeholder value of 1 credit is intentionally incorrect and
--     will never be charged because active = false blocks the entitlement gate.
--
-- Kling Multi-Elements vs Kling 3.0 Omni:
--   Kling 3.0 Omni Advanced Generation → model_key = 'kling-30-omni'
--     endpoint: /v1/videos/omni-video
--     active: true (already in credit_model_costs with base_credits = 420)
--
--   Kling Multi-Elements Editing → model_key = 'kling-multi-elements' (THIS ROW)
--     endpoints (7 — per Kling API docs):
--       POST /v1/videos/multi-elements/init-selection
--       POST /v1/videos/multi-elements/add-selection
--       POST /v1/videos/multi-elements/delete-selection
--       POST /v1/videos/multi-elements/clear-selection
--       GET  /v1/videos/multi-elements/preview-selection
--       POST /v1/videos/multi-elements          (create task)
--       GET  /v1/videos/multi-elements/{id}     (poll task)
--     active: false (placeholder — not chargeable until pricing is locked)
--
-- IDEMPOTENT: INSERT ... ON CONFLICT DO NOTHING (safe to re-run).
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO public.credit_model_costs (
  model_key,
  studio,
  label,
  base_credits,
  is_addon,
  active,
  notes,
  created_at,
  updated_at
)
VALUES (
  'kling-multi-elements',
  'video',
  'Kling Multi-Elements Editing',
  1,       -- ⚠️ PLACEHOLDER — pricing NOT locked. Do not activate with this value.
  false,   -- not an add-on (it is a separate platform workflow, not a per-model feature)
  false,   -- INACTIVE — entitlement gate blocks all charges until this is true
  '⚠️ PROVISIONAL placeholder. Pricing not locked. ' ||
  'active=false blocks dispatch. ' ||
  'Update base_credits to locked per-operation price before activating.',
  now(),
  now()
)
ON CONFLICT (model_key) DO NOTHING;

-- ── Verification query ────────────────────────────────────────────────────────
-- SELECT model_key, studio, label, base_credits, is_addon, active, notes
-- FROM public.credit_model_costs
-- WHERE model_key = 'kling-multi-elements';
