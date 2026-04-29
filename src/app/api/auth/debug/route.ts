/**
 * GET /api/auth/debug
 *
 * DEV-ONLY diagnostic endpoint.
 * Returns a step-by-step trace of every decision getAuthUser makes
 * so you can pinpoint exactly where Bearer-token auth is failing.
 *
 * NEVER deploy to production — the route is hard-blocked outside dev.
 *
 * Usage:
 *   curl -s http://localhost:3000/api/auth/debug \
 *     -H "Authorization: Bearer <your_access_token>" | jq .
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // ── Hard production block ───────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const trace: Record<string, unknown> = {};

  // ── Step 1: Env vars ────────────────────────────────────────────────────────
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  trace.step1_env = {
    supabaseUrl_present:     supabaseUrl.length > 0,
    supabaseAnonKey_present: supabaseAnonKey.length > 0,
    supabaseUrl_prefix:      supabaseUrl.slice(0, 30) + "...",
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ passed: false, failed_at: "step1_env", trace });
  }

  // ── Step 2: Authorization header ───────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  trace.step2_header = {
    present:        !!authHeader,
    starts_bearer:  authHeader?.startsWith("Bearer ") ?? false,
    raw_length:     authHeader?.length ?? 0,
  };

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ passed: false, failed_at: "step2_header", trace });
  }

  // ── Step 3: Token extraction ────────────────────────────────────────────────
  const token = authHeader.slice(7).trim();
  trace.step3_token = {
    length:         token.length,
    first_10_chars: token.slice(0, 10) + "...",
    last_4_chars:   "..." + token.slice(-4),
    looks_like_jwt: token.split(".").length === 3,
  };

  if (!token) {
    return NextResponse.json({ passed: false, failed_at: "step3_token", trace });
  }

  // ── Step 4: auth.getUser(token) ─────────────────────────────────────────────
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await client.auth.getUser(token);

  trace.step4_auth_getUser = {
    user_found:    !!user,
    user_id:       user?.id ?? null,
    user_email:    user?.email ?? null,
    error_message: authError?.message ?? null,
    error_status:  authError?.status  ?? null,
  };

  if (authError || !user) {
    return NextResponse.json({ passed: false, failed_at: "step4_auth_getUser", trace });
  }

  // ── Step 5: profiles.is_system check ───────────────────────────────────────
  const { data: profileMeta, error: profileErr } = await client
    .from("profiles")
    .select("is_system")
    .eq("id", user.id)
    .single();

  trace.step5_is_system = {
    profile_found:    !!profileMeta,
    is_system_value:  profileMeta?.is_system ?? null,
    would_block:      profileMeta?.is_system === true,
    rls_error:        profileErr?.message ?? null,
  };

  if (profileMeta?.is_system === true) {
    return NextResponse.json({ passed: false, failed_at: "step5_is_system_blocked", trace });
  }

  // ── All steps passed ────────────────────────────────────────────────────────
  return NextResponse.json({
    passed:  true,
    user_id: user.id,
    email:   user.email,
    trace,
  });
}
