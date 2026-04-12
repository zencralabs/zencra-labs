import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/send-otp
 *
 * Dispatches a phone OTP via Supabase Phone Auth (backed by Twilio Verify).
 * Body: { phone: "+15551234567" }
 *
 * Returns:
 *   200  { success: true }
 *   400  { success: false, error: "..." }   — bad input / Supabase error
 *   500  { success: false, error: "..." }   — server misconfiguration
 */

const PHONE_RE = /^\+[1-9]\d{6,14}$/;

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ success: false, error: otpError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
