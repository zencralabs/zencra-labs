/**
 * POST /api/character/ai-influencers/:id/lock-candidate
 *
 * Multi-lock identity endpoint. Called once per candidate the user wants to lock.
 * Each call creates a NEW sibling ai_influencers record (linked to the parent via
 * parent_influencer_id) and builds a full identity_lock for that candidate.
 *
 * The parent influencer record stays in status='draft' — it is the session anchor.
 * Each sibling is immediately promoted to status='active' via createIdentityLock().
 *
 * Request body:
 *   {
 *     candidate_url:    string,   — URL of the candidate image to lock
 *     candidate_job_id?: string   — optional job link
 *   }
 *
 * Returns:
 *   {
 *     influencer_id:     string,
 *     identity_lock_id:  string,
 *     canonical_asset_id: string,
 *     hero_url:          string,
 *     slots_remaining:   number
 *   }
 */

import { requireAuthUser }    from "@/lib/supabase/server";
import { ok, invalidInput, serverErr, parseBody } from "@/lib/api/route-utils";
import { supabaseAdmin }      from "@/lib/supabase/admin";
import { createIdentityLock } from "@/lib/influencer/identity-lock";
import { getUserSlotInfo }    from "@/lib/influencer/identity-slots";
import type { StyleCategory } from "@/lib/influencer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { id: parent_influencer_id } = await params;

  // ── Parse body ─────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  const candidate_url = typeof body?.candidate_url === "string" ? body.candidate_url.trim() : "";
  if (!candidate_url) return invalidInput("candidate_url is required");

  // ── Verify parent influencer ownership ─────────────────────────────────────
  const { data: parent, error: parentErr } = await supabaseAdmin
    .from("ai_influencers")
    .select("id, user_id, style_category, handle, display_name")
    .eq("id", parent_influencer_id)
    .eq("user_id", userId)
    .single();

  if (parentErr || !parent) return invalidInput("Influencer not found");

  // ── Check slot availability ────────────────────────────────────────────────
  const slotInfo = await getUserSlotInfo(userId);
  if (slotInfo.remaining <= 0) {
    return invalidInput(
      `Identity slot limit reached (${slotInfo.used}/${slotInfo.limit}). ` +
      "Delete an existing influencer to free a slot, or upgrade your plan.",
    );
  }

  // ── Fetch parent profile (copy to sibling) ─────────────────────────────────
  const { data: parentProfile } = await supabaseAdmin
    .from("ai_influencer_profiles")
    .select("*")
    .eq("influencer_id", parent_influencer_id)
    .single();

  const profile = parentProfile ?? {
    id: "", influencer_id: parent_influencer_id,
    gender: null, age_range: null, skin_tone: null, face_structure: null,
    fashion_style: null, realism_level: null, mood: [], platform_intent: [],
    appearance_notes: null, created_at: "", updated_at: "",
  };

  // ── Create sibling influencer record ──────────────────────────────────────
  // Siblings inherit style settings from parent; handle stays unique via counter
  const siblingHandle      = `${parent.handle ?? "influencer"}_${Date.now().toString(36)}`;
  const siblingDisplayName = parent.display_name ?? "Influencer";

  const { data: sibling, error: sibErr } = await supabaseAdmin
    .from("ai_influencers")
    .insert({
      user_id:              userId,
      name:                 siblingDisplayName,
      handle:               siblingHandle,
      display_name:         siblingDisplayName,
      status:               "draft",                     // createIdentityLock will promote to active
      style_category:       (parent.style_category ?? "hyper-real") as StyleCategory,
      parent_influencer_id: parent_influencer_id,        // sibling link
    })
    .select()
    .single();

  if (sibErr || !sibling) {
    console.error("[lock-candidate] create sibling failed:", sibErr);
    return serverErr("Failed to create influencer identity");
  }

  // ── Create sibling profile ─────────────────────────────────────────────────
  await supabaseAdmin
    .from("ai_influencer_profiles")
    .insert({
      influencer_id:    sibling.id,
      gender:           profile.gender,
      age_range:        profile.age_range,
      skin_tone:        profile.skin_tone,
      face_structure:   profile.face_structure,
      fashion_style:    profile.fashion_style,
      realism_level:    profile.realism_level,
      mood:             profile.mood,
      platform_intent:  profile.platform_intent,
      appearance_notes: profile.appearance_notes,
    });

  // ── Create identity lock on the sibling ──────────────────────────────────
  try {
    const result = await createIdentityLock({
      influencer_id:  sibling.id,
      candidate_url,
      style_category: (sibling.style_category ?? "hyper-real") as StyleCategory,
      profile: { ...profile, influencer_id: sibling.id },
    });

    // Optionally link candidate_job_id
    if (typeof body?.candidate_job_id === "string") {
      await supabaseAdmin
        .from("influencer_generation_jobs")
        .update({ status: "completed" })
        .eq("external_job_id", body.candidate_job_id)
        .eq("influencer_id", parent_influencer_id);
    }

    // Re-read slot info to return accurate remaining count
    const updatedSlots = await getUserSlotInfo(userId);

    return ok({
      influencer_id:      result.influencer.id,
      identity_lock_id:   result.lock.id,
      canonical_asset_id: result.asset.id,
      hero_url:           result.asset.url,
      handle:             result.influencer.handle,
      display_name:       result.influencer.display_name,
      slots_remaining:    updatedSlots.remaining,
    });
  } catch (err) {
    // Clean up the sibling on failure
    await supabaseAdmin.from("ai_influencers").delete().eq("id", sibling.id);
    console.error("[lock-candidate] createIdentityLock failed:", err);
    return serverErr("Failed to lock identity");
  }
}
