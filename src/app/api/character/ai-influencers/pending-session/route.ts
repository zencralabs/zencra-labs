/**
 * GET /api/character/ai-influencers/pending-session
 *
 * Returns the most recent candidate selection session that is ready for the user
 * to make a decision on — i.e. a draft ai_influencers row whose candidate_session
 * has status='ready'. The client uses this on page load to restore the candidate
 * selection UI instead of showing the empty builder state.
 *
 * Why this route exists:
 *   - User pays credits → candidates generated → page refreshes → candidates disappear.
 *   - Credits were already charged. The selection decision must survive a refresh.
 *
 * Response (session found):
 *   200 {
 *     session: {
 *       influencer_id:  string,
 *       style_category: string,
 *       candidate_urls: string[],
 *       expected_count: number,
 *       snapshot_extra: { bodyType, leftArm, rightArm, leftLeg, rightLeg, skinArt },
 *       profile: { gender, age_range, skin_tone, face_structure, fashion_style,
 *                  realism_level, mood, platform_intent, ethnicity_region,
 *                  mixed_blend_regions, species, hair_identity, eye_color,
 *                  eye_type, skin_marks, ear_type, horn_type },
 *       tags: string[]
 *     }
 *   }
 *
 * Response (no session found):
 *   200 { session: null }
 */

import { requireAuthUser } from "@/lib/supabase/server";
import { ok, serverErr }   from "@/lib/api/route-utils";
import { supabaseAdmin }   from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  try {
    // ── Find the most recent draft with a ready candidate session ─────────────
    // Only status='ready' sessions are surfaced — 'generating' means polling is
    // still in progress (client handles that), 'discarded' means user already
    // rejected this batch.
    const { data: influencers, error: infErr } = await supabaseAdmin
      .from("ai_influencers")
      .select("id, style_category, candidate_session, tags")
      .eq("user_id", userId)
      .eq("status", "draft")
      .not("candidate_session", "is", null)
      .order("created_at", { ascending: false })
      .limit(10); // fetch a small window; we'll filter for 'ready' below

    if (infErr) {
      console.error("[pending-session] query failed:", infErr);
      return serverErr("Failed to fetch pending session");
    }

    // Find the first 'ready' session from the candidate window
    type InfluencerRow = {
      id: string;
      style_category: string | null;
      tags: string[] | null;
      candidate_session: {
        status: string;
        candidate_urls?: string[];
        expected_count?: number;
        snapshot_extra?: {
          bodyType?: string;
          leftArm?:  string;
          rightArm?: string;
          leftLeg?:  string;
          rightLeg?: string;
          skinArt?:  string[];
        };
      } | null;
    };

    const readyInfluencer = (influencers as InfluencerRow[] | null)?.find(
      inf => (inf.candidate_session as { status: string } | null)?.status === "ready",
    );

    if (!readyInfluencer || !readyInfluencer.candidate_session) {
      return ok({ session: null });
    }

    const cs = readyInfluencer.candidate_session;

    // Guard: candidate_urls must be present and non-empty to be meaningful
    if (!Array.isArray(cs.candidate_urls) || cs.candidate_urls.length === 0) {
      return ok({ session: null });
    }

    // ── Fetch profile for snapshot reconstruction ──────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from("ai_influencer_profiles")
      .select(
        "gender, age_range, skin_tone, face_structure, fashion_style, realism_level, " +
        "mood, platform_intent, ethnicity_region, mixed_blend_regions, " +
        "species, hair_identity, eye_color, eye_type, skin_marks, ear_type, horn_type",
      )
      .eq("influencer_id", readyInfluencer.id)
      .single();

    // Build a safe snapshot_extra with defaults for all body arch fields
    const snapshotExtra = {
      bodyType: cs.snapshot_extra?.bodyType ?? "",
      leftArm:  cs.snapshot_extra?.leftArm  ?? "",
      rightArm: cs.snapshot_extra?.rightArm ?? "",
      leftLeg:  cs.snapshot_extra?.leftLeg  ?? "",
      rightLeg: cs.snapshot_extra?.rightLeg ?? "",
      skinArt:  Array.isArray(cs.snapshot_extra?.skinArt) ? cs.snapshot_extra!.skinArt : [],
    };

    return ok({
      session: {
        influencer_id:  readyInfluencer.id,
        style_category: readyInfluencer.style_category ?? "hyper-real",
        candidate_urls: cs.candidate_urls,
        expected_count: cs.expected_count ?? cs.candidate_urls.length,
        snapshot_extra: snapshotExtra,
        tags:           Array.isArray(readyInfluencer.tags) ? readyInfluencer.tags : [],
        profile: profile ?? {
          gender:             null,
          age_range:          null,
          skin_tone:          null,
          face_structure:     null,
          fashion_style:      null,
          realism_level:      null,
          mood:               [],
          platform_intent:    [],
          ethnicity_region:   null,
          mixed_blend_regions: [],
          species:            null,
          hair_identity:      null,
          eye_color:          null,
          eye_type:           null,
          skin_marks:         [],
          ear_type:           null,
          horn_type:          null,
        },
      },
    });
  } catch (err) {
    console.error("[pending-session] unexpected error:", err);
    return serverErr("Unexpected error fetching pending session");
  }
}
