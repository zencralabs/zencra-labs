import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendVerificationEmail } from "@/lib/email/resend";
import { checkAuthRateLimit } from "@/lib/security/rate-limit";

/**
 * POST /api/auth/resend-verification
 *
 * Re-sends the email verification link to the currently signed-in user.
 * Uses the Authorization header (Bearer <access_token>) to identify the caller.
 *
 * Returns:
 *   200  { success: true }
 *   401  { success: false, error: "Unauthorized" }
 *   429  { success: false, error: "Rate limit …" }
 *   500  { success: false, error: "…" }
 */

export async function POST(req: NextRequest) {
  // ── Auth rate limit (5 req / 10 min per IP) ─────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? crypto.randomUUID();
  const rateLimitError = await checkAuthRateLimit(ip);
  if (rateLimitError) return rateLimitError;

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
  }

  // Authenticate caller
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Validate the token and get the user
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (user.email_confirmed_at) {
    // Already verified — no need to resend
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const email = user.email;
  if (!email) {
    return NextResponse.json({ success: false, error: "No email address on account" }, { status: 400 });
  }

  // Generate a new magic link / verification link via Supabase admin
  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.zencralabs.com";
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[resend-verification] generateLink error:", linkError?.message);
    return NextResponse.json({ success: false, error: "Could not generate verification link" }, { status: 500 });
  }

  // Send via Resend (branded email)
  const name = user.user_metadata?.full_name as string | undefined;
  const sendResult = await sendVerificationEmail({
    to: email,
    name: name ?? email.split("@")[0],
    verificationLink: linkData.properties.action_link,
  });

  if (!sendResult.success) {
    console.error("[resend-verification] email send failed:", sendResult.error);
    return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
