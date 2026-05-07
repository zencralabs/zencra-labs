# Zencra Image Studio — Final Architecture + Implementation Plan

**Date:** 2026-05-07  
**Status:** PRE-BUILD APPROVAL DOCUMENT — No implementation starts until this is signed off  
**Supersedes:** `quality-resolution-audit-2026-05-07.md` (audit phase)  
**Next step after approval:** Phased implementation per §10 deploy order

---

## Q1 — Final Architecture Understanding

Zencra Image Studio is being redesigned from a generic UI with shared controls into a **Provider-Native Capability Studio**. The shift in mental model is total:

**Before (current state):**  
One `quality` state. One `Quality = "1K" | "2K" | "4K"` type. One quality selector that is shown or hidden. All models receive the same quality string, adapters translate it inconsistently, some silently ignore it. Pricing multipliers are seeded for some models but mean nothing end-to-end because the adapters don't honour them. The studio feels like a wrapper around one generalized API.

**After (target state):**  
Each model declares a `ModelCapabilities` object that is the single source of truth for what it can do. The UI reads capabilities at render time and constructs controls from them — it does not hardcode controls per model. A model that supports quality tiers shows quality tiers. A model that supports reference-image editing shows an upload zone and a Transform mode. A model with no quality controls shows none. Pricing is defined per option inside the capability object — there is no separate multiplier lookup table in the frontend. The studio feels like a unified creative surface that intelligently adapts to the tool currently selected.

**The three governing rules of the new architecture:**

1. **No control appears in the UI unless the provider API truly accepts and acts on it.** No fake resolution selectors. No quality options that are silently ignored by the adapter.
2. **No model charges more credits for an outcome it does not actually produce at higher quality or resolution.** Displayed cost = backend deducted cost = real provider execution.
3. **Generate and Transform are one surface, not two pages.** The presence of an uploaded image switches the internal routing mode. The UI adapts — button label, upload zone affordance — without navigating away.

---

## Q2 — What Will Be Implemented, Provider by Provider

### NB Standard (`nano-banana-standard`)

**No change.**
- Quality: 1K only, selector hidden. Flat 8 cr.
- Adapter: Correct. `resolution = "1K"` hardcoded.
- Capabilities: `supportsResolutionTiers: false`. `supportsEditing: false`.
- Implementation: Zero code changes. Close this line item.

---

### NB Pro (`nano-banana-pro`)

**Minimal change — calibration transition only.**
- Quality: 1K / 2K / 4K — these ARE provider-native. Selector stays.
- UI: Add descriptive sublabels: `1K – Standard`, `2K – HD`, `4K – Ultra`. Cosmetic only.
- Adapter: Already correct. `payload.resolution = "1K"|"2K"|"4K"`. No change.
- Capabilities: `supportsResolutionTiers: true`. `supportsEditing: false` (NB Pro has no edit endpoint).
- Pricing: Multipliers seeded and validated. Move from observe → enforce after calibration window (7 days of logs reviewed, no anomalous delta). This is a Vercel env var change, not a code deploy.
- Frontend credit display: ✅ Fixed (session `26f436b`). Already quality-aware.
- Enforce safeguard: NB Pro enters the `ENFORCE_QUALITY_BILLING` allowlist first — before any other model.

---

### NB2 (`nano-banana-2`)

**BLOCKED — research gate before any implementation.**

This model has a fundamental unresolved question: does the NB2 API actually accept `width` and `height` values above its current `~1024×1024` dimension map entries? The current adapter silently ignores `quality` from `providerParams` and sends fixed 1K-equivalent dimensions from `NB2_DIMENSION_MAP`.

**Until the NB2 API is confirmed:**
- Keep `allowedQualities: ["1K"]` only in the UI (remove current fake 2K/4K).
- Remove `quality_multipliers` from the DB row for `nano-banana-2`.
- Remove `"nano-banana-2"` from `STATIC_QUALITY_MULTIPLIERS` in `engine.ts`.
- Do NOT activate enforce mode for NB2.

**If the NB2 API confirms higher-res dimension support (Path A):**
- Extend `NB2_DIMENSION_MAP` with 2K and 4K entries per aspect ratio (e.g. `1:1 → 2048×2048` for 2K, `4096×4096` for 4K). Every aspect ratio needs entries.
- Add logic in adapter to select dimension set by quality: `const dims = NB2_DIMENSION_MAP_BY_QUALITY[quality][aspectRatio]`.
- Re-enable quality multipliers in DB and `STATIC_QUALITY_MULTIPLIERS`.
- Re-expose 2K/4K in the UI.

**If the NB2 API is 1K-only (Path B):**
- `allowedQualities: ["1K"]`. Flat pricing. Selector permanently hidden.
- Capabilities: `supportsResolutionTiers: false`.
- No multipliers anywhere.

**Immediate action required (before any other NB2 work):** Check NB2 API documentation for maximum accepted `width`/`height` values. This is a 1–2 hour research task that unblocks or permanently closes Path A.

---

### GPT Image 1.5 (`gpt-image-1`, public name "GPT Image 1.5")

**Full UI and capability redesign. This is the highest-complexity single-model change.**

**Public positioning:** Multimodal visual reasoning engine. Not a resolution scaler. Native strengths: text rendering, typography, commercial graphics, posters, thumbnails, UI mockups, infographics, image composition, multi-image workflows, transparency, product ads, editing, scene relighting, fashion.

**Quality tiers — replace fake 1K/2K with provider-native:**

| UI Label | Internal `apiValue` | Credit Multiplier (proposed) | Description |
|----------|---------------------|------------------------------|-------------|
| Fast     | `low`               | 1.0× (flat)                  | Quick draft, lighter detail |
| Standard | `medium`            | 1.25×                        | Balanced quality |
| Ultra    | `high`              | 1.75×                        | Maximum detail and reasoning |

Multipliers are proposed starting points based on OpenAI's documented cost differential between quality tiers. They must be validated against real spend after implementation.

**Capabilities:**
- `supportsQualityTiers: true` (Fast / Standard / Ultra)
- `supportsEditing: true` (image composition, reference images, multi-image input)
- `supportsTransparency: true` (background removal, compositing)
- `supportsTypography: true` (text rendering strength)
- `supportsMultiImage: true` (reference + mask + composition)
- `supportsResolutionTiers: false` (OpenAI controls output size via `size` param, not exposed as a quality dial)

**Edit mode (Generate → Transform):**
- When a reference image is uploaded, the mode switches to Transform internally.
- Button label: "Generate" → "Transform".
- Adapter routes to `gpt-image-1` with the image as a reference/composition input.
- No separate Edit page.

**Eliminate the `apiQuality` hack in `page.tsx`:** The current ternary `quality === "2K" ? "high" : "auto"` is removed. The quality `apiValue` comes from the model's `qualityOptions` definition, not a hardcoded switch.

---

### GPT Image 2 (`gpt-image-2`)

**BLOCKED pending routing audit.**

The user has identified a critical ambiguity: "GPT Image 2" in Zencra may be branding that does not correspond to a distinct OpenAI endpoint. `gpt-image-2` as an OpenAI model name may not exist — or may exist but with overlapping capability with `gpt-image-1`. The `makeGptImageProvider()` factory is shared between both.

**Required audit (before any GPT Image 2 build):**
1. Confirm what `model: "gpt-image-2"` resolves to in the OpenAI API. Does this model identifier exist? What does OpenAI's API return?
2. If it exists: what capabilities differentiate it from `gpt-image-1`? Native resolution? Higher context? Different quality ceiling?
3. If it does not exist or is functionally identical: the `gpt-image-2` entry is removed from the `MODELS` array. The public card is either removed or aliased to `gpt-image-1`.

**Do not expose GPT Image 2 as a separate model unless provider reality confirms distinct behavior.** No fake separation.

---

### Seedream 4.5 (public name "Seedream 4.5", internal model key TBD)

**Clarification required before implementation:** The internal `seedream-4-5` DB entry was marked inactive at the time of the audit (mapped to `fal-ai/seedream/v4.5`). The user is now positioning "Seedream 4.5" as a premium cinematic visual engine. This positioning must be confirmed against one of two scenarios:

**Scenario A:** "Seedream 4.5" is a **rebranding of `seedream-v5`** (currently active, maps to `fal-ai/seedream`). The `seedream-v5` model key is renamed to `seedream-4-5` in the registry or a new public name is set. This is the likely correct interpretation.

**Scenario B:** "Seedream 4.5" means the legacy `fal-ai/seedream/v4.5` endpoint should be **reactivated**. This requires confirming that fal.ai still routes `v4.5` and that it is genuinely better than `v5` for the stated use cases.

**Assuming Scenario A (pending confirmation):**

**Public positioning:** Premium cinematic visual engine. Native strengths: style transformation, environment swaps, relighting, face-preserving edits, product redesign, cinematic compositions, editorial/fashion visuals, artistic realism.

**Unified Generate / Transform architecture:**
- No uploaded image → text endpoint (`fal-ai/seedream` or `fal-ai/seedream/v4.5`)
- Uploaded image → edit endpoint (`fal-ai/seedream/edit`)
- Routing happens in the adapter, not in the UI. The frontend sends one request to one route. The adapter inspects `input.imageUrl` presence and selects the correct fal.ai endpoint.
- UI: single model card, single studio view. Button label: "Generate" → "Transform" when image is present.

**Capabilities:**
- `supportsEditing: true`
- `supportsReferenceImages: true`
- `supportsQualityTiers: false` (pending research — see §Q3)
- `supportsResolutionTiers: false` (pending research — see §Q3)
- `supportsStyleStrength: true` (if fal.ai endpoint exposes `guidance_scale` or equivalent)

---

### Seedream 5 Lite (`seedream-v5-lite`, public name "Seedream 5 Lite")

**Public positioning:** Fast creative exploration engine. Rapid iteration, moodboards, quick transforms, lightweight edits.

**Same unified architecture as Seedream 4.5:**
- Text generation → `fal-ai/seedream/edit` (currently, per adapter — confirm this is correct or if there is a lighter text endpoint)
- Image editing → same endpoint with `image_url`
- Dynamic routing by image presence

**BLOCKED on resolution research:**  
The user flagged this model as potentially supporting `2K / 3K` resolution tiers. The fal.ai `seedream/edit` endpoint schema must be audited for:
- Does it accept `image_size: { width, height }` with values above 1024?
- Does it accept `num_inference_steps` for quality control?
- Does it accept `guidance_scale`?
- Are there upscale flags?

Until confirmed: `allowedQualities: ["1K"]`, no resolution selector, flat pricing.

**Capabilities:**
- `supportsEditing: true`
- `supportsReferenceImages: true`
- `supportsResolutionTiers: pending`
- `supportsQualityTiers: pending`
- `supportsGuidance: pending`

---

### FLUX Kontext (`flux-kontext`)

**Deferred — not in UI, no active users.**  
When onboarded: do not assume 1K/2K/4K applies. fal.ai FLUX models use `num_inference_steps` for quality, not resolution. Research at onboarding time.

---

## Q3 — Unresolved Provider Uncertainties

These are hard blockers or gating conditions — nothing that depends on them can be built or deployed until they are answered.

**Blocker 1 — NB2 maximum resolution (HIGHEST PRIORITY)**  
Does the NB2 API accept `width`/`height` above `~1024` pixels? If not, the 2K/4K UI must be removed immediately (pre-launch requirement — cannot ship a selector that lies about output resolution).

**Blocker 2 — GPT Image 2 routing reality**  
Does `model: "gpt-image-2"` exist in OpenAI's production API? What does it return? Is it genuinely distinct from `gpt-image-1`?

**Blocker 3 — Seedream internal key mapping**  
Which fal.ai endpoint and internal model key maps to the public "Seedream 4.5" positioning? `seedream-v5` or `seedream-4-5`?

**Blocker 4 — Seedream 5 Lite resolution support**  
Does `fal-ai/seedream/edit` accept resolution scaling parameters? What are the accepted values?

**Unresolved but non-blocking (can proceed in parallel):**
- Seedream 4.5 `guidance_scale` / style strength parameter name on fal.ai
- GPT Image 1.5 exact OpenAI cost differential between quality tiers (pricing calibration, not blocking UI build)
- Whether NB2 has an edit/img2img endpoint at all

---

## 1 — Final Provider-by-Provider Implementation Map

| Model | Public Name | Action | Phase | Blocker |
|-------|-------------|--------|-------|---------|
| NB Standard | NB Standard | No change | Done | None |
| NB Pro | NB Pro | Sublabel cosmetics + enforce activation | 0.5 | Calibration window |
| NB2 | NB2 | Remove fake 2K/4K NOW + research gate | 1A (immediate) | API research |
| gpt-image-1 | GPT Image 1.5 | Full capability redesign + Fast/Standard/Ultra | 1B | None |
| gpt-image-2 | GPT Image 2 | Audit routing, merge or remove if fake | 1A (audit) | API research |
| seedream-v5 | Seedream 4.5 | Unify Generate+Transform, dynamic routing | 1B | Key mapping confirm |
| seedream-v5-lite | Seedream 5 Lite | Unify Generate+Transform, resolution research | 1B/1C | Resolution research |
| seedream-4-5 | (inactive) | Re-evaluate at Scenario A/B decision | 1A | Key mapping decision |
| flux-kontext | FLUX Kontext | Not in UI — deferred | Future | Onboarding decision |

---

## 2 — Exact Frontend Changes

### `src/app/studio/image/page.tsx`

**2.1 — New `ModelCapabilities` interface (new type, replaces `allowedQualities`)**
```typescript
interface QualityOption {
  label: string;        // UI: "Fast", "Standard", "Ultra"
  apiValue: string;     // Provider API: "low", "medium", "high"
  creditMultiplier: number;
  description?: string;
}

interface ResolutionOption {
  label: string;        // UI: "1K", "2K", "4K"
  apiValue: string;     // Provider API: "1K", "2K", "4K"  
  creditMultiplier: number;
}

interface ModelCapabilities {
  supportsEditing:          boolean;
  supportsReferenceImages:  boolean;
  supportsTransparency:     boolean;
  supportsTypography:       boolean;
  supportsQualityTiers:     boolean;
  qualityOptions?:          QualityOption[];
  supportsResolutionTiers:  boolean;
  resolutionOptions?:       ResolutionOption[];
  supportsMultiImage:       boolean;
  supportsStyleStrength:    boolean;
  supportsGuidance:         boolean;
  supportsInferenceSteps:   boolean;
  editButtonLabel?:         string;  // default "Transform"
}
```

**2.2 — Update `StudioModel` interface**
```typescript
interface StudioModel {
  id: string;
  name: string;
  description: string;
  capabilities: ModelCapabilities;   // replaces allowedQualities
  creditKey: string;
  // ... rest of existing fields
}
```

**2.3 — Remove global `Quality` type (or narrow it)**  
Remove `type Quality = "1K" | "2K" | "4K"`. Replace with:
```typescript
type QualitySelection = string;  // now provider-specific; value is the apiValue
```
The `quality` state becomes `qualityApiValue: string` or equivalent — the value stored IS the API value, not a display label. The label is looked up from `capabilities.qualityOptions`.

**2.4 — Update `MODELS` array capability definitions per model:**

```
NB Standard:   capabilities.supportsResolutionTiers = false
NB Pro:        capabilities.resolutionOptions = [{label:"1K–Standard", apiValue:"1K", multiplier:1.0}, ...]
NB2:           capabilities.supportsResolutionTiers = false (pending research)
GPT Image 1.5: capabilities.qualityOptions = [{label:"Fast", apiValue:"low", multiplier:1.0}, {label:"Standard", apiValue:"medium", multiplier:1.25}, {label:"Ultra", apiValue:"high", multiplier:1.75}]
GPT Image 2:   Remove or alias (pending routing audit)
Seedream 4.5:  capabilities.supportsEditing = true, supportsReferenceImages = true
Seedream Lite: capabilities.supportsEditing = true, supportsReferenceImages = true
```

**2.5 — Replace quality selector rendering logic**  
Current: `if (cm.allowedQualities?.length > 1) { show selector }`  
New: `if (cm.capabilities.supportsResolutionTiers && cm.capabilities.resolutionOptions) { show resolution selector }` + `if (cm.capabilities.supportsQualityTiers && cm.capabilities.qualityOptions) { show quality selector }`

**2.6 — Eliminate `apiQuality` hack (line ~1904)**  
The hardcoded ternary is removed. The `providerParams.quality` value is now always the `apiValue` from the selected `QualityOption` or `ResolutionOption`. No translation in the page.

**2.7 — Add Transform mode detection**  
```typescript
const studioMode: "generate" | "transform" = uploadedImage ? "transform" : "generate";
const buttonLabel = studioMode === "transform" 
  ? (selectedCapabilities.editButtonLabel ?? "Transform")
  : "Generate";
```
Models with `supportsEditing: false` always stay in generate mode regardless of image upload.

**2.8 — Update `getGenerationCreditCost()` call sites**  
Currently uses `quality` string. After refactor, passes `qualityApiValue` (which is already the right string). Both call sites confirmed as patched in `26f436b` — verify they still receive the correct value post-refactor.

**2.9 — Quality state reset on model change**  
Current reset logic checks `allowedQualities.includes(quality)`. New logic: if selected `qualityApiValue` is not in the new model's `qualityOptions` (or `resolutionOptions`), reset to the first option's `apiValue`.

---

## 3 — Exact Backend / Orchestrator Changes

### `src/app/api/studio/image/generate/route.ts`

**3.1 — No structural change required.** The route already passes `providerParams` through to the adapter. Since `providerParams.quality` now carries the native API value (not a translated one), the route is transparent.

**3.2 — Seedream dynamic routing (new logic):**  
The route (or adapter) must detect `input.imageUrl` presence and select the correct fal.ai endpoint:
- `imageUrl` present → `fal-ai/seedream/edit` (or `fal-ai/seedream/v4.5` edit path)
- `imageUrl` absent → `fal-ai/seedream` (text generation path)

This routing logic belongs in the **Seedream adapter** (`seedream.ts`), not in the route, to keep routing encapsulated per provider.

**3.3 — GPT Image 1.5 multi-image / reference image routing:**  
When `input.referenceImages[]` is populated, the GPT Image adapter should use OpenAI's image editing endpoint rather than plain generation. This capability already exists conceptually — wire it to the `supportsEditing: true` capability flag. The route passes `referenceImages` if `capabilities.supportsEditing` is true and images are present.

### `src/lib/credits/hooks.ts`

**3.4 — Add `ENFORCE_QUALITY_BILLING` model allowlist:**
```typescript
const ENFORCE_QUALITY_BILLING = new Set([
  "nano-banana-pro",
  // Add further models here only after per-model calibration
]);
```
The enforce/observe branch in `hooks.ts` checks: `ENFORCE_QUALITY_BILLING.has(modelKey) && engineMode === "enforce"`. This ensures NB Pro can go to enforce without accidentally enforcing NB2 or GPT Image before they're ready.

---

## 4 — Exact Pricing Engine Changes

### `src/lib/credits/engine.ts`

**4.1 — Remove `"nano-banana-2"` from `STATIC_QUALITY_MULTIPLIERS`** (immediately, regardless of NB2 research outcome — if Path A is confirmed later, re-add with verified values).

**4.2 — Add GPT Image quality multipliers** after confirming OpenAI cost structure:
```typescript
"gpt-image-1": { "low": 1.0, "medium": 1.25, "high": 1.75 }
```
Note: The engine already accepts arbitrary quality strings — the multiplier lookup uses whatever string is passed. This entry just adds the lookup values for GPT Image's native tier names.

**4.3 — `PER_MINUTE_MODELS` and `VIDEO_DURATION_MODELS` sets:** No change for image studio.

**4.4 — Phase 2 manifest readiness:** The engine already accepts `PricingConfig` for dynamic manifest injection. No structural change needed — the quality tier values will flow through correctly once the manifest is populated.

**4.5 — Quality multiplier resolution path (verify):**  
Currently: engine resolves `config?.qualityMultipliers?.[modelKey] ?? STATIC_QUALITY_MULTIPLIERS[modelKey]` then looks up `quality` in the map. After the refactor, `quality` arriving at the engine is the native API value (`"low"/"medium"/"high"` for GPT Image, `"1K"/"2K"/"4K"` for NB Pro). This is already correct — the engine doesn't care what the string is, it just looks it up in the map. No change to engine logic.

---

## 5 — Exact DB Multiplier Changes

All changes are SQL updates to `credit_model_costs` in Supabase.

**5.1 — NB2 — remove quality multipliers immediately:**
```sql
UPDATE credit_model_costs
SET quality_multipliers = NULL
WHERE model_key = 'nano-banana-2';
```

**5.2 — GPT Image 1.5 — add quality multipliers (after cost research confirms values):**
```sql
UPDATE credit_model_costs
SET quality_multipliers = '{"low": 1.0, "medium": 1.25, "high": 1.75}'::jsonb
WHERE model_key = 'gpt-image-1';
```

**5.3 — NB Pro — no DB change.** Multipliers already seeded. Enforce mode activation is env var only.

**5.4 — Seedream — no DB change** until resolution tiers are confirmed. Flat pricing stays.

**5.5 — GPT Image 2 — pending routing audit.** If model is removed, delete its `credit_model_costs` row or mark inactive.

---

## 6 — Exact Provider Payload Changes

### `src/lib/providers/image/nano-banana.ts`

**6.1 — NB Pro:** No payload change. `resolveResolution("pro", quality)` already returns the native string.

**6.2 — NB2:** No payload change. Adapter continues to use `NB2_DIMENSION_MAP` with fixed 1K dims. If Path A is confirmed, extend the dimension map and add quality-aware dimension selection.

### `src/lib/providers/image/gpt-image.ts`

**6.3 — GPT Image 1.5:**  
The adapter already reads `providerParams?.quality` and forwards it to OpenAI as `quality`. After the UI refactor, the arriving value is `"low"/"medium"/"high"` instead of `"auto"/"high"`. The adapter requires zero change — the translation was in `page.tsx` and is now removed.

**Verify:** The adapter default is `?? "auto"`. With the new UI, if no quality is selected, the first option's `apiValue` (`"low"` = Fast) should arrive, so `"auto"` fallback is never triggered. Confirm this during implementation.

### `src/lib/providers/image/seedream.ts`

**6.4 — Seedream unified routing (new logic):**
```typescript
// Inside createJob():
const isEditMode = !!input.imageUrl;
const falEndpoint = isEditMode
  ? "https://queue.fal.run/fal-ai/seedream/edit"   // or v4.5 edit path
  : "https://queue.fal.run/fal-ai/seedream";

const payload: Record<string, unknown> = {
  prompt:                input.prompt,
  aspect_ratio:          FAL_ASPECT_MAP[input.aspectRatio ?? "1:1"] ?? "square",
  num_images:            1,
  enable_safety_checker: true,
  ...(isEditMode ? { image_url: input.imageUrl } : {}),
};
```
This replaces the current text-only payload. The routing decision is internal — `page.tsx` sends one request to `/api/studio/image/generate`, the adapter decides the endpoint.

**6.5 — Seedream resolution (if confirmed via fal.ai docs):**  
Add `image_size: { width: W, height: H }` to payload, driven by quality selection. Dimension map similar to NB2's approach.

---

## 7 — Models That Need UI Redesign

**Full redesign (controls, mode, positioning):**
- GPT Image 1.5 — Replace fake quality selector with Fast/Standard/Ultra. Add Transform mode affordance (reference image upload zone). Add capability-aware feature hints (text, transparency, multi-image badges).
- Seedream 4.5 — Add Transform mode affordance. Replace static "Generate" button with mode-aware label. Add image upload zone that triggers edit routing.
- Seedream 5 Lite — Same as Seedream 4.5.

**Minor redesign (selector label update only):**
- NB Pro — Add descriptive sublabels to 1K/2K/4K options. No structural change.

**Remove / audit required before showing:**
- GPT Image 2 — Remove from MODELS array pending routing audit OR keep hidden until confirmed.

**No change:**
- NB Standard — Correct as-is.
- NB2 — Strip 2K/4K selector immediately (patch). Restore if Path A confirmed.

---

## 8 — Models That Should Hide Quality/Resolution Selectors

| Model | Selector state | Reason |
|-------|---------------|--------|
| NB Standard | Hidden (single option) | 1K-only endpoint |
| NB2 | Hidden immediately | Pending resolution research |
| GPT Image 1.5 | Show new quality selector | Fast/Standard/Ultra |
| GPT Image 2 | Hidden (pending audit) | Routing unconfirmed |
| Seedream 4.5 | Hidden | No quality param confirmed |
| Seedream 5 Lite | Hidden (pending research) | Resolution support unconfirmed |
| NB Pro | Show resolution selector | 1K/2K/4K native and verified |

---

## 9 — Models That Support Edit Mode (Transform)

| Model | Edit support | Endpoint / mechanism | Reference image | Style strength |
|-------|-------------|----------------------|-----------------|----------------|
| NB Standard | ❌ | No edit endpoint | — | — |
| NB Pro | ❌ | No edit endpoint confirmed | — | — |
| NB2 | TBD | Research needed | — | — |
| GPT Image 1.5 | ✅ | OpenAI image editing + composition | ✅ Multi-image | via quality tier |
| GPT Image 2 | TBD | Pending routing audit | TBD | TBD |
| Seedream 4.5 | ✅ | `fal-ai/seedream/edit` (dynamic routing) | ✅ | TBD (guidance_scale) |
| Seedream 5 Lite | ✅ | `fal-ai/seedream/edit` (same endpoint) | ✅ | TBD |

**Generate → Transform trigger rule:** Model must have `supportsEditing: true` AND `supportsReferenceImages: true` for the Transform mode to activate on image upload. Models without both flags remain in static generate mode even if an image is uploaded (image upload zone not shown for those models).

---

## 10 — Migration / Deploy Order

### Immediate (no research required, safe to ship now)

**Step 0 — NB2 selector patch:**  
Remove the fake 2K/4K options from NB2 in `page.tsx`. Set `allowedQualities: ["1K"]` or equivalent. Remove NB2 from `STATIC_QUALITY_MULTIPLIERS`. Run SQL to null NB2 quality multipliers in DB. Commit, deploy. This prevents any user from being shown a selector that doesn't work.

Risk: Near-zero. Users with NB2 selected see 1K only. No pricing impact (observe mode active).

---

### Phase 1A — Research gate (parallel tasks, 1–2 days)

**1A-R1:** NB2 API resolution research → Path A or B decision  
**1A-R2:** GPT Image 2 routing audit → keep or remove decision  
**1A-R3:** Seedream model key mapping → confirm "Seedream 4.5" = `seedream-v5` or `seedream-4-5`  
**1A-R4:** Seedream 5 Lite fal.ai endpoint schema → resolution/quality support

No code changes during this phase. Outputs are decisions, not PRs.

---

### Phase 1B — GPT Image 1.5 capability redesign (after 1A-R2 resolves GPT Image 2 question)

**1B-1:** Introduce `ModelCapabilities` interface in `page.tsx`  
**1B-2:** Update `StudioModel` to use `capabilities` (remove `allowedQualities`)  
**1B-3:** Update MODELS array for GPT Image 1.5 with `qualityOptions: [Fast/Standard/Ultra]`  
**1B-4:** Update quality selector rendering to use `capabilities`  
**1B-5:** Remove `apiQuality` hack  
**1B-6:** Add Transform mode affordance for GPT Image 1.5 (`supportsEditing: true`)  
**1B-7:** Update `gpt-image.ts` adapter to handle reference image routing  
**1B-8:** Update DB multipliers for `gpt-image-1` (after cost research confirms values)  
**1B-9:** Either remove `gpt-image-2` from MODELS or expose capabilities if confirmed  

**Deploy:** Single PR covering all GPT Image 1.5 changes. Feature-flag behind `ENABLE_GPT_QUALITY_TIERS=true` env var for safe rollout.

---

### Phase 1B (same PR or next PR) — NB Pro sublabels + enforce activation

**1B-10:** Add descriptive sublabels to NB Pro resolution options (`1K – Standard`, etc.)  
**1B-11:** Add `ENFORCE_QUALITY_BILLING` allowlist to `hooks.ts` with `"nano-banana-pro"` as first entry  
**1B-12:** Set `PRICING_ENGINE_MODE=enforce` in Vercel after 7-day calibration review  

**Deploy:** `hooks.ts` change in code. Env var flip is separate, done after calibration window closes.

---

### Phase 1C — Seedream unified architecture (after 1A-R3 and 1A-R4 resolve)

**1C-1:** Confirm Seedream 4.5 model key mapping  
**1C-2:** Update `seedream.ts` with dynamic endpoint routing (text vs. edit)  
**1C-3:** Update MODELS array for Seedream 4.5 (`supportsEditing: true`, `editButtonLabel: "Transform"`)  
**1C-4:** Update MODELS array for Seedream 5 Lite (same)  
**1C-5:** Add image upload zone to studio UI for edit-capable models  
**1C-6:** Add Transform mode label swap logic in `page.tsx`  
**1C-7:** If Seedream resolution confirmed: add dimension map, update payloads, seed DB multipliers  
**1C-8:** If Seedream resolution not confirmed: leave quality selector hidden, flat pricing stays  

**Deploy:** Single Seedream PR. Test text generation and edit mode independently before shipping.

---

### Phase 1A Path A/B (NB2 — depends on 1A-R1 outcome)

**Path A (resolution confirmed):**  
Extend `NB2_DIMENSION_MAP`, re-expose 2K/4K in UI, re-seed DB multipliers. Standard PR.

**Path B (1K-only confirmed):**  
NB2 selector already removed in Step 0. Close the line item. No further action.

---

### Phase 2 — Enforce mode expansion + manifest API

After all Phase 1 models are calibrated in observe mode:
- Add confirmed models to `ENFORCE_QUALITY_BILLING` set
- Implement Phase 2 pricing manifest (frontend fetches `/api/credits/model-costs` at boot)
- Delete `STATIC_QUALITY_MULTIPLIERS` and `STATIC_ADDON_COSTS` from `engine.ts`

---

## 11 — Highest-Risk Areas

**Risk 1 — NB2 enforce mode activation before resolution is confirmed (CRITICAL)**  
If enforce mode were activated globally before NB2's resolution situation is resolved, users selecting 2K or 4K on NB2 would be charged 25–75% more but receive identical 1K output. This is a refund-triggering defect. Mitigation: Step 0 removes the 2K/4K selector immediately. The `ENFORCE_QUALITY_BILLING` allowlist prevents NB2 from ever being in enforce while the selector is present.

**Risk 2 — GPT Image 1.5 quality multiplier calibration**  
The proposed multipliers (1.0 / 1.25 / 1.75) are starting estimates. OpenAI charges per-generation at different token rates for `low/medium/high`. If Zencra's credit charge for Ultra (×1.75) does not cover the actual OpenAI API cost delta, each Ultra generation produces margin loss. Mitigation: run in observe mode for GPT Image quality tiers. Monitor actual OpenAI spend per tier for 7 days before enforcing multipliers.

**Risk 3 — Seedream dynamic routing edge cases**  
The adapter routing `imageUrl present → edit endpoint` is simple but has edge cases: what if `imageUrl` is an empty string? What if the edit endpoint returns a different response shape? What if the edit endpoint is unavailable? Mitigation: guard `isEditMode = !!input.imageUrl && input.imageUrl.length > 0`. Add explicit error handling for edit endpoint failures that falls back to a user-facing error, not a silent wrong-endpoint call.

**Risk 4 — `ModelCapabilities` refactor breaks existing model state**  
Replacing `allowedQualities` with `capabilities` is a breaking change to the `StudioModel` interface. Any code that reads `model.allowedQualities` will break. TypeScript will catch these at compile time — the refactor must be done in one complete pass, not incrementally. Mitigation: grep for all `allowedQualities` references before starting and enumerate them. Do not merge until `tsc --noEmit` passes clean.

**Risk 5 — Quality state persistence across model switches**  
The current `quality` state persists across model changes, only reset if the new model doesn't support the current quality string. After the refactor, the stored value is the `apiValue` (`"low"/"high"` for GPT Image, `"1K"/"4K"` for NB Pro). Switching from GPT Image Ultra (`apiValue = "high"`) to NB Pro would leave `quality = "high"` — which NB Pro does not have in its resolution options. The reset logic must handle this cross-model mismatch. Mitigation: always reset to first option's `apiValue` on model change, regardless of whether the current value "looks like" it might match.

**Risk 6 — fal.ai Seedream endpoint drift**  
fal.ai updates model endpoints without notice. If `fal-ai/seedream/edit` changes its accepted parameters, the adapter silently fails or produces degraded output. Mitigation: add logging in the Seedream adapter for `fal.ai` API errors with full response body. Monitor after deploy.

---

## 12 — Rollback Strategy

**Step 0 (NB2 selector removal):**  
Rollback: revert the single MODELS array change and the `STATIC_QUALITY_MULTIPLIERS` removal in `engine.ts`. One-line git revert. DB SQL is reversible (re-add NB2 multipliers). Risk of reverting: minimal, only affects NB2 quality display (which was broken to begin with).

**Phase 1B (GPT Image quality redesign):**  
Rollback: if gated behind `ENABLE_GPT_QUALITY_TIERS` env var, rollback is setting the env var to `false`. No DB changes needed (multipliers were added but observe mode means no billing impact). If not feature-flagged: single git revert of the 1B PR.

**Phase 1B (NB Pro enforce mode):**  
Rollback: set `PRICING_ENGINE_MODE=observe` in Vercel. Instant, no deploy required. The `ENFORCE_QUALITY_BILLING` allowlist means this rollback only affects NB Pro — no other model is impacted.

**Phase 1C (Seedream unified architecture):**  
Rollback: revert the `seedream.ts` adapter changes. The route and DB are unchanged. Seedream reverts to text-only flat pricing. The Transform mode affordance disappears from the UI. This is a clean adapter-layer rollback with no data loss.

**`ModelCapabilities` refactor:**  
This is the hardest rollback — touching the core `StudioModel` interface affects the entire studio. Mitigation: this refactor is done in an isolated feature branch (`feat/provider-native-capabilities`), not in main. It is only merged after all call sites are updated and TypeScript is clean. If the branch needs to be abandoned, main is untouched.

**General rule:** Every Phase 1 change ships in its own PR on a named feature branch. Rollback of any individual change does not require reverting other phases.

---

## Pre-Build Checklist (must be complete before any 1B/1C code is written)

- [ ] Step 0: NB2 2K/4K selector removed, multipliers cleared from DB and `engine.ts` — **ship immediately**
- [ ] 1A-R1: NB2 API resolution limit confirmed → Path A or B declared
- [ ] 1A-R2: GPT Image 2 routing confirmed → keep or remove decided
- [ ] 1A-R3: Seedream 4.5 internal model key confirmed
- [ ] 1A-R4: Seedream 5 Lite fal.ai endpoint schema confirmed
- [ ] GPT Image 1.5 quality multipliers validated against OpenAI cost data
- [ ] `ModelCapabilities` interface approved by Jai
- [ ] `ENFORCE_QUALITY_BILLING` allowlist approach approved
- [ ] Feature branch strategy confirmed (`feat/provider-native-capabilities`)
- [ ] Calibration window for NB Pro started (clock running since `26f436b`)

---

*End of plan. Implementation proceeds only after pre-build checklist is signed off.*
