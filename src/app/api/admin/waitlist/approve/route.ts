/**
 * POST /api/admin/waitlist/approve
 *
 * Admin-only endpoint. Approves a waitlist user by:
 *   1. Reading the waitlist entry by ID.
 *   2. Generating a unique ZEN-INVITE-XXXXX access code.
 *   3. Inserting the code into `private_preview_access`.
 *   4. Updating the waitlist entry: status=approved, access_code, approved_at.
 *
 * Request body:
 *   { waitlistUserId: string; maxUses?: number }
 *
 * Success:
 *   200 { ok: true, accessCode: "ZEN-INVITE-XXXXX" }
 *
 * Errors:
 *   403 { error: "Forbidden" }
 *   400 { error: "<reason>" }
 *   404 { error: "Waitlist user not found." }
 *   500 { error: "<reason>" }
 *
 * Security:
 *   - Requires admin role (copied from /api/admin/users pattern).
 *   - Uses service role key for all DB operations.
 *   - No email sent yet — code is returned for admin copy/paste.
 *
 * TODO: Wire in email delivery once an email provider is configured.
 */

import { NextResponse }              from "next/server";
import { randomBytes }               from "crypto";
import { supabaseAdmin }             from "@/lib/supabase/admin";
import { getAuthUser }               from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Admin guard (same pattern as /api/admin/users) ───────────────────────────
async function isAdmin(req: Request): Promise<boolean> {
  const user = await getAuthUser(req);
  if (!user) return false;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return data?.role === "admin";
}

// ── Code generator: ZEN-INVITE-XXXXX (5 uppercase alphanumerics) ─────────────
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateAccessCode(): string {
  const bytes = randomBytes(5);
  let suffix  = "";
  for (const b of bytes) {
    suffix += CHARSET[b % CHARSET.length];
  }
  return `ZEN-INVITE-${suffix}`;
}

export async function POST(req: Request): Promise<Response> {
  // ── Auth guard ───────────────────────────────────────────────────────────
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { waitlistUserId?: unknown; maxUses?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const waitlistUserId = typeof body.waitlistUserId === "string" ? body.waitlistUserId.trim() : "";
  if (!waitlistUserId) {
    return NextResponse.json({ error: "waitlistUserId is required." }, { status: 400 });
  }

  const maxUses =
    typeof body.maxUses === "number" && body.maxUses > 0 ? body.maxUses : 1;

  // ── Read waitlist user ────────────────────────────────────────────────────
  const { data: waitlistUser, error: readError } = await supabaseAdmin
    .from("waitlist_users")
    .select("id, email, status, access_code")
    .eq("id", waitlistUserId)
    .single();

  if (readError || !waitlistUser) {
    return NextResponse.json({ error: "Waitlist user not found." }, { status: 404 });
  }

  if (waitlistUser.status === "approved") {
    return NextResponse.json(
      { error: "User is already approved.", accessCode: waitlistUser.access_code },
      { status: 400 },
    );
  }

  // ── Generate code (retry once on collision — extremely unlikely) ───────────
  let accessCode = generateAccessCode();
  const { error: checkError } = await supabaseAdmin
    .from("private_preview_access")
    .select("id")
    .eq("access_code", accessCode)
    .single();
  if (!checkError) {
    // Code already exists — regenerate
    accessCode = generateAccessCode();
  }

  // ── Insert into private_preview_access ───────────────────────────────────
  const { error: insertError } = await supabaseAdmin
    .from("private_preview_access")
    .insert({
      access_code: accessCode,
      email:       waitlistUser.email,
      label:       `Waitlist - ${waitlistUser.email}`,
      max_uses:    maxUses,
      is_active:   true,
    });

  if (insertError) {
    console.error("[admin/waitlist/approve] insert preview_access error:", insertError.message);
    return NextResponse.json(
      { error: "Failed to create access code. Please try again." },
      { status: 500 },
    );
  }

  // ── Update waitlist_users record ─────────────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from("waitlist_users")
    .update({
      status:      "approved",
      access_code: accessCode,
      approved_at: new Date().toISOString(),
    })
    .eq("id", waitlistUserId);

  if (updateError) {
    // preview_access row is already inserted — log but don't fail; code is valid
    console.error("[admin/waitlist/approve] update waitlist_users error:", updateError.message);
  }

  console.log(
    `[admin/waitlist/approve] approved user="${waitlistUser.email}" code="${accessCode}" max_uses=${maxUses}`,
  );

  // TODO: Send approval email with accessCode when email provider is configured.

  return NextResponse.json({ ok: true, accessCode }, { status: 200 });
}
