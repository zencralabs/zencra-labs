import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * PATCH /api/account/profile
 *
 * Update the authenticated user's profile.
 * Body (all fields optional):
 *   { full_name?: string, avatar_color?: number }
 *
 * Auth: Bearer <access_token>
 */

export async function PATCH(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
  }

  // Auth
  const accessToken = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Parse + whitelist allowed fields
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if (typeof body.full_name === "string" && body.full_name.trim()) {
    allowed.full_name = body.full_name.trim().slice(0, 120);
  }
  if (typeof body.avatar_color === "number") {
    allowed.avatar_color = Math.max(0, Math.min(7, Math.floor(body.avatar_color)));
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields provided" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) {
    console.error("[profile PATCH]", updateError.message);
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  // Also update Supabase auth user metadata for full_name
  if (allowed.full_name) {
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { full_name: allowed.full_name },
    });
  }

  return NextResponse.json({ success: true });
}
