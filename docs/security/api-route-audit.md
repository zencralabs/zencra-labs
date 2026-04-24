# API Route Security Audit

**Project:** Zencra Labs  
**Audit Date:** 2026-04-24  
**Phase:** Phase 0.5 / Phase 1 Stability Lock  
**Status:** Baseline documented — ongoing review required for new routes

---

## Classification Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and verified |
| ⚠️ | Present but needs verification |
| ❌ | Missing — requires fix |
| 📝 | Intentionally public |
| 🔒 | Admin only |
| 🪝 | Webhook — external provider auth |

---

## Core Auth Middleware

**`requireAuthUser(req)`** — Verifies Supabase JWT from `Authorization: Bearer <token>` header.  
Used as first line of defence on all protected routes.

**`guardStudio(studio)`** — Checks `ZENCRA_FLAG_<STUDIO>_ENABLED` env flag.  
Must pass before any studio route proceeds.

---

## Studio Generate Routes

| Route | Auth | Rate Limit | Input Validation | DB Write | Notes |
|-------|------|-----------|-----------------|----------|-------|
| `POST /api/studio/image/generate` | ✅ requireAuthUser | ✅ user + IP | ✅ model key, AR, prompt | ✅ creates asset | Entitlement + credit hook |
| `POST /api/studio/video/generate` | ✅ requireAuthUser | ✅ user + IP | ✅ | ✅ | Kling / Seedance |
| `POST /api/studio/audio/generate` | ✅ requireAuthUser | ✅ user + IP | ✅ | ✅ | ElevenLabs TTS |
| `POST /api/studio/character/generate` | ✅ requireAuthUser | ✅ user + IP | ✅ | ✅ | FLUX Character |
| `POST /api/studio/ugc/generate` | ✅ requireAuthUser | ✅ user + IP | ✅ | ✅ | Creatify / Arcads / HeyGen |
| `POST /api/studio/fcs/generate` | ✅ requireAuthUser | ✅ user + IP | ✅ | ✅ | hasFCSAccess() gate |

All studio generate routes flow through `studioDispatch()` which enforces:
- Idempotency (5-min dedup window)
- Credit reserve/finalize/rollback
- MAX_CONCURRENT_JOBS = 3
- MAX_CREDITS_PER_GENERATION = 1000

---

## Studio Lifecycle Routes

| Route | Auth | Rate Limit | Input Validation | DB Write | Notes |
|-------|------|-----------|-----------------|----------|-------|
| `GET /api/studio/jobs/[jobId]/status` | ✅ requireAuthUser | ⚠️ no explicit limit | ⚠️ jobId format only | ❌ (read-only) | Should verify user owns job |
| `POST /api/studio/jobs/[jobId]/cancel` | ✅ requireAuthUser | ⚠️ no explicit limit | ⚠️ | ✅ updates status | Should verify user owns job |
| `DELETE /api/studio/assets/[assetId]/delete` | ✅ requireAuthUser | — | ✅ | ✅ | RLS enforces ownership |
| `POST /api/studio/prompt/enhance` | ✅ requireAuthUser | ✅ 20/60s | ✅ | ❌ | No DB write needed |
| `POST /api/studio/upload-reference` | ✅ requireAuthUser | ⚠️ no explicit limit | ✅ file type/size | ✅ Supabase storage | Add rate limit: 30 uploads/hour |

**Action Items:**
- [ ] Add ownership verification to jobs/[jobId]/status and cancel (check job.user_id === userId)
- [ ] Add rate limit to upload-reference (30/hour/user)

---

## Admin Routes

All admin routes must check `role === "admin"` (not just auth).

| Route | Auth | Admin Role | Rate Limit | Notes |
|-------|------|-----------|-----------|-------|
| `GET /api/admin/analytics` | ✅ | ✅ | — | Read-only |
| `GET/POST /api/admin/content` | ✅ | ✅ | — | |
| `GET /api/admin/generations` | ✅ | ✅ | — | |
| `GET /api/admin/provider-costs` | ✅ | ✅ | — | |
| `POST /api/admin/provider-costs/sync` | ✅ | ✅ | — | Triggers provider balance sync |
| `GET /api/admin/stats` | ✅ | ✅ | — | |
| `GET /api/admin/transactions` | ✅ | ✅ | — | |
| `GET/POST /api/admin/users` | ✅ | ✅ | — | User management |

**Required Admin Audit Events** (see Admin Audit Logging section below):
- Credit adjustments
- Role changes
- Provider config changes

---

## Creative Director Routes

| Route | Auth | Rate Limit | Input Validation | Ownership Check | Notes |
|-------|------|-----------|-----------------|----------------|-------|
| `GET/POST /api/creative-director/projects` | ✅ | — | ✅ | ✅ user_id filter | |
| `GET/PUT/DELETE /api/creative-director/projects/[id]` | ✅ | — | ✅ | ✅ | |
| `POST /api/creative-director/projects/[id]/brief` | ✅ | — | ✅ | ✅ | |
| `POST /api/creative-director/projects/[id]/brief/improve` | ✅ | ⚠️ | ✅ | ✅ | Add rate limit — calls OpenAI |
| `GET/POST /api/creative-director/projects/[id]/concepts` | ✅ | ⚠️ | ✅ | ✅ | |
| `POST /api/creative-director/concepts/[id]/generate` | ✅ | ✅ (via dispatch) | ✅ | ✅ | Flows through studioDispatch |
| `GET/POST /api/creative-director/characters` | ✅ | — | ✅ | ✅ | |

**Action Items:**
- [ ] Add rate limit to `brief/improve` (calls OpenAI — 10/hour/user recommended)

---

## Public / Mixed Routes

| Route | Auth | Public? | Notes |
|-------|------|---------|-------|
| `GET /api/generations/public` | 📝 None | ✅ | Read-only public gallery |
| `GET /api/generations/showcase` | 📝 None | ✅ | Curated showcase |
| `GET /api/generations/mine` | ✅ requireAuthUser | No | User's own generations |
| `PATCH /api/generations/[id]/visibility` | ✅ requireAuthUser | No | Ownership check required |

---

## Auth Routes

| Route | Auth | Rate Limit | Notes |
|-------|------|-----------|-------|
| `POST /api/auth/send-otp` | 📝 None | ✅ 5/600s IP | OTP is public by design |
| `POST /api/auth/resend-verification` | 📝 None | ✅ IP-limited | |
| `GET /api/auth/debug` | ⚠️ Dev only? | — | **Must be disabled in production** |

**Action Items:**
- [ ] Verify `/api/auth/debug` is disabled or auth-gated in production

---

## Webhook Routes

Webhook routes intentionally have no Supabase JWT auth (providers don't send user tokens).  
Authentication is via provider-specific HMAC signatures or token headers.

| Route | Provider Auth | Notes |
|-------|-------------|-------|
| `POST /api/webhooks/studio/[provider]` | ⚠️ Provider token | Verify HMAC validation is implemented per provider |
| `POST /api/webhooks/razorpay` | ⚠️ HMAC signature | Razorpay X-Razorpay-Signature header |
| `POST /api/webhooks/stripe` | ⚠️ HMAC signature | Stripe-Signature header |
| `POST /api/webhooks/lipsync` | ⚠️ Token | |

**Action Items:**
- [ ] Audit `/api/webhooks/studio/[provider]` — verify NB, Kling, Seedance webhooks validate provider token/secret
- [ ] Confirm Razorpay and Stripe webhook handlers verify HMAC before processing any data

---

## Legacy / Deprecated Routes

Routes under `/api/generate/` appear to be legacy (pre-new provider system).

| Route | Status | Action |
|-------|--------|--------|
| `POST /api/generate/image` | ⚠️ Legacy? | Verify not reachable in production or auth-gate |
| `GET /api/generate/status/[provider]/[taskId]` | ⚠️ Legacy? | |
| `POST /api/generate/video/[provider]` | ⚠️ Legacy? | |
| `POST /api/generate/route` | ⚠️ Legacy? | |

**Action Items:**
- [ ] Audit `/api/generate/*` routes — if unused, add 410 Gone middleware or remove
- [ ] If still active, verify they have auth gates

---

## Billing Routes

| Route | Auth | Notes |
|-------|------|-------|
| `GET/POST /api/billing/orders` | ✅ | Order creation requires auth |
| `GET /api/billing/orders/[id]` | ✅ | Ownership check required |
| `GET /api/billing/packs` | 📝 | Public pricing — OK |
| `POST /api/billing/verify` | ✅ | Payment verification — auth required |
| `POST /api/billing/demo/webhook` | ⚠️ | Dev-only demo webhook — disable in prod |

**Action Items:**
- [ ] Verify `/api/billing/demo/webhook` is disabled in production (env flag or middleware block)

---

## Admin Audit Logging

**Current Status:** Credit transactions are logged via `credit_transactions` table.  
Admin actions (role changes, user suspension, pricing changes) are **not yet logged** to a dedicated audit table.

**Required Schema** (migration TODO):
```sql
CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,  -- 'credit_adjustment' | 'role_change' | 'user_suspend' | 'provider_config' | 'pricing_change'
  target_id   UUID,           -- affected user_id or record_id
  before      JSONB,          -- previous state (redacted if sensitive)
  after       JSONB,          -- new state
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_admin_id_idx ON admin_audit_log (admin_id);
CREATE INDEX admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);
```

**Action Items:**
- [ ] Create migration for `admin_audit_log` table
- [ ] Wire audit logging into admin route handlers for: credit adjustments, role changes, user suspension

---

## CORS Policy

**Authenticated API routes** (`/api/*` except `/api/webhooks/*`):
- `Access-Control-Allow-Origin`: localhost:3000 (dev) or https://www.zencralabs.com (prod)
- No wildcard (`*`) on authenticated routes ✅

**Webhook routes** (`/api/webhooks/*`):
- No CORS restriction — providers call from their own origins
- Authentication is via HMAC/token, not origin ✅

---

## Security Headers (Applied Globally)

| Header | Value | Status |
|--------|-------|--------|
| `Strict-Transport-Security` | max-age=63072000; includeSubDomains | ✅ |
| `X-Frame-Options` | DENY | ✅ |
| `X-Content-Type-Options` | nosniff | ✅ |
| `Referrer-Policy` | strict-origin-when-cross-origin | ✅ |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=() | ✅ |
| `Content-Security-Policy` | **Not set** | 📝 TODO Phase 2 |

**CSP Note:** CSP is intentionally deferred. Adding it requires auditing all external domains (provider image URLs, Supabase CDN, fal.ai output URLs). A TODO document listing required CSP domains should be created before Phase 2 security hardening.

---

## Rate Limits Summary

| Endpoint Group | User Limit | IP Limit | Implementation |
|---------------|-----------|----------|---------------|
| Studio generate | 10/60s | 20/60s | ✅ Supabase RPC |
| Prompt enhance | 20/60s | — | ✅ |
| Auth OTP | — | 5/600s | ✅ |
| Upload reference | None | None | ❌ Add 30/hour/user |
| Brief improve | None | None | ❌ Add 10/hour/user |
| Admin routes | None | None | 📝 Admin-only by role |

---

## Open Action Items (Priority Order)

### High
1. ❌ Verify `/api/webhooks/studio/[provider]` implements HMAC/token validation per provider
2. ❌ Verify `/api/auth/debug` is disabled in production
3. ❌ Audit `/api/generate/*` legacy routes — auth-gate or remove

### Medium
4. ❌ Add rate limit to `POST /api/studio/upload-reference` (30/hour/user)
5. ❌ Add rate limit to `POST /api/creative-director/projects/[id]/brief/improve` (10/hour/user)
6. ❌ Add job ownership verification to `GET/POST /api/studio/jobs/[jobId]/*`
7. ❌ Disable `/api/billing/demo/webhook` in production

### Low / Phase 2
8. 📝 Create `admin_audit_log` migration and wire into admin handlers
9. 📝 Design CSP domain list and implement Content-Security-Policy header
10. 📝 Add `X-Request-Id` response header for distributed tracing

---

*This document must be updated whenever a new API route is added or an existing route's auth posture changes.*
