/**
 * Supabase-native rate limiting helpers.
 *
 * Uses the check_rate_limit RPC (migration 012) which atomically increments
 * a counter in rate_limit_buckets and returns whether the request is within
 * the allowed limit. No external Redis or additional packages required.
 *
 * Limiters:
 *   checkStudioRateLimit(userId)     — 10 req / 60s  per user   (studio generate routes)
 *   checkIpStudioRateLimit(ip)       — 20 req / 60s  per IP     (studio generate routes)
 *   checkEnhanceRateLimit(userId)    — 20 req / 60s  per user   (prompt/enhance route)
 *   checkAuthRateLimit(ip)           — 5  req / 600s per IP     (auth OTP routes)
 *
 * All helpers return:
 *   null            → request is allowed, continue
 *   Response (429)  → limit exceeded, return immediately
 *
 * Rate limit failures (RPC errors) are logged but never block requests —
 * a broken rate limiter should degrade gracefully, not cause outages.
 *
 * IP Resolution (getClientIp):
 *   1. x-forwarded-for header first value (Vercel edge sets this)
 *   2. request.ip (NextRequest only — not available on base Request)
 *   3. Random UUID fallback — no shared bucket for unknown IPs
 *
 * S4-B Shield emission:
 *   Every rate-limit and concurrent-cap breach emits a fire-and-forget
 *   SecurityEvent into the Zencra Shield event bus (emitSecurityEvent).
 *   Emission is non-blocking — it never delays or changes the 429 response.
 *   In dry-run mode: logged to structured logger only.
 *   In observe mode: logged + Discord alert + Supabase persist.
 *   In enforce mode: same as observe (enforcement is handled by the limiter itself).
 *
 *   Normalized context per event:
 *   - limiterType  (logPrefix — e.g. "studio-user", "login", "video-user")
 *   - userId       (user-keyed limits) OR ipHash (IP-keyed limits, SHA-256 prefix)
 *   - studio       (when the limit is studio-specific)
 *   - configuredMax + windowS (threshold)
 *   - observedValue = configuredMax + 1 (RPC returns bool only — minimum overage)
 */

import { supabaseAdmin }                        from "@/lib/supabase/admin";
import { randomUUID, createHash }               from "crypto";
import { emitSecurityEvent, resolveShieldMode } from "@/lib/security/events";
import type { VelocityEvent, JobEvent }         from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// IP EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the client IP from an incoming request.
 * Works with both NextRequest (Vercel edge) and base Request.
 */
export function getClientIp(req: Request): string {
  // x-forwarded-for is the most reliable on Vercel (edge sets it)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // May be comma-separated list; first value is original client
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  // NextRequest may have .ip set by Vercel edge runtime (not in all Next.js type versions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeIp = (req as unknown as Record<string, unknown>)?.ip;
  if (typeof maybeIp === "string" && maybeIp) return maybeIp;

  // Fallback: unique UUID so unknown IPs never share a bucket
  return randomUUID();
}

// ─────────────────────────────────────────────────────────────────────────────
// IP HASHING — never store raw IPs in security_events_log
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-way hash of a raw IP address.
 * Returns the first 16 hex chars of SHA-256 — enough for grouping/dedup
 * without storing PII. Consistent across calls for the same IP.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// S4-B: SHIELD EVENT EMISSION — rate-limit breach
//
// Fire-and-forget emission into the Shield event bus.
// Called after a 429 response is confirmed but BEFORE returning — non-blocking.
//
// User-keyed limits → velocity.user.burst_60s (userId present)
// IP-keyed limits   → velocity.global.burst   (ipHash used as identifier)
// Provider-keyed    → skipped (webhook limits; circuit breaker covers providers)
// ─────────────────────────────────────────────────────────────────────────────

function emitRateLimitHit(params: {
  /** Present for user-keyed limits — user UUID */
  userId?: string;
  /** Present for IP-keyed limits — SHA-256 prefix of raw IP; never raw IP */
  ipHash?: string;
  /** logPrefix describing the limiter location, e.g. "studio-user", "login" */
  limiterType: string;
  /** The configured max requests for this limiter */
  configuredMax: number;
  /** Window in seconds */
  windowS: number;
  /** Studio slug when limit is studio-specific */
  studio?: string;
}): void {
  const { userId, ipHash, limiterType, configuredMax, windowS, studio } = params;
  const identifier = userId ?? ipHash;
  // Provider-keyed limits have no user/IP identifier — circuit breaker covers those
  if (!identifier) return;

  const mode = resolveShieldMode();
  const threshold = {
    metric:          studio ? `${limiterType}/${studio}` : limiterType,
    configuredValue: configuredMax,
    // RPC returns bool only — actual count not available; report minimum overage
    observedValue:   configuredMax + 1,
    unit:            `req/${windowS}s`,
  };
  const actionReason =
    `Rate limit exceeded — ${limiterType}: ${configuredMax} req/${windowS}s` +
    (studio ? ` [${studio}]` : "");

  // Use explicitly typed locals so TypeScript can narrow the discriminated union correctly.
  // Passing object literals directly to emitSecurityEvent() triggers excess property checking
  // across all union members — typed locals avoid that by binding to a specific variant.
  if (userId) {
    const ev: Omit<VelocityEvent, "timestamp"> = {
      rule:         "velocity.user.burst_60s",
      severity:     "warning",
      threshold,
      actionTaken:  "request_blocked",
      actionReason,
      mode,
      userId,
      windowCounts: {
        per60s:   windowS === 60   ? configuredMax + 1 : undefined,
        per60min: windowS === 3600 ? configuredMax + 1 : undefined,
      },
      riskTier: "elevated",
    };
    void emitSecurityEvent(ev);
  } else {
    // IP-keyed: ipHash used as identifier — not a user UUID but a consistent IP fingerprint
    const ev: Omit<VelocityEvent, "timestamp"> = {
      rule:         "velocity.global.burst",
      severity:     "warning",
      threshold,
      actionTaken:  "request_blocked",
      actionReason,
      mode,
      userId:       identifier, // ipHash stands in as identifier
      windowCounts: {
        per60s:   windowS === 60   ? configuredMax + 1 : undefined,
        per60min: windowS === 3600 ? configuredMax + 1 : undefined,
      },
      riskTier: "elevated",
    };
    void emitSecurityEvent(ev);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function checkLimit(
  key: string,
  windowS: number,
  maxReq: number,
  errorMessage: string,
  logPrefix: string,
): Promise<Response | null> {
  const { data: allowed, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key:      key,
    p_window_s: windowS,
    p_max_req:  maxReq,
  });

  if (error) {
    // Degrade gracefully — a broken rate limiter must never block legitimate requests
    console.error(`[rate-limit] ${logPrefix} RPC error:`, error.message);
    return null;
  }

  if (allowed === false) {
    return Response.json(
      {
        success: false,
        code:    "RATE_LIMITED",
        error:   errorMessage,
      },
      {
        status:  429,
        headers: { "Retry-After": String(windowS) },
      }
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO GENERATE — 10 requests per 60 seconds per user
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_WINDOW_S = 60;
const STUDIO_MAX_REQ  = 10;

/**
 * Check studio generate rate limit for a given userId.
 * Call immediately after requireAuthUser — before feature gate and dispatch.
 *
 * Returns null if allowed, or a ready-made 429 Response if blocked.
 */
export async function checkStudioRateLimit(userId: string): Promise<Response | null> {
  const res = await checkLimit(
    `studio:${userId}`,
    STUDIO_WINDOW_S,
    STUDIO_MAX_REQ,
    `Rate limit exceeded. You can make ${STUDIO_MAX_REQ} generation requests per minute.`,
    "studio-user",
  );
  if (res) emitRateLimitHit({ userId, limiterType: "studio-user", configuredMax: STUDIO_MAX_REQ, windowS: STUDIO_WINDOW_S });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO GENERATE — 20 requests per 60 seconds per IP
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_IP_WINDOW_S = 60;
const STUDIO_IP_MAX_REQ  = 20;

/**
 * Check studio generate rate limit for a given IP address.
 * Runs alongside checkStudioRateLimit (both must pass).
 * Prevents credential-sharing attacks where many accounts share one IP.
 *
 * Returns null if allowed, or a ready-made 429 Response if blocked.
 */
export async function checkIpStudioRateLimit(ip: string): Promise<Response | null> {
  const res = await checkLimit(
    `ip:${ip}:studio`,
    STUDIO_IP_WINDOW_S,
    STUDIO_IP_MAX_REQ,
    `Too many generation requests from your network. Try again in a minute.`,
    "studio-ip",
  );
  if (res) emitRateLimitHit({ ipHash: hashIp(ip), limiterType: "studio-ip", configuredMax: STUDIO_IP_MAX_REQ, windowS: STUDIO_IP_WINDOW_S });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT ENHANCE — 20 requests per 60 seconds per user
// ─────────────────────────────────────────────────────────────────────────────

const ENHANCE_WINDOW_S = 60;
const ENHANCE_MAX_REQ  = 20;

/**
 * Check prompt/enhance rate limit for a given userId.
 * Enhancement is free (no credits) so we rate-limit separately from generation
 * to prevent OpenAI API cost abuse.
 *
 * Returns null if allowed, or a ready-made 429 Response if blocked.
 */
export async function checkEnhanceRateLimit(userId: string): Promise<Response | null> {
  const res = await checkLimit(
    `enhance:${userId}`,
    ENHANCE_WINDOW_S,
    ENHANCE_MAX_REQ,
    `Rate limit exceeded. You can enhance ${ENHANCE_MAX_REQ} prompts per minute.`,
    "enhance",
  );
  if (res) emitRateLimitHit({ userId, limiterType: "enhance", configuredMax: ENHANCE_MAX_REQ, windowS: ENHANCE_WINDOW_S });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — 5 requests per 10 minutes per IP
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_WINDOW_S = 600;  // 10 minutes
const AUTH_MAX_REQ  = 5;

/**
 * Check auth route rate limit for a given IP address.
 * Call at the top of send-otp and resend-verification routes.
 *
 * Returns null if allowed, or a ready-made 429 Response if blocked.
 */
export async function checkAuthRateLimit(ip: string): Promise<Response | null> {
  const res = await checkLimit(
    `auth:${ip}`,
    AUTH_WINDOW_S,
    AUTH_MAX_REQ,
    "Too many requests. Try again in 10 minutes.",
    "auth",
  );
  if (res) emitRateLimitHit({ ipHash: hashIp(ip), limiterType: "auth", configuredMax: AUTH_MAX_REQ, windowS: AUTH_WINDOW_S });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD REFERENCE — 30 uploads per hour per user
// ─────────────────────────────────────────────────────────────────────────────

const UPLOAD_REF_WINDOW_S = 3600; // 1 hour
const UPLOAD_REF_MAX_REQ  = 30;

/**
 * Rate-limits POST /api/studio/upload-reference.
 * 30 uploads per hour per user.
 */
export async function checkUploadReferenceRateLimit(userId: string): Promise<Response | null> {
  const res = await checkLimit(
    `upload_ref:${userId}`,
    UPLOAD_REF_WINDOW_S,
    UPLOAD_REF_MAX_REQ,
    `Upload limit reached. You can upload ${UPLOAD_REF_MAX_REQ} reference images per hour.`,
    "upload_ref",
  );
  if (res) emitRateLimitHit({ userId, limiterType: "upload_ref", configuredMax: UPLOAD_REF_MAX_REQ, windowS: UPLOAD_REF_WINDOW_S });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIEF IMPROVE — 10 requests per hour per user
// ─────────────────────────────────────────────────────────────────────────────

const BRIEF_IMPROVE_WINDOW_S = 3600; // 1 hour
const BRIEF_IMPROVE_MAX_REQ  = 10;

/**
 * Rate-limits POST /api/creative-director/projects/[id]/brief/improve.
 * 10 requests per hour per user (calls OpenAI).
 */
export async function checkBriefImproveRateLimit(userId: string): Promise<Response | null> {
  const res = await checkLimit(
    `brief_improve:${userId}`,
    BRIEF_IMPROVE_WINDOW_S,
    BRIEF_IMPROVE_MAX_REQ,
    `Brief improvement limit reached. You can improve ${BRIEF_IMPROVE_MAX_REQ} briefs per hour.`,
    "brief_improve",
  );
  if (res) emitRateLimitHit({ userId, limiterType: "brief_improve", configuredMax: BRIEF_IMPROVE_MAX_REQ, windowS: BRIEF_IMPROVE_WINDOW_S });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-B-1: VIDEO GENERATE — 3 requests per 60 seconds per user
// Stricter than image (10/60s) because video providers cost significantly more.
// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_WINDOW_S = 60;
const VIDEO_MAX_REQ  = 3;

/**
 * Per-user rate limit for video generation.
 * Stricter than the general studio limit (10/60s) because video providers
 * are 10–60× more expensive than image generation.
 * Call after requireAuthUser, before feature gate and dispatch.
 */
export async function checkVideoRateLimit(userId: string): Promise<Response | null> {
  const res = await checkLimit(
    `video:${userId}`,
    VIDEO_WINDOW_S,
    VIDEO_MAX_REQ,
    `Video generation rate limit exceeded. You can generate ${VIDEO_MAX_REQ} videos per minute. Video generation is resource-intensive — please wait before submitting another request.`,
    "video-user",
  );
  if (res) emitRateLimitHit({ userId, limiterType: "video-user", configuredMax: VIDEO_MAX_REQ, windowS: VIDEO_WINDOW_S, studio: "video" });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-B-2: LIPSYNC GENERATE — 2 requests per 60 seconds per user
// Stricter than image; lipsync jobs are long-running and provider-expensive.
// ─────────────────────────────────────────────────────────────────────────────

const LIPSYNC_GEN_WINDOW_S = 60;
const LIPSYNC_GEN_MAX_REQ  = 2;

/**
 * Per-user rate limit for lipsync generation.
 * Stricter than both image (10/60s) and video (3/60s) because lipsync jobs
 * are long-running, async, and expensive per provider call.
 */
export async function checkLipsyncGenerateRateLimit(userId: string): Promise<Response | null> {
  const res = await checkLimit(
    `lipsync_gen:${userId}`,
    LIPSYNC_GEN_WINDOW_S,
    LIPSYNC_GEN_MAX_REQ,
    `Lip sync rate limit exceeded. You can submit ${LIPSYNC_GEN_MAX_REQ} lip sync jobs per minute.`,
    "lipsync-gen-user",
  );
  if (res) emitRateLimitHit({ userId, limiterType: "lipsync-gen-user", configuredMax: LIPSYNC_GEN_MAX_REQ, windowS: LIPSYNC_GEN_WINDOW_S, studio: "lipsync" });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-E-1: MEDIA UPLOAD — 20 uploads per hour per user
// /api/media/upload was previously unprotected. Covers image + video uploads.
// ─────────────────────────────────────────────────────────────────────────────

const MEDIA_UPLOAD_WINDOW_S = 3600; // 1 hour
const MEDIA_UPLOAD_MAX_REQ  = 20;

/**
 * Rate-limits POST /api/media/upload.
 * 20 uploads per hour per user. Covers both image (20 MB) and video (500 MB) uploads.
 */
export async function checkMediaUploadRateLimit(userId: string): Promise<Response | null> {
  const res = await checkLimit(
    `media_upload:${userId}`,
    MEDIA_UPLOAD_WINDOW_S,
    MEDIA_UPLOAD_MAX_REQ,
    `Upload limit reached. You can upload ${MEDIA_UPLOAD_MAX_REQ} files per hour.`,
    "media-upload",
  );
  if (res) emitRateLimitHit({ userId, limiterType: "media-upload", configuredMax: MEDIA_UPLOAD_MAX_REQ, windowS: MEDIA_UPLOAD_WINDOW_S });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-E-2: LIPSYNC UPLOAD — 10 uploads per hour per user
// /api/studio/lipsync/upload was previously unprotected. Files up to 500 MB.
// ─────────────────────────────────────────────────────────────────────────────

const LIPSYNC_UPLOAD_WINDOW_S = 3600; // 1 hour
const LIPSYNC_UPLOAD_MAX_REQ  = 10;

/**
 * Rate-limits POST /api/studio/lipsync/upload.
 * 10 uploads per hour per user (both video and audio lipsync files).
 */
export async function checkLipsyncUploadRateLimit(userId: string): Promise<Response | null> {
  const res = await checkLimit(
    `lipsync_upload:${userId}`,
    LIPSYNC_UPLOAD_WINDOW_S,
    LIPSYNC_UPLOAD_MAX_REQ,
    `Lip sync upload limit reached. You can upload ${LIPSYNC_UPLOAD_MAX_REQ} files per hour.`,
    "lipsync-upload",
  );
  if (res) emitRateLimitHit({ userId, limiterType: "lipsync-upload", configuredMax: LIPSYNC_UPLOAD_MAX_REQ, windowS: LIPSYNC_UPLOAD_WINDOW_S, studio: "lipsync" });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-F-3: WEBHOOK — 120 requests per 60 seconds per provider (soft/generous)
// Prevents webhook endpoint hammering while never blocking legitimate retries.
// Providers typically send 1–5 events per job; this cap handles storm scenarios.
//
// NOTE: No Shield event emitted here — provider-keyed limits have no user/IP
// identifier, and provider anomalies are covered by the circuit breaker.
// ─────────────────────────────────────────────────────────────────────────────

const WEBHOOK_WINDOW_S = 60;
const WEBHOOK_MAX_REQ  = 120; // generous — provider retries are normal and expected

/**
 * Soft rate limit for incoming provider webhooks.
 * 120 req/min per provider is intentionally generous — provider retry storms
 * are normal behavior and must never be blocked by this limit.
 * Only activates under extreme abuse (e.g. misconfigured provider loop or attack).
 */
export async function checkWebhookRateLimit(provider: string): Promise<Response | null> {
  // No emitRateLimitHit — provider-keyed; circuit breaker covers provider anomalies
  return checkLimit(
    `webhook:${provider}`,
    WEBHOOK_WINDOW_S,
    WEBHOOK_MAX_REQ,
    `Webhook rate limit exceeded for provider ${provider}. Too many events in a short window.`,
    "webhook-provider",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-C: CONCURRENT JOB CAPS — per user, per studio
// Caps: image=4, video=1, lipsync=1.
// Queries the assets table (common record store for image/video/lipsync) for
// jobs in pending state. Lifecycle is pending → {ready|failed} — no
// intermediate "processing" state is written. Valid AssetStatus values:
//   pending | processing | ready | failed | deleted  (only "pending" is active)
// DB errors degrade gracefully — a broken check must never block requests.
// ─────────────────────────────────────────────────────────────────────────────

async function checkConcurrentJobLimit(
  userId:        string,
  studio:        string,
  maxConcurrent: number,
): Promise<Response | null> {
  const { count, error } = await supabaseAdmin
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("studio", studio)
    .eq("status", "pending");

  if (error) {
    console.error(`[rate-limit] concurrent-${studio} DB error:`, error.message);
    return null; // degrade gracefully — a broken check must never block requests
  }

  if ((count ?? 0) >= maxConcurrent) {
    // ── S4-B: Emit concurrent cap breach into Shield event bus ────────────────
    const mode = resolveShieldMode();
    const ev: Omit<JobEvent, "timestamp"> = {
      rule:     "job.queue.depth_warning",
      severity: "warning",
      threshold: {
        metric:          `concurrent_${studio}_jobs`,
        configuredValue: maxConcurrent,
        observedValue:   count ?? maxConcurrent,
        unit:            "active_jobs",
      },
      actionTaken:  "request_blocked",
      actionReason: `Concurrent ${studio} job cap hit — cap=${maxConcurrent} observed=${count ?? maxConcurrent}`,
      mode,
      userId,
      studioType:  studio,
      queueDepth:  count ?? maxConcurrent,
    };
    void emitSecurityEvent(ev);

    const plural = maxConcurrent !== 1;
    return Response.json(
      {
        success: false,
        code:    "CONCURRENT_LIMIT",
        error:   `You already have ${maxConcurrent} active ${studio} job${plural ? "s" : ""} in progress. ` +
                 `Please wait for ${plural ? "one" : "it"} to complete before submitting a new request.`,
      },
      { status: 429 },
    );
  }

  return null;
}

/**
 * S3-C: Concurrent image job cap — max 4 per user.
 * Call after rate limit checks, before feature gate and dispatch.
 */
export async function checkImageConcurrentLimit(userId: string): Promise<Response | null> {
  return checkConcurrentJobLimit(userId, "image", 4);
}

/**
 * S3-C: Concurrent video job cap — max 1 per user.
 * Video jobs are long-running; 1 inflight is sufficient and controls cost.
 */
export async function checkVideoConcurrentLimit(userId: string): Promise<Response | null> {
  return checkConcurrentJobLimit(userId, "video", 1);
}

/**
 * S3-C: Concurrent lipsync job cap — max 1 per user.
 * Lipsync jobs are async and expensive; 1 inflight enforces serialization.
 */
export async function checkLipsyncConcurrentLimit(userId: string): Promise<Response | null> {
  return checkConcurrentJobLimit(userId, "lipsync", 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-D-1: CREATIVE DIRECTOR — CONCURRENT WORKFLOW CAP — 3 per user
// Queries workflow_runs (canonical record store for all Creative Director jobs).
// Active statuses: pending | running
// Lifecycle: pending → running → completed | failed | cancelled
// A partial index (idx_workflow_runs_status) already covers these two values.
// DB errors degrade gracefully — a broken check must never block requests.
// ─────────────────────────────────────────────────────────────────────────────

const CD_CONCURRENT_CAP = 3;

/**
 * S3-D: Concurrent Creative Director cap — max 3 active workflow_runs per user.
 * Active means status IN ('pending', 'running').
 * Call after rate limit checks, before createWorkflowRun().
 */
export async function checkConcurrentWorkflowLimit(userId: string): Promise<Response | null> {
  const { count, error } = await supabaseAdmin
    .from("workflow_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pending", "running"]);

  if (error) {
    console.error("[rate-limit] concurrent-workflow DB error:", error.message);
    return null; // degrade gracefully — a broken check must never block requests
  }

  if ((count ?? 0) >= CD_CONCURRENT_CAP) {
    // ── S4-B: Emit concurrent cap breach into Shield event bus ────────────────
    const mode = resolveShieldMode();
    const ev: Omit<JobEvent, "timestamp"> = {
      rule:     "job.queue.depth_warning",
      severity: "warning",
      threshold: {
        metric:          "concurrent_workflow_runs",
        configuredValue: CD_CONCURRENT_CAP,
        observedValue:   count ?? CD_CONCURRENT_CAP,
        unit:            "active_runs",
      },
      actionTaken:  "request_blocked",
      actionReason: `Creative Director concurrent cap hit — cap=${CD_CONCURRENT_CAP} observed=${count ?? CD_CONCURRENT_CAP}`,
      mode,
      userId,
      studioType:  "creative-director",
      queueDepth:  count ?? CD_CONCURRENT_CAP,
    };
    void emitSecurityEvent(ev);

    return Response.json(
      {
        success: false,
        code:    "CONCURRENT_LIMIT",
        error:   `You already have ${CD_CONCURRENT_CAP} active Creative Director jobs in progress. ` +
                 `Please wait for one to complete before submitting a new request.`,
      },
      { status: 429 },
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-D-2: CHARACTER STUDIO — CONCURRENT JOB CAP — 12 per user
// Queries influencer_generation_jobs (canonical record store for all Character
// Studio jobs). Active statuses: pending | running
// Lifecycle: pending → running → completed | failed | cancelled
// influencer_generation_jobs has no user_id column — ownership is resolved
// through ai_influencers (influencer_id → ai_influencers.user_id). The query
// uses a PostgREST inner join to scope the count to the authenticated user.
// Cap is 12 (not 6/10) to accommodate a full candidate batch (4–6 rows) +
// an identity sheet chain (up to 5 rows) running simultaneously, without
// false-positives on normal parallel usage.
// DB errors degrade gracefully — a broken check must never block requests.
// ─────────────────────────────────────────────────────────────────────────────

const CS_CONCURRENT_CAP = 12;

/**
 * S3-D: Concurrent Character Studio cap — max 12 active influencer_generation_jobs
 * per user. Active means status IN ('pending', 'running').
 * Count is scoped to the user via ai_influencers.user_id (no direct user_id column).
 * Call after auth check, before dispatch.
 */
export async function checkConcurrentInfluencerJobsLimit(userId: string): Promise<Response | null> {
  // influencer_generation_jobs has no user_id — scope through ai_influencers join
  const { count, error } = await supabaseAdmin
    .from("influencer_generation_jobs")
    .select("id, ai_influencers!inner(user_id)", { count: "exact", head: true })
    .eq("ai_influencers.user_id", userId)
    .in("status", ["pending", "running"]);

  if (error) {
    console.error("[rate-limit] concurrent-influencer-jobs DB error:", error.message);
    return null; // degrade gracefully — a broken check must never block requests
  }

  if ((count ?? 0) >= CS_CONCURRENT_CAP) {
    // ── S4-B: Emit concurrent cap breach into Shield event bus ────────────────
    const mode = resolveShieldMode();
    const ev: Omit<JobEvent, "timestamp"> = {
      rule:     "job.queue.depth_warning",
      severity: "warning",
      threshold: {
        metric:          "concurrent_character_studio_jobs",
        configuredValue: CS_CONCURRENT_CAP,
        observedValue:   count ?? CS_CONCURRENT_CAP,
        unit:            "active_jobs",
      },
      actionTaken:  "request_blocked",
      actionReason: `Character Studio concurrent cap hit — cap=${CS_CONCURRENT_CAP} observed=${count ?? CS_CONCURRENT_CAP}`,
      mode,
      userId,
      studioType:  "character-studio",
      queueDepth:  count ?? CS_CONCURRENT_CAP,
    };
    void emitSecurityEvent(ev);

    return Response.json(
      {
        success: false,
        code:    "CONCURRENT_LIMIT",
        error:   `You already have ${CS_CONCURRENT_CAP} active Character Studio jobs in progress. ` +
                 `Please wait for some to complete before submitting a new request.`,
      },
      { status: 429 },
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-G: LOGIN — 10 attempts per 10 minutes per IP
// Protects email/password sign-in from brute force.
// OTP is already protected by checkAuthRateLimit (5/600s).
// ─────────────────────────────────────────────────────────────────────────────

const LOGIN_WINDOW_S = 600; // 10 minutes
const LOGIN_MAX_REQ  = 10;

/**
 * Rate-limits email/password login attempts by IP.
 * Separate from OTP rate limit (checkAuthRateLimit) which covers send-otp.
 * Call at the top of the login API route, before calling signInWithPassword.
 */
export async function checkLoginRateLimit(ip: string): Promise<Response | null> {
  const res = await checkLimit(
    `login:${ip}`,
    LOGIN_WINDOW_S,
    LOGIN_MAX_REQ,
    "Too many login attempts. Please try again in 10 minutes.",
    "login",
  );
  if (res) emitRateLimitHit({ ipHash: hashIp(ip), limiterType: "login", configuredMax: LOGIN_MAX_REQ, windowS: LOGIN_WINDOW_S });
  return res;
}
