import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAuthRateLimit, hashIp }            from "@/lib/security/rate-limit";
import { emitSecurityEvent, resolveShieldMode }  from "@/lib/security/events";
import type { AuthEvent }                        from "@/lib/security/types";

/**
 * POST /api/auth/send-otp
 *
 * Dispatches a phone OTP via Supabase Phone Auth (backed by Twilio Verify).
 * Body: { phone: "+15551234567" }
 *
 * Returns:
 *   200  { success: true }
 *   400  { success: false, error: "..." }   — bad input / Supabase error
 *   429  { success: false, error: "..." }   — rate limited
 *   500  { success: false, error: "..." }   — server misconfiguration
 */

const PHONE_RE = /^\+[1-9]\d{6,14}$/;

export async function POST(req: NextRequest) {
  // ── Auth rate limit (5 req / 10 min per IP) ─────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? crypto.randomUUID();
  const rateLimitError = await checkAuthRateLimit(ip);
  if (rateLimitError) return rateLimitError;

  // Validate env
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { success: false, error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Parse body
  let phone: string;
  try {
    const body = await req.json();
    phone = (body?.phone ?? "").trim();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { success: false, error: "Phone must be in E.164 format, e.g. +15551234567" },
      { status: 400 }
    );
  }

  // Use the public anon key for phone OTP (routes through Supabase → Twilio Verify)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: otpError } = await anonClient.auth.signInWithOtp({ phone });
  if (otpError) {
    console.error("[send-otp]", otpError.message);

    // Shield: emit auth.otp.failed — fire-and-forget, noAlert=true (no Discord spam).
    // Persists to security_events_log in observe/enforce mode for /hub analytics.
    const ipHash = hashIp(ip);
    const mode   = resolveShieldMode();
    const authEv: Omit<AuthEvent, "timestamp"> = {
      rule:         "auth.otp.failed",
      severity:     "warning",
      threshold: {
        metric:          "otp_failure_count",
        configuredValue: 0,
        observedValue:   1,
        unit:            "attempt",
      },
      actionTaken:  mode !== "dry-run" ? "alerted" : "logged_only",
      actionReason: `OTP send failure — IP hash ${ipHash}`,
      mode,
      noAlert:      true,
      ipHash,
    };
    void emitSecurityEvent(authEv);

    return NextResponse.json({ success: false, error: otpError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
