# Zencra Labs — Master Context for Claude

> Read this file before every session. It is the single source of truth for architecture, rules, and build state. No rule in this file can be overridden without explicit written instruction from Jai.

---

## What Zencra Is

Zencra Labs is a **credit-based AI tool aggregator and experience layer** — like Higgsfield or Poe, but cinematic-first. It does not compete with AI providers; it integrates their APIs and resells via credits.

**Strategic identity:** Zencra is not a generation tool. It is a **persistent character system with cross-surface continuity.** Users create identities (@handles), then those identities travel through Image → Video → Start Frame → End Frame → Campaign — keeping faces, styles, and stories consistent across every output.

**Tagline:** Intelligence by Design  
**Domain:** zencralabs.com  
**Stack:** Next.js (App Router) + React + Tailwind CSS + Supabase (PostgreSQL + Auth + Storage) + Vercel  
**Dev command:** `cd ~/Documents/Claude/Projects/Zencra\ Labs/zencra-labs && npm run dev`  
**TypeScript check:** `npx tsc --noEmit` — must pass with **zero errors** before every commit  

---

## 🧠 CORE ARCHITECTURE RULE (NON-NEGOTIABLE)

**All providers MUST remain isolated.**

❌ Providers must NOT:
- Know about other providers
- Share logic between each other
- Handle their own routing decisions

✅ The Orchestrator (`studioDispatch` / `dispatchFCS`) MUST:
- Handle all routing decisions based on modelKey
- Normalize request/response shapes across providers
- Inject provider-specific params (imageUrl, endImageUrl, seeds, etc.)
- Manage async vs sync behavior (polling vs immediate)
- Be the only entry point into provider code from routes

This is the backbone of Zencra. Breaking it creates bugs that are invisible at write-time and catastrophic at scale.

**FCS uses its own isolated orchestrator (`dispatchFCS`) — never routes through `studioDispatch`.**

---

## 🗂 DATA + STORAGE CONTRACT (HARD RULES)

Every generation MUST:
1. Save a generation row in the DB (`creative_generations` or `generation_assets`)
2. Mirror the output to Supabase storage bucket (`generations`)
3. Persist: `provider`, `modelKey`, `status` (pending → processing → succeeded/failed), final Supabase URL

**Provider URLs must NOT be trusted.** They expire. The Supabase mirror URL is the canonical asset URL.  
**Kling fix already implemented** — `mirrorVideoToStorage()` copies to bucket `generations` (not `generated-assets`).  
**`persistAsset` is fatal for async providers** (NB, Kling, Seedance) — if it fails, the generation fails.

---

## 💳 CREDIT SYSTEM — HARD RULES

Credits must be:
- **Deducted ONLY after successful generation** (never pre-deducted without refund path)
- **Reserved before generation** (optional lock for future phase)
- **Refunded on failure** — no silent credit loss ever

Admin must track per generation:
- Cost to Zencra (provider cost)
- Revenue from user (credits deducted × credit price)
- Margin per model (stored in `credit_model_costs` table)

Business accounts: credits deducted from `owner_user_id` (Business pool owner), not the seat user.  
Trial path: never touches `profiles.credits`. Uses `trial_usage` table with `consume_trial_usage` RPC.

---

## 🎨 UX PRINCIPLES (LOCKED)

- **No small text** — nothing below 11px ever
- **No rounded corners on media** — `borderRadius: 0` on all image/video cards (cinematic feel)
- **Visual-first** — the output IS the UI; controls support, never compete
- **Minimal UI → maximum output** — controls hidden until needed
- **No alert()** — use toast notifications
- **No silent failures** — every error path must surface a user-facing message
- Everything must feel like **filmmaking**, not prompting

---

## 🚫 DO NOT IN NEXT PHASE

- Do NOT rebuild Image Studio
- Do NOT touch the Dock system
- Do NOT change gallery logic or justified layout
- Do NOT introduce new providers mid-feature design
- Do NOT overcomplicate UI early — ship clean, iterate
- Do NOT add placeholders (action cards, modals, panels) for features not yet wired
- Do NOT use `alert()` anywhere
- Do NOT use provider temp URLs as final asset URLs
- Do NOT deviate from the typography system below

---

## Typography System (LOCKED)

**Fonts:**
- Display / Headings → Syne (`font-display`, `--font-display`) — cinematic geometric
- Body / UI / Buttons / Forms → Familjen Grotesk (`font-sans`, `font-body`, `--font-sans`) — clean modern grotesque
- Do NOT reintroduce Inter or Space Grotesk for any reason
- FCS / Cinema components get Eurostile/Orbitron **in a future dedicated pass only** — do NOT apply now

**9 Locked Categories — choose one before touching any text:**

| # | Name | Use | Key classes |
|---|------|-----|-------------|
| 1 | Display/Title Card | Canvas hero, studio landing, cinematic titles | `text-[34px] font-bold tracking-[-0.02em]` |
| 2 | Hero Page Heading | Homepage, pricing, service hero | `font-display text-[56px] font-bold leading-[0.95] tracking-[-0.04em]` |
| 3 | Section Heading | Pricing, dashboard, panel headers | `font-display text-[32px] font-bold tracking-[-0.025em]` |
| 4 | Studio Title | Image/Video/Audio/Character internal headings | `font-display text-[30px] font-bold tracking-[-0.02em]` |
| 5 | Body Text | Descriptions, helper text, empty-state copy | `font-body text-[16px] leading-[1.65] text-white/65` |
| 6 | UI Labels | Controls, tabs, model names, section labels | `font-body text-[13px] font-semibold uppercase tracking-[0.14em] text-white/55` |
| 7 | Buttons | Main action buttons | `font-body text-[15px] font-semibold tracking-[-0.01em]` |
| 8 | Chips/Tags | Prompt tags, small pills | `font-body text-[13px] font-medium tracking-[-0.005em]` |
| 9 | Micro Text | SOON, NEW, credits, badges, captions | `font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45` |

**Cinematic override** (hero/landing/reveal only — never in UI panels):
```
className="font-display tracking-tight"
style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.04em" }}
```

---

## Branch Strategy (LOCKED)

| Branch | Purpose |
|--------|---------|
| `main` | Production only. Deploys to Vercel. No experiments. |
| `release/v*` | Locked milestone checkpoints. Safe restore points. |
| `feat/*` | One per feature. Never build on main directly. |
| `fix/*` | Bug-fix branches. |
| `polish/*` | UI/UX refinement branches. |

**Current baseline:** tag `v1-video-studio-stable` / branch `release/v1-video-studio-stable`  
**Current working branch:** `feat/audio-detection-waveform-upsell`

**Before merging:** `npx tsc --noEmit` + `npm run build` + `git status` clean  

**Commit format:**
```
feat(video): add voiceover pipeline
fix(kling): mirror video outputs to storage
polish(canvas): refine empty-state preview stack
```

**Claude handoff protocol — start every new session with:**
```
We are on branch: <branch-name>.
Base checkpoint: v1-video-studio-stable.
Do NOT re-implement anything already in that tag.
First inspect existing files, then answer:
1. What did you understand?
2. Which files will you change?
3. What assumptions are you making?
4. What will you NOT touch?
Wait for approval before coding.
```

---

## Build Status (as of 2026-05-03)

### ✅ COMPLETE

- **Provider System** — All 6 studios (Image, Video, Audio, Character, UGC, FCS) wired through `studioDispatch` or `dispatchFCS`. All providers isolated.
- **Billing Backend** — Migrations 014–023 applied. Plans (starter/creator/pro/business), trial usage, credit model costs, subscription RPCs, RLS policies.
- **Auth System** — Supabase auth, JWT on all routes, admin bypass for role=admin, logout flow, session refresh.
- **Image Studio** — Justified gallery, right panel, fullscreen preview, reference images, @handle injection, Creative Director mode, model dropdown.
- **Video Studio** — Kling 3.0 working, Omni BETA (1201 error handled gracefully), video mirroring, 3-tab gallery, sequence mode, start/end frame, audio detection waveform badge.
- **Audio Studio** — ElevenLabs integration, stale token fixed.
- **Creative Director** — ConceptBoard, BriefBuilder, OutputWorkspace, dock, character panel, CD v1 @img roles.
- **AI Influencer (Character Studio)** — @handle system, readiness endpoint, avatar badges, style categories, candidate states.
- **Dashboard** — Projects, Generated, home with real data, quick actions.
- **Homepage** — Hero v2, VerticalStoriesSection, cinematic CTAs.
- **Waitlist** — `/waitlist` page, `waitlist_users` table, join + approve API routes.
- **Private Preview Gate** — `PrivatePreviewGate`, access code API, `private_preview_access` table, password input + show/hide toggle.
- **Security** — Rate limiting (IP + user), idempotency, request validation, CORS, auth on all routes.
- **Provider Cost Tracking** — `provider_cost_log`, `provider_balance_history`, admin dashboard section.
- **TypeScript** — Zero errors across full codebase.

### ⏳ NEXT: Creative Director v2

CD v2 is not just a UI upgrade — it is a **core product shift**. It must be planned before building.  
Break it into phases before starting: component tree, interaction system, DB changes, output model.

### 🔒 LOCKED FOR FUTURE PHASE

- Public/private asset visibility toggle
- Zencra Gallery (social layer — views, likes, trending)
- Masonry image grid (locked, using justified layout for now)
- FCS/Cinema typography (Eurostile/Orbitron — future dedicated pass)
- Kling 3.0 Omni full launch (returns 1201 — awaiting Kling account resource pack)

---

## Identity Pipeline Rules (ENFORCED)

These rules must not drift between sessions:

- No silent fallbacks — ever. Block with a clear message.
- No frontend identity injection — all identity rules live in `route.ts` (server-side)
- No client-side influencer fetch — only the lightweight readiness endpoint (`GET /api/studio/influencer/readiness?handles=...`)
- No multi-character UI — single identity per generation
- Sharp corners (`borderRadius: 0`) on all identity imagery
- Avatar + Lock badge hierarchy: `[avatar] 🔒 @handle · Identity Locked` — avatar is primary, lock is secondary
- Amber glow = active identity; warm-gray = blocked (missing canonical); dimmed 45–50% = dependency violation

---

## Key Patterns

```
// Auth on every API route
const { user, error } = await requireAuthUser(req);
if (error) return NextResponse.json({ error }, { status: 401 });

// Entitlement before dispatch
const gate = await checkEntitlement(user.id, studioType);
if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: gate.status });

// TypeScript check
npx tsc --noEmit   // must be zero errors

// Supabase admin client for billing
import { supabaseAdmin } from "@/lib/supabase/admin";

// FCS uses separate orchestrator
import { dispatchFCS } from "@/lib/api/fcs-dispatch";
// NOT studioDispatch

// User-facing label for FCS models (HARD RULE)
// Cine Director / Cine Pro — never "LTX" or "Lightricks" in any UI label
```

---

## Naming Rules

- FCS models user-facing: **Cine Director** / **Cine Pro** — never LTX, Lightricks, fal.ai in any label
- Credit unit: **"cr"** not "credits" in UI chips and navbar pill
- Supabase storage bucket for video: **`generations`** (not `generated-assets`)
- @handle identity system: always `@handle` format, resolved server-side only

---

## Files You Should Read Before Touching a Studio

| Studio | Key files |
|--------|-----------|
| Image | `src/app/studio/image/page.tsx`, `src/lib/providers/image/`, `src/app/api/studio/image/generate/route.ts` |
| Video | `src/components/studio/video/VideoStudioShell.tsx`, `src/lib/providers/video/`, `src/app/api/studio/video/generate/route.ts` |
| Audio | `src/app/studio/audio/page.tsx`, `src/lib/providers/audio/` |
| Creative Director | `src/components/studio/creative-director/CreativeDirectorShell.tsx`, `src/components/studio/creative-director/ConceptBoard.tsx` |
| AI Influencer | `src/components/studio/character/AIInfluencerBuilder.tsx`, `src/app/api/studio/influencer/` |
| FCS | `src/lib/providers/fcs/`, `src/app/api/studio/fcs/generate/route.ts` |
| Billing | `src/lib/billing/entitlement.ts`, `src/app/api/studio/*/generate/route.ts` |
| Identity | `src/lib/identity/handle-resolver.ts`, `src/app/api/studio/influencer/readiness/route.ts` |
