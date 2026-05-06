/**
 * POST /api/admin/provider-costs/sync
 *
 * Fetches live balance/quota data from auto-sync providers and writes to:
 *   - provider_accounts (current_balance, quota_used, quota_total, balance_synced_at)
 *   - provider_balance_history (time-series snapshot)
 *
 * Currently automated:
 *   - fal.ai   — balance via fal account REST API
 *   - ElevenLabs — character quota via /v1/user/subscription
 *
 * Manual providers (openai, nano-banana, kling, byteplus, etc.) are skipped —
 * their balances must be updated manually via the admin UI.
 *
 * Admin-only. No user billing data is touched.
 *
 * Response 200:
 *   { success: true, synced: string[], errors: Record<string, string> }
 */

import type { NextRequest }  from "next/server";
import { NextResponse }      from "next/server";
import { requireAdmin }      from "@/lib/auth/admin-gate";
import { supabaseAdmin }     from "@/lib/supabase/admin";
import { logger }            from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// SYNC HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fal.ai balance sync
 * Endpoint: GET https://fal.run/me (returns { username, credits })
 * Auth: Key-Authentication: <FAL_KEY>
 */
async function syncFal(): Promise<{
  balance: number;
  unit: string;
}> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY not configured");

  const res = await fetch("https://fal.run/me", {
    headers: { "Authorization": `Key ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`fal.ai API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { credits?: number; balance?: number; [key: string]: unknown };

  // fal.ai returns credits in their account object — field name may vary
  const balance = (data.credits ?? data.balance ?? 0) as number;

  return { balance, unit: "USD" };
}

/**
 * ElevenLabs subscription quota sync
 * Endpoint: GET https://api.elevenlabs.io/v1/user/subscription
 * Auth: xi-api-key: <ELEVENLABS_API_KEY>
 */
async function syncElevenLabs(): Promise<{
  quotaUsed:      number;
  quotaTotal:     number;
  resetDate:      string | null;
}> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

  const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as {
    character_count?:     number;
    character_limit?:     number;
    next_character_count_reset_unix?: number;
    [key: string]: unknown;
  };

  const quotaUsed  = data.character_count  ?? 0;
  const quotaTotal = data.character_limit  ?? 0;
  const resetDate  = data.next_character_count_reset_unix
    ? new Date(data.next_character_count_reset_unix * 1000).toISOString().split("T")[0]
    : null;

  return { quotaUsed, quotaTotal, resetDate };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function writeProviderBalance(
  providerKey:    string,
  patch:          Record<string, unknown>,
  historyBalance: number | null,
  historyUnit:    string,
): Promise<void> {
  const now = new Date().toISOString();

  // Update provider_accounts
  const { error: updateErr } = await supabaseAdmin
    .from("provider_accounts")
    .update({ ...patch, balance_synced_at: now, updated_at: now })
    .eq("provider_key", providerKey);

  if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

  // Append to balance history
  const { error: histErr } = await supabaseAdmin
    .from("provider_balance_history")
    .insert({ provider_key: providerKey, balance: historyBalance, balance_unit: historyUnit });

  if (histErr) {
    // Non-fatal — history snapshot failure shouldn't block the main update
    logger.warn("admin/provider-sync", `balance history insert failed for ${providerKey}`, { message: histErr.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  // ── Admin auth check ────────────────────────────────────────────────────────
  const { adminError } = await requireAdmin(req);
  if (adminError) return adminError;

  // ── Run sync for each auto-sync provider ────────────────────────────────────
  const synced: string[] = [];
  const errors: Record<string, string> = {};

  // fal.ai
  try {
    const { balance, unit } = await syncFal();
    await writeProviderBalance(
      "fal",
      { current_balance: balance, balance_unit: unit },
      balance,
      unit,
    );
    synced.push("fal");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("admin/provider-sync", "fal.ai sync failed", { message: msg });
    errors["fal"] = msg;
  }

  // ElevenLabs
  try {
    const { quotaUsed, quotaTotal, resetDate } = await syncElevenLabs();
    await writeProviderBalance(
      "elevenlabs",
      {
        quota_used:        quotaUsed,
        quota_total:       quotaTotal,
        quota_reset_date:  resetDate,
        current_balance:   quotaTotal > 0 ? quotaTotal - quotaUsed : null,
        balance_unit:      "characters",
      },
      quotaTotal - quotaUsed,
      "characters",
    );
    synced.push("elevenlabs");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("admin/provider-sync", "ElevenLabs sync failed", { message: msg });
    errors["elevenlabs"] = msg;
  }

  return NextResponse.json({
    success: true,
    synced,
    errors,
    syncedAt: new Date().toISOString(),
  });
}
