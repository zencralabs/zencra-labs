/**
 * Supabase-native rate limiting helpers.
 *
 * Uses the check_rate_limit RPC (migration 012) which atomically increments
 * a counter in rate_limit_buckets and returns whether the request is within
 * the allowed limit. No external Redis or additional packages required.
 *
 * Two limiters:
 *   checkStudioRateLimit(userId)  — 15 req / 60s  per user (studio generate routes)
 *   checkAuthRateLimit(ip)        — 5  req / 600s per IP   (auth routes)
 *
 * Both helpers return:
 *   null            → request is allowed, continue
 *   Response (429)  → limit exceeded, return immediately
 *
 * Rate limit failures (RPC errors) are logged but never block requests —
 * a broken rate limiter should degrade gracefully, not cause outages.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO — 15 requests per 60 seconds per user
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_WINDOW_S = 60;
const STUDIO_MAX_REQ  = 15;

/**
 * Check studio generate rate limit for a given userId.
 * Call immediately after requireAuthUser — before feature gate and dispatch.
 *
 * Returns null if allowed, or a ready-made 429 Response if blocked.
 */
export async function checkStudioRateLimit(userId: string): Promise<Response | null> {
  const { data: allowed, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key:      `studio:${userId}`,
    p_window_s: STUDIO_WINDOW_S,
    p_max_req:  STUDIO_MAX_REQ,
  });

  if (error) {
    // Degrade gracefully — a broken rate limiter must never block legitimate requests
    console.error("[rate-limit] studio RPC error:", error.message);
    return null;
  }

  if (allowed === false) {
    return Response.json(
      {
        success: false,
        code:    "RATE_LIMITED",
        error:   `Rate limit exceeded. You can make ${STUDIO_MAX_REQ} generation requests per minute.`,
      },
      {
        status:  429,
        headers: { "Retry-After": String(STUDIO_WINDOW_S) },
      }
    );
  }

  return null;
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
 * IP resolution order (per approval):
 *   1. request.ip (Vercel edge, set on NextRequest)
 *   2. x-forwarded-for header (first value)
 *   3. random UUID fallback (no shared bucket for unknown IPs)
 *
 * Returns null if allowed, or a ready-made 429 Response if blocked.
 */
export async function checkAuthRateLimit(ip: string): Promise<Response | null> {
  const { data: allowed, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key:      `auth:${ip}`,
    p_window_s: AUTH_WINDOW_S,
    p_max_req:  AUTH_MAX_REQ,
  });

  if (error) {
    console.error("[rate-limit] auth RPC error:", error.message);
    return null;
  }

  if (allowed === false) {
    return Response.json(
      {
        success: false,
        code:    "RATE_LIMITED",
        error:   "Too many requests. Try again in 10 minutes.",
      },
      {
        status:  429,
        headers: { "Retry-After": String(AUTH_WINDOW_S) },
      }
    );
  }

  return null;
}
