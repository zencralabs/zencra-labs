/**
 * POST /api/preview-access
 *
 * Validates a private preview access code against the private_preview_access
 * table in Supabase. All DB access uses the service role key — the anon key
 * never touches this table.
 *
 * Request body:
 *   { accessCode: string, email?: string }
 *
 * Success response:
 *   200 { ok: true }
 *
 * Failure response (all failure modes use the same generic message):
 *   403 { ok: false, error: "Invalid preview code" }
 *
 * Security notes:
 *   - Never reveals whether a code exists, is expired, or has hit max_uses.
 *   - Rate-limited by IP using the existing checkIpStudioRateLimit helper.
 *   - Only the service role key is used — not the anon key.
 */

import { supabaseAdmin }             from "@/lib/supabase/admin";
import { checkIpStudioRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Invalid preview code";

export async function POST(req: Request): Promise<Response> {
  // ── IP Rate limit ────────────────────────────────────────────────────────────
  const ip             = getClientIp(req);
  const rateLimitError = await checkIpStudioRateLimit(ip);
  if (rateLimitError) return rateLimitError;

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: { accessCode?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 400 });
  }

  const rawCode = typeof body.accessCode === "string" ? body.accessCode.trim() : "";
  if (!rawCode) {
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 403 });
  }

  // ── Validate code against DB (service role — bypasses RLS) ──────────────────
  const { data, error } = await supabaseAdmin
    .from("private_preview_access")
    .select("id, is_active, max_uses, used_count, expires_at")
    .eq("access_code", rawCode)
    .single();

  if (error || !data) {
    // Code not found — return generic error, never leak existence
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 403 });
  }

  // ── Reject inactive codes ────────────────────────────────────────────────────
  if (!data.is_active) {
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 403 });
  }

  // ── Reject expired codes ─────────────────────────────────────────────────────
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 403 });
  }

  // ── Reject max_uses exceeded ─────────────────────────────────────────────────
  if (data.max_uses !== null && data.used_count >= data.max_uses) {
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 403 });
  }

  // ── Increment used_count (fire-and-forget — do not fail the request on error) ─
  void supabaseAdmin
    .from("private_preview_access")
    .update({ used_count: data.used_count + 1 })
    .eq("id", data.id)
    .then(({ error: updateErr }) => {
      if (updateErr) {
        console.error("[preview-access] failed to increment used_count:", updateErr.message);
      }
    });

  // ── Optionally log email (non-blocking) ──────────────────────────────────────
  const email = typeof body.email === "string" ? body.email.trim() : null;
  if (email) {
    // If a separate email capture table is added later, write here.
    // For now, log server-side only (never returned to client).
    console.log(`[preview-access] code="${rawCode}" email="${email}" granted`);
  } else {
    console.log(`[preview-access] code="${rawCode}" granted (no email)`);
  }

  return Response.json({ ok: true }, { status: 200 });
}
