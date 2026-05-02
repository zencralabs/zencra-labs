/**
 * POST /api/waitlist/join
 *
 * Public endpoint — no authentication required.
 * Accepts a waitlist signup and inserts into `waitlist_users` via service role.
 *
 * Request body:
 *   { email: string; name?: string; role?: string; intent?: string }
 *
 * Success (including duplicate email):
 *   200 { ok: true, message: "You're on the list. We'll send access soon." }
 *
 * Validation failure:
 *   400 { ok: false, error: "<field message>" }
 *
 * Server failure:
 *   200 { ok: false, error: "Unable to join waitlist right now." }
 *   (200 to avoid leaking server state to public clients)
 *
 * Security:
 *   - IP rate-limited via existing checkIpStudioRateLimit helper.
 *   - Duplicate email returns the same success message (no enumeration).
 *   - DB errors are never forwarded to the client.
 *   - Service role key is used — anon key never touches this table.
 */

import { supabaseAdmin }                              from "@/lib/supabase/admin";
import { checkIpStudioRateLimit, getClientIp }        from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Allowed role values ───────────────────────────────────────────────────────
const VALID_ROLES = new Set([
  "creator",
  "filmmaker",
  "brand",
  "developer",
  "studio",
  "other",
]);

// ── Field limits ─────────────────────────────────────────────────────────────
const NAME_MAX   = 80;
const INTENT_MAX = 600;

// ── Generic success message (returned for duplicates too) ────────────────────
const SUCCESS_MSG = "You're on the list. We'll send access soon.";
const FAILURE_MSG = "Unable to join waitlist right now.";

// ── Simple email format check ────────────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request): Promise<Response> {
  // ── IP rate limiting ──────────────────────────────────────────────────────
  const ip             = getClientIp(req);
  const rateLimitError = await checkIpStudioRateLimit(ip);
  if (rateLimitError) return rateLimitError;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  // ── Email — required ─────────────────────────────────────────────────────
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!rawEmail) {
    return Response.json({ ok: false, error: "Email is required." }, { status: 400 });
  }
  if (!isValidEmail(rawEmail)) {
    return Response.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }

  // ── Name — optional, max 80 chars ────────────────────────────────────────
  const rawName = typeof body.name === "string" ? body.name.trim() : null;
  if (rawName && rawName.length > NAME_MAX) {
    return Response.json(
      { ok: false, error: `Name must be ${NAME_MAX} characters or fewer.` },
      { status: 400 },
    );
  }

  // ── Role — optional but must be in allowlist if provided ─────────────────
  const rawRole = typeof body.role === "string" ? body.role.trim() : null;
  if (rawRole && !VALID_ROLES.has(rawRole)) {
    return Response.json(
      { ok: false, error: `Role must be one of: ${[...VALID_ROLES].join(", ")}.` },
      { status: 400 },
    );
  }

  // ── Intent — optional, max 600 chars ─────────────────────────────────────
  const rawIntent = typeof body.intent === "string" ? body.intent.trim() : null;
  if (rawIntent && rawIntent.length > INTENT_MAX) {
    return Response.json(
      { ok: false, error: `Please keep your message under ${INTENT_MAX} characters.` },
      { status: 400 },
    );
  }

  // ── Insert (service role bypasses RLS) ───────────────────────────────────
  const { error } = await supabaseAdmin.from("waitlist_users").insert({
    email:  rawEmail,
    name:   rawName   || null,
    role:   rawRole   || null,
    intent: rawIntent || null,
    status: "pending",
  });

  if (error) {
    // 23505 = unique_violation (duplicate email) — treat as success to prevent enumeration
    if (error.code === "23505") {
      return Response.json({ ok: true, message: SUCCESS_MSG }, { status: 200 });
    }

    // All other DB errors: log server-side, return generic failure
    console.error("[waitlist/join] insert error:", error.code, error.message);
    return Response.json({ ok: false, error: FAILURE_MSG }, { status: 200 });
  }

  console.log(`[waitlist/join] new signup: email="${rawEmail}" role="${rawRole ?? ""}"`);
  return Response.json({ ok: true, message: SUCCESS_MSG }, { status: 200 });
}
