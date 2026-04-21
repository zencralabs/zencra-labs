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
