-- ──────────────────────────────────────────────────────────────────────────────
-- 018_credit_model_costs.sql
--
-- Credit cost engine: maps model_key → credit cost for every active studio model.
-- Admin-editable with full audit trail. Guardrails: base_credits >= 1, <= 1000.
--
-- NAMING RULES (HARD):
--   label = user/UI-facing name   (exact provider name for Video/Image/Audio)
--   model_key = internal routing  (never shown to user)
--   FCS labels = cinematic names ONLY — no LTX exposure
--
-- TOOL EXCLUSIONS:
--   Removed entirely: Midjourney, Ideogram, Suno, Udio, PlayHT
--   Hidden Phase 2 (active=false): Kits AI, Cartesia, Stability
--   Deferred entirely: Character Studio (Phase 2 separate migration)
--
-- Idempotent: safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── credit_model_costs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_model_costs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key        TEXT        UNIQUE NOT NULL,
  studio           TEXT        NOT NULL CHECK (studio IN ('image', 'video', 'audio', 'fcs', 'character', 'ugc')),
  label            TEXT        NOT NULL,
  base_credits     INTEGER     NOT NULL CHECK (base_credits >= 1 AND base_credits <= 1000),
  is_addon         BOOLEAN     NOT NULL DEFAULT false,
  parent_model_key TEXT,
  active           BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_model_costs_studio_active_idx
  ON public.credit_model_costs (studio, active);

-- ── credit_model_costs_audit ──────────────────────────────────────────────────
-- Append-only. Every admin edit requires a reason. No updates or deletes.
CREATE TABLE IF NOT EXISTS public.credit_model_costs_audit (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_cost_id    UUID        NOT NULL REFERENCES public.credit_model_costs(id),
  changed_by       UUID        NOT NULL REFERENCES auth.users(id),
  old_base_credits INTEGER     NOT NULL,
  new_base_credits INTEGER     NOT NULL,
  reason           TEXT        NOT NULL,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_model_costs_audit_model_cost_id_idx
  ON public.credit_model_costs_audit (model_cost_id);

-- ── Seed: Image Studio ────────────────────────────────────────────────────────
-- Labels are exact provider names. No abstraction for Image Studio.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES
  ('gpt-image',       'image', 'GPT Image',      2, false, true),
  ('nano-banana',     'image', 'Nano Banana',     3, false, true),
  ('nano-banana-pro', 'image', 'Nano Banana Pro', 4, false, true),
  ('seedream',        'image', 'Seedream',        3, false, true),
  ('flux-kontext',    'image', 'Flux Kontext',    3, false, true)
ON CONFLICT (model_key) DO NOTHING;

-- ── Seed: Video Studio — base models ─────────────────────────────────────────
-- Labels are EXACT provider names. No deviation allowed.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES
  ('kling-25-turbo',   'video', 'Kling 2.5 Turbo',   18, false, true),
  ('kling-26',         'video', 'Kling 2.6',          22, false, true),
  ('kling-30',         'video', 'Kling 3.0',          28, false, true),
  ('kling-30-omni',    'video', 'Kling 3.0 Omni',     32, false, true),
  ('seedance-15',      'video', 'Seedance 1.5',       20, false, true),
  ('seedance-20',      'video', 'Seedance 2.0',       30, false, true),
  ('seedance-20-fast', 'video', 'Seedance 2.0 Fast',  26, false, true)
ON CONFLICT (model_key) DO NOTHING;

-- ── Seed: Video Studio — add-ons (is_addon=true) ─────────────────────────────
-- These are per-generation modifiers summed with base video cost before dispatch.
-- parent_model_key = NULL means applicable to any video model.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, parent_model_key, active)
VALUES
  ('addon-motion-control', 'video', 'Motion Control',    10, true, NULL, true),
  ('addon-start-end',      'video', 'Start + End Frame',  8, true, NULL, true),
  ('addon-multi-element',  'video', 'Multi-element',      6, true, NULL, true)
ON CONFLICT (model_key) DO NOTHING;

-- ── Seed: Audio Studio ────────────────────────────────────────────────────────
-- ElevenLabs v3 keeps exact name per naming rules.
-- elevenlabs-premium is an add-on (+1 credit) on top of base TTS.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, parent_model_key, active)
VALUES
  ('elevenlabs',         'audio', 'ElevenLabs v3',               3, false, NULL,          true),
  ('elevenlabs-premium', 'audio', 'ElevenLabs v3 Premium Voice', 1, true,  'elevenlabs',  true)
ON CONFLICT (model_key) DO NOTHING;

-- ── Seed: FCS — cinematic names ONLY ─────────────────────────────────────────
-- model_key = internal routing (LTX-2.3 via fal.ai — never shown to user)
-- label     = Zencra cinematic name only
-- Flat pricing: no duration or resolution scaling in Phase 1.
-- Cine Director: 1080p, 8s, 24fps
-- Cine Pro:       720p, 6s, 24fps
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES
  ('fcs_ltx23_director', 'fcs', 'Cine Director', 60, false, true),
  ('fcs_ltx23_pro',      'fcs', 'Cine Pro',       45, false, true)
ON CONFLICT (model_key) DO NOTHING;

-- ── Seed: Hidden Phase 2 tools (active=false — no UI exposure) ────────────────
-- model_key exists for future activation. Labels are internal placeholders.
-- UI naming will be defined in Phase 2 before activation.
-- Stability is image-based; Kits AI and Cartesia are audio-based.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES
  ('kits-ai',   'audio', '[Phase 2] Kits AI',   3, false, false),
  ('cartesia',  'audio', '[Phase 2] Cartesia',  3, false, false),
  ('stability', 'image', '[Phase 2] Stability', 3, false, false)
ON CONFLICT (model_key) DO NOTHING;
