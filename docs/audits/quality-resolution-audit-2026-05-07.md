# Provider-Native Quality / Resolution Audit — Zencra Image Studio

**Date:** 2026-05-07  
**Status:** AUDIT ONLY — no implementation approved yet  
**Purpose:** Full 10-point analysis of all image models before any quality/resolution feature is built or changed  
**Rule:** Do NOT create or extend a fake universal quality selector. Every model must use its own provider-native controls.

---

## Scope

Models audited: NB Standard, NB Pro, NB2, GPT Image 1 (gpt-image-1 / "DALL·E"), GPT Image 2 (gpt-image-2), Seedream v5, Seedream v5 Lite, Seedream 4.5 (inactive), FLUX Kontext (not in UI)

Files read: `nano-banana.ts`, `gpt-image.ts`, `seedream.ts`, `flux-kontext.ts`, `engine.ts`, `model-costs/route.ts`, `image/page.tsx` (relevant sections)

---

## Audit Dimension Key

Each model is evaluated across 10 dimensions:

1. **Current UI behaviour** — what the user sees today
2. **Provider-native API quality/resolution support** — what the upstream API actually accepts
3. **Current payload field** — what is actually sent to the provider today
4. **Current frontend→backend quality mapping** — how the UI value becomes the API value
5. **Pricing engine multiplier status** — is it seeded in `STATIC_QUALITY_MULTIPLIERS` / DB?
6. **UI changes required** — what must change in `page.tsx` / `StudioModel`
7. **Provider adapter changes required** — what must change in the `*. ts` provider file
8. **Backend billing changes required** — DB rows, hooks.ts, enforce mode
9. **Risk of undercharging / overcharging today** — severity assessment
10. **Safe rollout classification** — phase and dependencies

---

## MODEL 1 — Nano Banana Standard (`nano-banana-standard`)

### 1. Current UI behaviour
`allowedQualities: ["1K"]` — quality selector is hidden (single option). User sees no quality control.

### 2. Provider-native API support
NB Standard endpoint is a fixed-resolution service. The `resolveResolution()` function in `nano-banana.ts` hard-returns `"1K"` for `variant === "standard"` regardless of any quality input. The provider does not offer quality tiers on the standard endpoint.

### 3. Current payload field
`resolution` field is set to `"1K"` unconditionally. No quality is forwarded from `providerParams`.

### 4. Current frontend→backend mapping
`quality` is accepted in state but `resolveResolution("standard", quality)` ignores it and always returns `"1K"`. Mapping is correct for the current API contract.

### 5. Pricing engine multiplier status
No entry in `STATIC_QUALITY_MULTIPLIERS` — flat pricing at base cost (currently 8 cr). Correct.

### 6. UI changes required
**None.** Single-quality model, no selector needed. Keep `allowedQualities: ["1K"]` to suppress the UI pill.

### 7. Provider adapter changes required
**None.** `resolveResolution("standard", ...)` is correctly locked to `"1K"`.

### 8. Backend billing changes required
**None.** Flat billing is correct for this model.

### 9. Risk today
**None.** Behaviour is correct end-to-end. No user confusion, no pricing gap.

### 10. Rollout classification
**No action required.** ✅

---

## MODEL 2 — Nano Banana Pro (`nano-banana-pro`)

### 1. Current UI behaviour
`allowedQualities: ["1K", "2K", "4K"]` — three-tier quality selector is shown. Default is `"1K"`. The selector label reads `"1K / 2K / 4K"` which matches the NB API's own terminology.

### 2. Provider-native API support
NB Pro natively accepts `resolution: "1K" | "2K" | "4K"` as a top-level JSON field. The provider API documents these as Standard, HD, and Ultra HD tiers. The mapping is 1:1 — the UI strings ARE the provider strings.

### 3. Current payload field
`payload.resolution = resolveResolution("pro", quality)` — the function returns `"1K"`, `"2K"`, or `"4K"` directly from the UI quality string. Field name: `resolution`. ✅

### 4. Current frontend→backend mapping
`quality` (from `providerParams.quality`) → `resolveResolution("pro", quality)` → `resolution` field in NB API body. Correct and lossless.

### 5. Pricing engine multiplier status
✅ **Seeded correctly:** `"nano-banana-pro": { "1K": 1.0, "2K": 1.25, "4K": 1.75 }` in both `STATIC_QUALITY_MULTIPLIERS` and (should be) `credit_model_costs` DB. Currently in **observe mode** — backend charges flat cost while logging the delta.

The two-line fix committed in session `26f436b` now passes `{ quality }` to `getGenerationCreditCost()` — the frontend display is now quality-aware. ✅

### 6. UI changes required
**None.** Quality strings and selector are correct. Consider adding descriptive labels per tier in a future polish pass (e.g. `1K – Standard`, `2K – HD`, `4K – Ultra HD`) but this is cosmetic only.

### 7. Provider adapter changes required
**None.** `resolveResolution` + `payload.resolution` are correctly wired.

### 8. Backend billing changes required
**Observe → Enforce transition (future):** After the calibration window confirms multiplier accuracy, set `PRICING_ENGINE_MODE=enforce` in Vercel env vars. This is a one-line env change, not a code deploy.  
Prerequisite: review pricing delta logs in Vercel function logs for this model for 7+ days first.

### 9. Risk today
**Low.** In observe mode, users pay the lower flat cost. No undercharge risk to Zencra until enforce mode is activated. No overcharge risk to the user.

### 10. Rollout classification
**Phase 0.5 (calibration window):** Already in progress. Action: monitor observe logs. Flip to enforce after 7-day calibration. No code changes needed.

---

## MODEL 3 — Nano Banana 2 (`nano-banana-2`)

### 1. Current UI behaviour
`allowedQualities: ["1K", "2K", "4K"]` — same three-tier selector as NB Pro. User sees and can select 2K and 4K options.

### 2. Provider-native API support
**Critical discrepancy.** NB2 does NOT use a `resolution` field. The NB2 API uses explicit `width` and `height` integer parameters. The `NB2_DIMENSION_MAP` in `nano-banana.ts` maps aspect ratios to fixed pixel dimensions (e.g. `1:1 → 1024×1024`, `16:9 → 1792×1024`). These are all approximately 1K-equivalent.

There are NO entries in `NB2_DIMENSION_MAP` for 2K or 4K dimensions. The map currently has no concept of resolution scaling.

**Whether NB2's actual API accepts higher-res `width`/`height` values is UNVERIFIED** — the fal.ai/NB2 documentation has not been checked in this audit. This is the critical unknown.

### 3. Current payload field
`payload.width = nb2Dims.width` and `payload.height = nb2Dims.height` — sourced from `NB2_DIMENSION_MAP[aspectRatio]`. The `quality` value from `providerParams` is **silently ignored** by the adapter. No quality or resolution field is forwarded to NB2.

### 4. Current frontend→backend mapping
The UI `quality` state is passed to `getGenerationCreditCost()` (now quality-aware post-`26f436b`), and is passed into `providerParams.quality` in the generate request body — but the NB2 adapter does not read `providerParams.quality`. It reads `input.aspectRatio` to look up dimensions from `NB2_DIMENSION_MAP`. The quality value disappears at the adapter boundary.

**Result:** User selects `4K`, sees a higher credit cost displayed (e.g. 21 cr instead of 12 cr due to ×1.75 multiplier), pays the higher displayed amount (once enforce mode is active), but receives a `1024×1024` image. **This is an overcharge for the user and potentially a false advertising issue.**

### 5. Pricing engine multiplier status
`"nano-banana-2": { "1K": 1.0, "2K": 1.25, "4K": 1.75 }` is seeded identically to NB Pro. In observe mode this is harmless. In enforce mode it would charge users 75% more for the same 1K output.

### 6. UI changes required
**Two acceptable paths — decision needed before build:**

**Path A (Correct if NB2 supports higher-res dims):** Research NB2's actual API width/height limits. If it supports `2048×2048` or `4096×4096`, expand `NB2_DIMENSION_MAP` with 2K and 4K entries per aspect ratio. UI stays the same.

**Path B (If NB2 is 1K-only):** Set `allowedQualities: ["1K"]` for `nano-banana-2` in the `MODELS` array. Remove the misleading 2K/4K selector. Remove quality multipliers from the engine for this model.

### 7. Provider adapter changes required
**Path A:** Extend `NB2_DIMENSION_MAP` with 2K and 4K dimension entries. Add logic in the adapter to select the right dimension set based on `quality`.

**Path B:** No adapter changes needed — current behavior (ignoring quality, using 1K dims) is already Path B's target.

### 8. Backend billing changes required
**Path A:** DB multipliers for `nano-banana-2` stay as seeded. Activate enforce mode after calibration.

**Path B:** Remove or zero out quality multipliers for `nano-banana-2` in `credit_model_costs` DB. Ensure `STATIC_QUALITY_MULTIPLIERS["nano-banana-2"]` is removed from `engine.ts`.

### 9. Risk today
**Medium-high — BLOCKER for enforce mode.** In observe mode, the financial damage is zero (user pays flat rate). But if enforce mode is activated for NB2 before this is resolved, users would be charged 2K/4K prices for 1K output. This must be resolved before enforce mode is activated for this model.

### 10. Rollout classification
**Phase 1A (Research first):** Check NB2 API documentation for `width`/`height` maximum values. This is a one-hour research task. Result determines Path A or B. Do not activate enforce mode for `nano-banana-2` until resolved.

**Immediate safeguard:** Add a separate enforce-mode flag per model if possible, or ensure NB2 stays in observe mode even after NB Pro goes to enforce.

---

## MODEL 4 — GPT Image 1 (`gpt-image-1` / shown as "DALL·E" in UI)

### 1. Current UI behaviour
`allowedQualities: ["1K", "2K"]` — two-option selector. Default is `"1K"`. These labels are internally mapped to OpenAI quality strings in `page.tsx`:
```typescript
const apiQuality = quality === "2K" ? "high" : "auto";  // line ~1904
```

### 2. Provider-native API support
OpenAI's GPT Image 1 API accepts: `quality: "low" | "medium" | "high" | "auto"`. These are OpenAI's own tier names. They do NOT correspond to pixel resolution in the way "1K/2K/4K" implies — they control the model's rendering passes and detail level. The actual image output size is set by the `size` parameter (e.g. `"1024x1024"`, `"1536x1024"`), not by quality.

**OpenAI pricing for GPT Image 1 does vary by quality tier** — "high" quality costs significantly more API tokens than "low" or "auto". This means Zencra's current flat 15 cr rate may not reflect actual upstream cost.

### 3. Current payload field
`body: JSON.stringify({ model, prompt, size, quality, n: 1 })` — `quality` is forwarded directly to OpenAI as the `quality` string. The adapter correctly uses `providerParams?.quality`. However, the value arriving is `"auto"` or `"high"` (from the in-page mapping) — the adapter itself does no additional translation.

### 4. Current frontend→backend mapping
```
UI: "1K" → apiQuality = "auto" → providerParams.quality = "auto" → OpenAI API: quality="auto"
UI: "2K" → apiQuality = "high" → providerParams.quality = "high" → OpenAI API: quality="high"
```
The mapping works mechanically but is semantically deceptive. "2K" implies resolution, not rendering quality. "1K" implies a pixel dimension, not a processing tier. Users cannot make informed decisions with these labels.

### 5. Pricing engine multiplier status
**Not seeded.** No entry in `STATIC_QUALITY_MULTIPLIERS` for `gpt-image-1`. The frontend shows a flat 15 cr for both "1K" and "2K" regardless of quality. OpenAI charges more for `high` quality — this cost difference is currently absorbed by Zencra.

### 6. UI changes required
The `Quality` type in `page.tsx` (line 239) is `"1K" | "2K" | "4K"` — GPT Image's native tiers (`"low"`, `"medium"`, `"high"`, `"auto"`) do not fit. Two approaches:

**Approach A — Rename the UI tiers (cleanest):** Extend the `Quality` type to include `"Low" | "Medium" | "High"` (or use display names alongside internal keys). For GPT Image, show `"Standard"` (maps to `auto`) and `"High"` (maps to `high`). The type system needs to accommodate provider-specific tier names.

**Approach B — Structural refactor (recommended long-term):** Replace the single `quality: Quality` state with a provider-specific param system. Each model defines its own `qualityOptions: { label: string; value: string }[]`. The UI renders the options, the adapter consumes the `value` natively without translation.

**Recommended for GPT Image specifically:** Show `"Standard"` and `"High"` in the UI. These are meaningful to a creative user. `"1K"` and `"2K"` are meaningless for a model where quality = rendering depth, not resolution.

### 7. Provider adapter changes required
**`gpt-image.ts` — remove or eliminate the `apiQuality` hack in `page.tsx`:** If UI values become `"standard"/"high"`, update the mapping in the page or move it to the adapter. The adapter already receives and forwards `providerParams.quality` — so the adapter itself is fine. The translation belongs in `page.tsx` or better, in a model-specific `qualityOptions` definition.

### 8. Backend billing changes required
**Medium-term:** Seed quality multipliers for `gpt-image-1` once the actual upstream cost delta between `auto` and `high` is measured. OpenAI's pricing tables should be consulted. A suggested starting point: `{ "Standard": 1.0, "High": 1.5 }` (to be calibrated). Until seeded, flat 15 cr remains.

### 9. Risk today
**Low now, real future risk.** "High" quality at OpenAI costs 2–4× more than "auto" in token terms. At low traffic this is absorbed. As volume grows, GPT Image high-quality generations could create margin erosion. The fake "1K"/"2K" labels are also a UX confusion risk if users expect pixel resolution.

### 10. Rollout classification
**Phase 1B (UI label fix, no backend change):** Change `allowedQualities` to provider-native labels. Update the internal mapping. This is a frontend-only change and is safe to ship independently. Backend billing multiplier can follow in Phase 2.

---

## MODEL 5 — GPT Image 2 (`gpt-image-2`)

### 1. Current UI behaviour
`allowedQualities: ["1K"]` — quality selector is suppressed (single option). The model is shown in the UI but with no quality controls.

### 2. Provider-native API support
GPT Image 2 uses the same `makeGptImageProvider()` factory as GPT Image 1. It accepts the same `quality: "low" | "medium" | "high" | "auto"` parameter and forwards it to OpenAI's API under `model: "gpt-image-2"`. The model supports quality differentiation — it is just not exposed in the UI.

### 3. Current payload field
No quality is passed via `providerParams` (single-option UI means `quality` stays at `"1K"`, but the adapter mapping in `page.tsx` maps this to `"auto"`). GPT Image 2 always runs at `quality="auto"`.

### 4. Current frontend→backend mapping
Same `apiQuality` mapping as GPT Image 1 — `"1K"` → `"auto"`. Since only `"1K"` is available, GPT Image 2 is permanently locked to `quality="auto"`.

### 5. Pricing engine multiplier status
Not seeded. Flat 20 cr. Same situation as GPT Image 1.

### 6. UI changes required
Same as GPT Image 1: expose `"Standard"` and `"High"` quality options. Set `allowedQualities: ["Standard", "High"]` (or equivalent), add the model-specific mapping. GPT Image 2 is likely to produce visibly better results at `"high"` quality, which is a selling point for this premium model.

### 7. Provider adapter changes required
**None to the adapter itself.** The adapter already accepts and forwards `providerParams.quality`. Changes are in `page.tsx` (model definition and quality mapping).

### 8. Backend billing changes required
Same as GPT Image 1 — seed multipliers after upstream cost research.

### 9. Risk today
**Medium.** Users cannot access the `high` quality tier for a model that supports it. This is a hidden feature gap, not a billing risk. But it means the "GPT Image 2" model is underperforming relative to its actual API capability.

### 10. Rollout classification
**Phase 1B (same batch as GPT Image 1):** Expose quality options. Safe frontend-only change.

---

## MODEL 6 — Seedream v5 (`seedream-v5`)

### 1. Current UI behaviour
`allowedQualities: ["1K"]` — quality selector suppressed. No quality control shown.

### 2. Provider-native API support
**UNVERIFIED — requires fal.ai documentation check.** The user mentioned Seedream v5 Lite "may support resolution tiers like 2K / 3K". Seedream v5 (full model) is at `fal-ai/seedream` on the fal.ai queue API. The current adapter sends: `prompt`, `aspect_ratio`, `num_images`, `enable_safety_checker`. No `image_size`, `num_inference_steps`, or quality-related field.

Fal.ai models commonly support `image_size` as either a string preset (`"square_hd"`, `"portrait_4_3"`) or an integer `{ width, height }` object. Whether Seedream v5 specifically supports resolution scaling via `image_size` or any other param is not confirmed from file reads alone.

### 3. Current payload field
No quality or resolution parameter. Aspect ratio is mapped via `FAL_ASPECT_MAP` to a string like `"square"` or `"landscape_16_9"`.

### 4. Current frontend→backend mapping
No mapping. `quality` is unused by the adapter.

### 5. Pricing engine multiplier status
Not seeded. Flat 15 cr.

### 6. UI changes required
**Pending research.** If fal.ai Seedream v5 supports `image_size: { width, height }` with values above 1K, define a `SEEDREAM_DIMENSION_MAP` similar to `NB2_DIMENSION_MAP` — but with 2K entries. Update `allowedQualities` to match what the API actually supports.

**If Seedream v5 has no resolution control:** `allowedQualities: ["1K"]` is correct. No change needed.

### 7. Provider adapter changes required
**Pending research.** If resolution is confirmed: add `image_size` param to the Seedream payload, driven by quality selection. If not: no change.

### 8. Backend billing changes required
If quality tiers are added: seed multipliers in DB and `STATIC_QUALITY_MULTIPLIERS`. Run in observe mode for calibration.

### 9. Risk today
**None (currently no quality tiers).** If users are getting fixed-resolution output with no option to pay more for higher resolution, there is no financial risk. The risk is opportunity loss — not exposing a feature the model may support.

### 10. Rollout classification
**Phase 1C (Research blocker):** Check `https://fal.ai/models/fal-ai/seedream` API schema for accepted parameters. This is a 30-minute research task. Decision branches: (a) add resolution tiers if supported, (b) confirm 1K-only and close the audit item.

---

## MODEL 7 — Seedream v5 Lite (`seedream-v5-lite`)

### 1. Current UI behaviour
`allowedQualities: ["1K"]` — suppressed. Also serves as the image editing / inpainting variant.

### 2. Provider-native API support
**UNVERIFIED.** Maps to `fal-ai/seedream/edit`. User flagged this as potentially supporting `2K / 3K` resolution tiers. The "edit" endpoint may have different params than the base model.

### 3. Current payload field
Same as Seedream v5: `prompt`, `aspect_ratio`, `num_images`, `enable_safety_checker`. Plus `image_url` when in img2img mode.

### 4. Current frontend→backend mapping
No mapping. `quality` is unused.

### 5. Pricing engine multiplier status
Not seeded. Flat 8 cr (Lite is priced cheaper than full v5).

### 6–10. Same as Seedream v5
Identical research blocker. Check `fal-ai/seedream/edit` endpoint schema. If it supports resolution, the dimension map and multipliers for Lite may differ from the full model (Lite may max at 2K where full v5 goes 3K or 4K — needs verification).

---

## MODEL 8 — Seedream 4.5 (`seedream-4-5`)

### Status: Inactive (DB `active = false`)

No action required. Model is not dispatched, not shown in UI, not billable. The `fal-ai/seedream/v4.5` endpoint should be re-evaluated if Seedream 4.5 is considered for reactivation. No quality tiers are documented in the current adapter.

---

## MODEL 9 — FLUX Kontext (`flux-kontext`)

### Status: Not in UI (`model-to-key` mapping not present in `page.tsx`)

FLUX Kontext is implemented in `flux-kontext.ts` and routed through the generate API, but the model does not appear in the Image Studio `MODELS` array. It is not selectable by users.

When/if FLUX Kontext is added to the UI: the adapter uses `image_size` (fal.ai preset strings like `"square_hd"`) mapped from aspect ratio. No quality parameter. Fal.ai FLUX models typically support `num_inference_steps` for quality control rather than resolution tiers. This should be researched at the time of onboarding — do not assume 1K/2K/4K applies.

---

## Cross-Cutting Findings

### A — The `Quality` type is a structural mismatch

```typescript
type Quality = "1K" | "2K" | "4K";  // page.tsx line 239
```

This type works correctly for Nano Banana (which uses these strings natively) but is incorrect for all other models. GPT Image uses `"low"/"medium"/"high"/"auto"`. Seedream may use pixel dimensions. FLUX uses inference steps.

**Required structural fix (before implementing any new quality controls):** Replace the global `Quality` type with a per-model `qualityOptions` system. Each `StudioModel` entry should define its own options as `{ label: string; apiValue: string }[]`. The `quality` state can remain a plain `string` internally. The translation from UI label → API value happens at the model definition level, not in a switch/ternary buried in the generate handler.

### B — The `apiQuality` hack must be eliminated

```typescript
const apiQuality = quality === "2K" ? "high" : "auto";  // page.tsx ~line 1904
```

This is a hardcoded single-model mapping embedded in the general generate handler. It will break silently if any other model is added with a "2K" option that doesn't map to OpenAI's "high". The mapping belongs in the model definition or the adapter.

### C — Enforce mode per-model safeguard

Currently `PRICING_ENGINE_MODE` is a single global env var. If NB Pro is ready for enforce but NB2 is not (because its 2K/4K UI options are misleading), there is no clean way to enforce only for NB Pro.

**Recommendation:** Before activating enforce mode for any model, add a `enforceModel` allowlist to `hooks.ts` so only verified models are billed at quality-scaled rates. Example:
```typescript
const ENFORCE_QUALITY_BILLING = new Set(["nano-banana-pro"]);
// Only enforce quality-scaled billing for models in this set
```
This can be a simple code-level flag rather than requiring another env var.

### D — DB rows for NB2 quality multipliers

If NB2 is confirmed as 1K-only (Path B), the `credit_model_costs` rows for NB2 should have `quality_multipliers` set to `null` or `{}`. The pricing engine will then fall back to 1.0× flat billing. This is a single SQL update, not a migration.

---

## Priority / Sequencing Matrix

| Action | Model(s) | Effort | Risk | Phase |
|--------|----------|--------|------|-------|
| Research NB2 API max dims | NB2 | 1–2h | Blocker | **Now (before enforce)** |
| Research Seedream v5 + Lite resolution | Seedream v5, Lite | 1–2h | Medium | Phase 1C |
| Fix GPT Image UI labels (1K/2K → Standard/High) | GPT Image 1, 2 | 2h | Low | Phase 1B |
| Structural `qualityOptions` refactor | All models | 1–2 days | Medium | Phase 1B |
| Eliminate `apiQuality` hack | GPT Image | 1h | Low | Phase 1B |
| Activate enforce mode for NB Pro | NB Pro | 15min (env) | Low | Phase 0.5 (post-calibration) |
| Seed GPT Image quality multipliers in DB | GPT Image 1, 2 | 2h (research + SQL) | Low | Phase 2 |
| Expose GPT Image 2 quality controls | GPT Image 2 | 1h | Low | Phase 1B |
| NB2 Path A: extend `NB2_DIMENSION_MAP` | NB2 | 2h | Medium | Phase 1A (if API supports it) |
| NB2 Path B: suppress 2K/4K for NB2 | NB2 | 30min | Low | Phase 1A (if API is 1K-only) |
| Add per-model enforce allowlist to `hooks.ts` | All | 1h | Low | Before any enforce activation |
| Seedream quality tiers (if confirmed) | Seedream v5, Lite | 3h | Medium | Phase 1C |

---

## Decisions Required Before Any Build Starts

1. **NB2 research:** Does the NB2 API accept `width`/`height` values above 1K-equivalent? (Path A or B)
2. **Seedream research:** Does `fal-ai/seedream` and `fal-ai/seedream/edit` support resolution scaling? What param?
3. **GPT Image tier strategy:** Expose `Standard / High` (2 tiers) or `Low / Standard / High` (3 tiers)?
4. **`Quality` type refactor:** Should this be done before the GPT Image fix, or after? (Recommended: refactor first to avoid compounding the hack)
5. **Enforce mode timing:** How many days of observe logs are needed before NB Pro goes to enforce?
6. **Per-model enforce allowlist:** Approve the `ENFORCE_QUALITY_BILLING` set approach in `hooks.ts`?

---

## Appendix — Files to Touch Per Phase

### Phase 0.5 (NB Pro enforce activation)
- `src/lib/credits/hooks.ts` — add `ENFORCE_QUALITY_BILLING` set, check model before enforce
- Vercel env vars — `PRICING_ENGINE_MODE=enforce` (or per-model flag)

### Phase 1A (NB2 resolution research + fix)
- `src/lib/providers/image/nano-banana.ts` — extend `NB2_DIMENSION_MAP` OR no change
- `src/app/studio/image/page.tsx` — update `allowedQualities` for `nano-banana-2`
- `credit_model_costs` DB — update `quality_multipliers` for `nano-banana-2`
- `src/lib/credits/engine.ts` — update `STATIC_QUALITY_MULTIPLIERS` for `nano-banana-2`

### Phase 1B (GPT Image quality labels)
- `src/app/studio/image/page.tsx` — update `MODELS` entries for `dalle3` and `gpt-image-2`, remove `apiQuality` hack
- `src/lib/providers/image/gpt-image.ts` — verify `providerParams.quality` flows through correctly (likely no change)
- Optionally: introduce `qualityOptions` structural refactor (new type + per-model array)

### Phase 1C (Seedream resolution, if confirmed)
- `src/lib/providers/image/seedream.ts` — add `image_size` or dimension params
- `src/app/studio/image/page.tsx` — update `allowedQualities` for Seedream models
- `credit_model_costs` DB — add quality multipliers for Seedream
- `src/lib/credits/engine.ts` — add `STATIC_QUALITY_MULTIPLIERS` entries for Seedream

---

*End of audit. No implementation should proceed until the decisions in the "Decisions Required" section are answered.*
