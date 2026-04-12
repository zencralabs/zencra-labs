import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET  /api/account/security  — fetch 2FA / passkey status
 * POST /api/account/security  — manage 2FA (TOTP) and passkeys
 *
 * POST body:
 *   action: "enroll-totp"        → start TOTP enrollment, returns { qrCode, secret, factorId }
 *   action: "verify-totp"        → confirm enrollment, body also needs { factorId, code }
 *   action: "unenroll-totp"      → remove TOTP factor, body also needs { factorId }
 *   action: "register-passkey"   → server marks passkey_registered = true (client handles WebAuthn)
 *   action: "remove-passkey"     → server marks passkey_registered = false
 *
 * Auth: Bearer <access_token>
 */

async function getAuthedClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const accessToken = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) return { user: null, supabase: null, userClient: null };

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return { user: null, supabase: null, userClient: null };

  // User-scoped client (needed for MFA operations)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  return { user, supabase, userClient };
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { user, supabase } = await getAuthedClient(req);
  if (!user || !supabase) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Check TOTP factors
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totpFactors = (factors?.totp ?? []).filter(f => f.status === "verified");
  const hasTOTP = totpFactors.length > 0;

  // Check profile flags
  const { data: profile } = await supabase
    .from("profiles")
    .select("passkey_registered, totp_enabled")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    success: true,
    data: {
      totpEnabled: hasTOTP,
      totpFactorId: totpFactors[0]?.id ?? null,
      passkeyRegistered: profile?.passkey_registered ?? false,
    },
  });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, supabase, userClient } = await getAuthedClient(req);
  if (!user || !supabase || !userClient) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body?.action as string;

  // ── enroll-totp ────────────────────────────────────────────────────────────
  if (action === "enroll-totp") {
    const { data, error } = await userClient.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Zencra Labs",
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
    });
  }

  // ── verify-totp ────────────────────────────────────────────────────────────
  if (action === "verify-totp") {
    const factorId = String(body?.factorId ?? "");
    const code     = String(body?.code ?? "").replace(/\s/g, "");

    if (!factorId || !code) {
      return NextResponse.json({ success: false, error: "factorId and code are required" }, { status: 400 });
    }

    // Challenge then verify
    const { data: challenge, error: challengeErr } = await userClient.auth.mfa.challenge({ factorId });
    if (challengeErr) {
      return NextResponse.json({ success: false, error: challengeErr.message }, { status: 400 });
    }

    const { error: verifyErr } = await userClient.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyErr) {
      return NextResponse.json({ success: false, error: verifyErr.message }, { status: 400 });
    }

    // Persist flag to profile
    await supabase.from("profiles").update({ totp_enabled: true }).eq("id", user.id);

    return NextResponse.json({ success: true });
  }

  // ── unenroll-totp ──────────────────────────────────────────────────────────
  if (action === "unenroll-totp") {
    const factorId = String(body?.factorId ?? "");
    if (!factorId) {
      return NextResponse.json({ success: false, error: "factorId is required" }, { status: 400 });
    }

    const { error } = await userClient.auth.mfa.unenroll({ factorId });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await supabase.from("profiles").update({ totp_enabled: false }).eq("id", user.id);

    return NextResponse.json({ success: true });
  }

  // ── register-passkey ───────────────────────────────────────────────────────
  if (action === "register-passkey") {
    // WebAuthn registration happens client-side via Supabase JS.
    // This endpoint just persists the flag once the client confirms success.
    await supabase.from("profiles").update({ passkey_registered: true }).eq("id", user.id);
    return NextResponse.json({ success: true });
  }

  // ── remove-passkey ─────────────────────────────────────────────────────────
  if (action === "remove-passkey") {
    await supabase.from("profiles").update({ passkey_registered: false }).eq("id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
}
