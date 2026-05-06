-- ──────────────────────────────────────────────────────────────────────────────
-- 20260505_credit_costs_correction.sql
--
-- Phase 1A billing correctness fix.
--
-- PROBLEM: credit_model_costs.base_credits had placeholder values (2–60 credits)
-- that never matched the locked Zencra pricing spec. Every generation charged
-- wrong amounts because hooks.ts estimate() had no DB integration at the time
-- these rows were seeded.
--
-- PROBLEM: plans.credits_per_cycle had wrong values (200/800/1700/4000).
-- Spec requires 600/1600/3500/8000.
--
-- PLAN PRICES (plan_prices.amount_cents) are already correct and NOT touched:
--   Starter:  $12/mo, $120/yr
--   Creator:  $29/mo, $290/yr
--   Pro:      $49/mo, $490/yr
--   Business: $89/mo, $890/yr
--
-- IDEMPOTENT: safe to re-run (UPDATE WHERE is idempotent when values match).
-- ──────────────────────────────────────────────────────────────────────────────


-- ── 1. Fix plans.credits_per_cycle ───────────────────────────────────────────
-- These are the credits granted per billing cycle on confirmed payment.
-- Spec: starter=600, creator=1600, pro=3500, business=8000

UPDATE public.plans SET credits_per_cycle = 600  WHERE slug = 'starter';
UPDATE public.plans SET credits_per_cycle = 1600 WHERE slug = 'creator';
UPDATE public.plans SET credits_per_cycle = 3500 WHERE slug = 'pro';
UPDATE public.plans SET credits_per_cycle = 8000 WHERE slug = 'business';


-- ── 2. Fix credit_model_costs — Image Studio ─────────────────────────────────
-- All values locked to Zencra pricing spec (credit burn rules doc).

-- GPT Image: 2 → 15
UPDATE public.credit_model_costs
SET base_credits = 15, updated_at = now()
WHERE model_key = 'gpt-image';

-- Nano Banana (Standard): 3 → 8
UPDATE public.credit_model_costs
SET base_credits = 8, updated_at = now()
WHERE model_key = 'nano-banana';

-- Nano Banana Pro: 4 → 12
UPDATE public.credit_model_costs
SET base_credits = 12, updated_at = now()
WHERE model_key = 'nano-banana-pro';

-- Seedream: 3 → 15
UPDATE public.credit_model_costs
SET base_credits = 15, updated_at = now()
WHERE model_key = 'seedream';

-- Flux Kontext (DEV tier baseline): 3 → 10
-- Note: PRO (18cr) and MAX (35cr) variants require new model_key rows (Phase 2).
UPDATE public.credit_model_costs
SET base_credits = 10, updated_at = now()
WHERE model_key = 'flux-kontext';


-- ── 3. Fix credit_model_costs — Video Studio base models ─────────────────────
-- All costs are for 5-second generations.
-- 10s video = 2× base cost (enforced at dispatch layer, not here).
-- Kling 2.6 with audio = separate Kling Omni price (see kling-30-omni).

-- Kling 2.5 Turbo (5s): 18 → 150
UPDATE public.credit_model_costs
SET base_credits = 150, updated_at = now()
WHERE model_key = 'kling-25-turbo';

-- Kling 2.6 (5s, no audio): 22 → 190
UPDATE public.credit_model_costs
SET base_credits = 190, updated_at = now()
WHERE model_key = 'kling-26';

-- Kling 3.0 (5s): 28 → 320
UPDATE public.credit_model_costs
SET base_credits = 320, updated_at = now()
WHERE model_key = 'kling-30';

-- Kling 3.0 Omni (5s, with audio): 32 → 420
UPDATE public.credit_model_costs
SET base_credits = 420, updated_at = now()
WHERE model_key = 'kling-30-omni';

-- Seedance 1.5 (5s): 20 → 100
-- ⚠ PROVISIONAL — not in spec's named tiers. Inferred as legacy/entry pricing.
-- Replace with a locked spec value before public launch.
UPDATE public.credit_model_costs
SET base_credits = 100, updated_at = now()
WHERE model_key = 'seedance-15';

-- Seedance 2.0 (5s, regular): 30 → 160
-- ⚠ PROVISIONAL — not spec-named. Inferred between Seedance Fast (120) and Kling 2.5T (150).
-- Replace with a locked spec value before public launch.
UPDATE public.credit_model_costs
SET base_credits = 160, updated_at = now()
WHERE model_key = 'seedance-20';

-- Seedance 2.0 Fast (5s): 26 → 120
-- Spec: "Seedance Fast 5s: 120 credits"
UPDATE public.credit_model_costs
SET base_credits = 120, updated_at = now()
WHERE model_key = 'seedance-20-fast';


-- ── 4. Fix credit_model_costs — Video Studio add-ons ─────────────────────────
-- Add-ons are summed with the base model cost per generation.
-- is_addon = true on these rows.

-- Motion Control: 10 → 120 (spec: "+120 credits")
UPDATE public.credit_model_costs
SET base_credits = 120, updated_at = now()
WHERE model_key = 'addon-motion-control';

-- Start + End Frame: 8 → 80 (spec: "+80 credits")
UPDATE public.credit_model_costs
SET base_credits = 80, updated_at = now()
WHERE model_key = 'addon-start-end';

-- Multi-element: 6 → 50
-- ⚠ PROVISIONAL — not in spec. Inferred proportionally between start-end (80) and base models.
-- Replace with a locked spec value before public launch.
UPDATE public.credit_model_costs
SET base_credits = 50, updated_at = now()
WHERE model_key = 'addon-multi-element';


-- ── 5. Fix credit_model_costs — Audio Studio ─────────────────────────────────
-- ElevenLabs base = TTS short (8cr). Premium addon makes total = 20cr (TTS long).

-- ElevenLabs v3 (TTS short, base): 3 → 8
UPDATE public.credit_model_costs
SET base_credits = 8, updated_at = now()
WHERE model_key = 'elevenlabs';

-- ElevenLabs v3 Premium Voice (addon, +12 → total 20): 1 → 12
-- Total with base = 8 + 12 = 20 credits (spec: "TTS long: 20 credits")
UPDATE public.credit_model_costs
SET base_credits = 12, updated_at = now()
WHERE model_key = 'elevenlabs-premium';


-- ── 6. Fix credit_model_costs — FCS ─────────────────────────────────────────
-- Cinematic names map to LTX quality tiers:
--   Cine Pro (720p, 6s)     → LTX Preview tier → 350cr
--   Cine Director (1080p, 8s) → LTX Pro tier    → 600cr

-- Cine Pro (720p, 6s): 45 → 350 (LTX Preview 5s equivalent)
UPDATE public.credit_model_costs
SET base_credits = 350, updated_at = now()
WHERE model_key = 'fcs_ltx23_pro';

-- Cine Director (1080p, 8s): 60 → 600 (LTX Pro 5s equivalent)
UPDATE public.credit_model_costs
SET base_credits = 600, updated_at = now()
WHERE model_key = 'fcs_ltx23_director';


-- ── Verification query (run after migration to confirm) ───────────────────────
-- SELECT model_key, studio, label, base_credits, is_addon, active
-- FROM public.credit_model_costs
-- ORDER BY studio, is_addon, base_credits;
