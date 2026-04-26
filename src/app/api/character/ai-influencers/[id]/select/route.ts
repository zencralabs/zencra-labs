/**
 * POST /api/character/ai-influencers/:id/select
 *
 * The identity lock creation moment.
 * Called when user selects one candidate image as their influencer.
 *
 * Atomically:
 *   1. Creates influencer_assets record (candidate → hero)
 *   2. Creates identity_locks record with signature stubs
 *   3. Updates ai_influencers (hero_asset_id, identity_lock_id, status: 'active')
 *
 * Returns the full context needed for the client to unlock packs.
 *
 * Request body:
 *   {
 *     candidate_url: string,
 *     candidate_job_id?: string   (optional — for linking job record)
 *   }
 */

import { requireAuthUser }     from "@/lib/supabase/server";
import { ok, invalidInput, serverErr, parseBody } from "@/lib/api/route-utils";
import { createIdentityLock }  from "@/lib/influencer/identity-lock";
import { supabaseAdmin }       from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { id: influencer_id } = await params;

  // ── Parse body ──────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const candidate_url = typeof body?.candidate_url === "string" ? body.candidate_url.trim() : "";
  if (!candidate_url) return invalidInput("candidate_url is required");

  // ── Verify ownership ─────────────────────────────────────────────────────────
  const { data: influencer, error: infErr } = await supabaseAdmin
    .from("ai_influencers")
    .select("id, user_id, style_category")
    .eq("id", influencer_id)
    .eq("user_id", userId)
    .single();

  if (infErr || !influencer) return invalidInput("Influencer not found");

  // ── Fetch profile (needed for signature building) ────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from("ai_influencer_profiles")
    .select("*")
    .eq("influencer_id", influencer_id)
    .single();

  // ── Create identity lock (the critical moment) ───────────────────────────────
  try {
    const result = await createIdentityLock({
      influencer_id,
      candidate_url,
      style_category: influencer.style_category ?? "hyper-real",
      profile: profile ?? {
        id: "", influencer_id,
        gender: null, age_range: null, skin_tone: null, face_structure: null,
        fashion_style: null, realism_level: null, mood: [], platform_intent: [],
        appearance_notes: null, created_at: "", updated_at: "",
      },
    });

    // Optionally link candidate_job_id to asset if provided
    if (typeof body?.candidate_job_id === "string") {
      await supabaseAdmin
        .from("influencer_generation_jobs")
        .update({ status: "completed" })
        .eq("external_job_id", body.candidate_job_id)
        .eq("influencer_id", influencer_id);
    }

    return ok({
      influencer:       result.influencer,
      identity_lock_id: result.lock.id,
      canonical_asset_id: result.asset.id,
      hero_url:         result.asset.url,
    });
  } catch (err) {
    console.error("[POST /select] createIdentityLock failed:", err);
    return serverErr("Failed to create identity lock");
  }
}
