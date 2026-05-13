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
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

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
  return checkLimit(
    `studio:${userId}`,
    STUDIO_WINDOW_S,
    STUDIO_MAX_REQ,
    `Rate limit exceeded. You can make ${STUDIO_MAX_REQ} generation requests per minute.`,
    "studio-user",
  );
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
  return checkLimit(
    `ip:${ip}:studio`,
    STUDIO_IP_WINDOW_S,
    STUDIO_IP_MAX_REQ,
    `Too many generation requests from your network. Try again in a minute.`,
    "studio-ip",
  );
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
  return checkLimit(
    `enhance:${userId}`,
    ENHANCE_WINDOW_S,
    ENHANCE_MAX_REQ,
    `Rate limit exceeded. You can enhance ${ENHANCE_MAX_REQ} prompts per minute.`,
    "enhance",
  );
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
  return checkLimit(
    `auth:${ip}`,
    AUTH_WINDOW_S,
    AUTH_MAX_REQ,
    "Too many requests. Try again in 10 minutes.",
    "auth",
  );
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
  return checkLimit(
    `upload_ref:${userId}`,
    UPLOAD_REF_WINDOW_S,
    UPLOAD_REF_MAX_REQ,
    `Upload limit reached. You can upload ${UPLOAD_REF_MAX_REQ} reference images per hour.`,
    "upload_ref",
  );
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
  return checkLimit(
    `brief_improve:${userId}`,
    BRIEF_IMPROVE_WINDOW_S,
    BRIEF_IMPROVE_MAX_REQ,
    `Brief improvement limit reached. You can improve ${BRIEF_IMPROVE_MAX_REQ} briefs per hour.`,
    "brief_improve",
  );
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
  return checkLimit(
    `video:${userId}`,
    VIDEO_WINDOW_S,
    VIDEO_MAX_REQ,
    `Video generation rate limit exceeded. You can generate ${VIDEO_MAX_REQ} videos per minute. Video generation is resource-intensive — please wait before submitting another request.`,
    "video-user",
  );
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
  return checkLimit(
    `lipsync_gen:${userId}`,
    LIPSYNC_GEN_WINDOW_S,
    LIPSYNC_GEN_MAX_REQ,
    `Lip sync rate limit exceeded. You can submit ${LIPSYNC_GEN_MAX_REQ} lip sync jobs per minute.`,
    "lipsync-gen-user",
  );
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
  return checkLimit(
    `media_upload:${userId}`,
    MEDIA_UPLOAD_WINDOW_S,
    MEDIA_UPLOAD_MAX_REQ,
    `Upload limit reached. You can upload ${MEDIA_UPLOAD_MAX_REQ} files per hour.`,
    "media-upload",
  );
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
  return checkLimit(
    `lipsync_upload:${userId}`,
    LIPSYNC_UPLOAD_WINDOW_S,
    LIPSYNC_UPLOAD_MAX_REQ,
    `Lip sync upload limit reached. You can upload ${LIPSYNC_UPLOAD_MAX_REQ} files per hour.`,
    "lipsync-upload",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// S3-F-3: WEBHOOK — 120 requests per 60 seconds per provider (soft/generous)
// Prevents webhook endpoint hammering while never blocking legitimate retries.
// Providers typically send 1–5 events per job; this cap handles storm scenarios.
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
// jobs in pending or processing state. Valid AssetStatus values are:
//   pending | processing | ready | failed | deleted
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
    .in("status", ["pending", "processing"]);

  if (error) {
    console.error(`[rate-limit] concurrent-${studio} DB error:`, error.message);
    return null; // degrade gracefully — a broken check must never block requests
  }

  if ((count ?? 0) >= maxConcurrent) {
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
  return checkLimit(
    `login:${ip}`,
    LOGIN_WINDOW_S,
    LOGIN_MAX_REQ,
    "Too many login attempts. Please try again in 10 minutes.",
    "login",
  );
}
