/**
 * POST /api/auth/login
 *
 * Server-side email/password authentication proxy.
 *
 * Exists solely to enforce IP-based rate limiting on credential attempts before
 * they reach Supabase — the client-side SDK cannot enforce server-side limits.
 *
 * Flow:
 *   1. Extract client IP and apply checkLoginRateLimit (10 attempts / 10 min per IP)
 *   2. Validate body — reject missing fields early, before any Supabase call
 *   3. Call supabase.auth.signInWithPassword() via the service-role admin client
 *   4. Return {access_token, refresh_token, expires_in} on success
 *      Return {error: "Invalid email or password"} on auth failure (never expose raw Supabase error)
 *
 * The client receives the session tokens and sets them locally via setSession().
 * OAuth, passkey, and OTP flows bypass this route — they are not credential-based.
 *
 * Security:
 *   - Rate limit: 10 attempts / 10 min per IP (checkLoginRateLimit)
 *   - Error message is always generic — never reveals whether email exists
 *   - Raw Supabase error messages are never forwarded to the client
 *   - Uses service-role client for signInWithPassword (server-side only path)
 */

import type { NextRequest } from "next/server";
import { createClient }     from "@supabase/supabase-js";
import { checkLoginRateLimit, getClientIp, hashIp } from "@/lib/security/rate-limit";
import { emitSecurityEvent, resolveShieldMode }      from "@/lib/security/events";
import type { AuthEvent }                            from "@/lib/security/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  // ── S3-G: Login rate limit — 10 attempts / 10 min per IP ─────────────────────
  const ip = getClientIp(req);
  const rateLimitError = await checkLoginRateLimit(ip);
  if (rateLimitError) return rateLimitError;

  // ── Parse body ──────────────────────────────────────────────────────────────
  let email: string;
  let password: string;
  try {
    const body = await req.json() as { email?: unknown; password?: unknown };
    email    = typeof body.email    === "string" ? body.email.trim()    : "";
    password = typeof body.password === "string" ? body.password        : "";
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !password) {
    return Response.json({ success: false, error: "Email and password are required" }, { status: 400 });
  }

  // ── Authenticate ────────────────────────────────────────────────────────────
  let supabase: ReturnType<typeof getAdminClient>;
  try {
    supabase = getAdminClient();
  } catch {
    return Response.json({ success: false, error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // Never expose raw Supabase error — always generic invalid-credentials message

    // Shield: emit auth.login.failed — fire-and-forget, noAlert=true (no Discord spam).
    // Persists to security_events_log in observe/enforce mode for /hub analytics.
    // Threshold-based alerting on repeated failures is deferred to a future phase.
    const ipHash = hashIp(ip);
    const mode   = resolveShieldMode();
    const authEv: Omit<AuthEvent, "timestamp"> = {
      rule:         "auth.login.failed",
      severity:     "warning",
      threshold: {
        metric:          "login_failure_count",
        configuredValue: 0,   // any failure is tracked; threshold alerting is future work
        observedValue:   1,
        unit:            "attempt",
      },
      actionTaken:  mode !== "dry-run" ? "alerted" : "logged_only",
      actionReason: `Failed credential login attempt — IP hash ${ipHash}`,
      mode,
      noAlert:      true,   // persist + log only; Discord suppressed until thresholds wired
      ipHash,
    };
    void emitSecurityEvent(authEv);

    return Response.json(
      { success: false, error: "Invalid email or password" },
      { status: 401 }
    );
  }

  return Response.json({
    success:       true,
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
    token_type:    data.session.token_type,
  });
}
