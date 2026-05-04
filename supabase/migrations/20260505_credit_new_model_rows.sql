-- ──────────────────────────────────────────────────────────────────────────────
-- 20260505_credit_new_model_rows.sql
--
-- Inserts all locked and provisional credit_model_costs rows that were missing
-- from the original 018_credit_model_costs.sql seed.
--
-- Locked rows  — values confirmed from Zencra pricing spec.
-- PROVISIONAL  — values are inferred or range-based; must be confirmed and
--                replaced with locked spec values before public launch.
--
-- IDEMPOTENT: uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe.
-- If a row already exists (from a prior attempt), the INSERT is skipped.
-- To UPDATE an existing row, use UPDATE WHERE model_key = '...' instead.
--
-- Check constraint: base_credits >= 1 AND base_credits <= 1000.
-- All values below are within this range.
-- ──────────────────────────────────────────────────────────────────────────────


-- ── 1. Image Studio — FLUX Kontext tier upgrades ──────────────────────────────
-- These are distinct model_key rows (not UPDATEs to flux-kontext).
-- Phase 2: activate these rows once the PRO/MAX endpoints are confirmed live.

-- FLUX Kontext PRO (higher quality, slower): 18cr — LOCKED SPEC
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('flux-kontext-pro', 'image', 'FLUX Kontext PRO', 18, false, false)
ON CONFLICT (model_key) DO NOTHING;

-- FLUX Kontext MAX (max quality): 35cr — LOCKED SPEC
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('flux-kontext-max', 'image', 'FLUX Kontext MAX', 35, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 2. Image Studio — Multi-image edit ───────────────────────────────────────
-- Cost varies 35–60cr depending on model and number of inputs.
-- Stored at the minimum (35cr). Dispatch layer must apply the final value
-- based on model and input count — this row is a billing floor, not a ceiling.
-- ⚠ PROVISIONAL — range not yet locked to a single value per model/input combination.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('multi-image-edit', 'image', 'Multi-Image Edit', 35, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 3. Image Studio — FLUX Consistency Pack ──────────────────────────────────
-- Premium pack: consistent character across multiple image generations.
-- ⚠ PROVISIONAL — range is 180–350cr; locked to minimum (180cr) until spec confirms.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('flux-consistency-pack', 'image', 'Premium FLUX Consistency Pack', 180, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 4. Video Studio — Kling 2.6 with audio ───────────────────────────────────
-- Separate model_key for Kling 2.6 + native audio (Omni variant).
-- kling-26-omni: 280cr (5s) — LOCKED SPEC
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('kling-26-omni', 'video', 'Kling 2.6 Omni (with audio)', 280, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 5. Video Studio — Runway Gen-4.5 ─────────────────────────────────────────
-- Runway Gen-4.5, 5s base cost: 800cr — LOCKED SPEC
-- Marked inactive (Phase 2 rollout — provider integration pending).
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('runway-gen4', 'video', 'Runway Gen-4.5 (5s)', 800, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 6. Video Studio — Veo / Sora Premium ─────────────────────────────────────
-- Veo/Sora premium 5s: 1000cr minimum — LOCKED SPEC (spec says "1000+").
-- 1000 is the max allowed by the check constraint; if the real cost exceeds
-- this, the constraint must be updated first via a separate migration.
-- Marked inactive (Phase 2 rollout — provider integration pending).
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('veo-premium', 'video', 'Veo / Sora Premium (5s)', 1000, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 7. Audio Studio — Sound Effect generation ────────────────────────────────
-- Flat cost per generation: 25cr — LOCKED SPEC
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('sound-effect', 'audio', 'Sound Effect', 25, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 8. Audio Studio — Dubbing (per-minute rate) ───────────────────────────────
-- 90 credits PER MINUTE of dubbed audio — LOCKED SPEC.
-- IMPORTANT: base_credits here is the per-minute rate, not a flat cost.
-- The dispatch layer MUST multiply by duration_minutes before calling reserve().
-- Until per-minute billing is implemented in TypeScript (Phase 1B), this row
-- is inactive to prevent incorrect flat-rate charges.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('dubbing', 'audio', 'Dubbing (per min)', 90, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 9. Audio Studio — Voice Isolation (per-minute rate) ──────────────────────
-- 35 credits PER MINUTE of isolated audio — LOCKED SPEC.
-- IMPORTANT: same per-minute semantics as dubbing (see note above).
-- Marked inactive until TypeScript per-minute dispatch is implemented.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('voice-isolation', 'audio', 'Voice Isolation (per min)', 35, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 10. Character Studio — AI Influencer identity base ────────────────────────
-- Single identity generation (base pass): 25cr — LOCKED SPEC
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('influencer-identity-base', 'character', 'AI Influencer Identity Base', 25, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 11. Character Studio — AI Influencer 4 reference angles ──────────────────
-- 4 consistent identity angles from one reference: 80cr — LOCKED SPEC
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('influencer-4-angles', 'character', 'AI Influencer — 4 Reference Angles', 80, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 12. Character Studio — AI Influencer content pack ────────────────────────
-- Batch content generation pack: 120–250cr range.
-- ⚠ PROVISIONAL — stored at minimum (120cr); locked value depends on pack size/type.
-- Marked inactive until pack tiers are defined and locked.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('influencer-content-pack', 'character', 'AI Influencer Content Pack', 120, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── 13. Character Studio — Full Influencer Starter Kit ───────────────────────
-- Complete starter bundle (identity + angles + first content): 400–600cr range.
-- ⚠ PROVISIONAL — stored at minimum (400cr); locked value depends on kit contents.
-- Marked inactive until kit is fully defined.
INSERT INTO public.credit_model_costs (model_key, studio, label, base_credits, is_addon, active)
VALUES ('influencer-starter-kit', 'character', 'Full Influencer Starter Kit', 400, false, false)
ON CONFLICT (model_key) DO NOTHING;


-- ── Verification query (run after migration to confirm) ───────────────────────
-- SELECT model_key, studio, label, base_credits, is_addon, active
-- FROM public.credit_model_costs
-- ORDER BY studio, is_addon, base_credits;
