/**
 * GET  /api/character/ai-influencers  — list user's influencers
 * POST /api/character/ai-influencers  — create new influencer + profile (handle auto-generated)
 */

import { requireAuthUser }  from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { ok, serverErr, invalidInput } from "@/lib/api/route-utils";
import { parseBody }        from "@/lib/api/route-utils";
import { STYLE_CATEGORY_VALUES } from "@/lib/influencer/types";
import type { StyleCategory }    from "@/lib/influencer/types";
import { generateUniqueHandle }  from "@/lib/ai-influencer/name-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // Library shows only locked (active) influencers.
  // Draft records are session anchors (candidate generation parents) and
  // should not appear in the library. Archived = soft-deleted (never shown).
  const { data: influencers, error } = await supabaseAdmin
    .from("ai_influencers")
    .select("*, ai_influencer_profiles(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .not("identity_lock_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/character/ai-influencers]", error);
    return serverErr();
  }

  return ok({ influencers: influencers ?? [] });
}

export async function POST(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  // Style category — validated against allowed values; defaults to hyper-real
  const rawCategory = typeof body?.style_category === "string" ? body.style_category : "hyper-real";
  const style_category: StyleCategory = STYLE_CATEGORY_VALUES.includes(rawCategory as StyleCategory)
    ? (rawCategory as StyleCategory)
    : "hyper-real";

  // Ethnicity/Region — drives region-aware naming + prompt genetics
  const ethnicity_region: string | null =
    typeof body?.ethnicity_region === "string" && body.ethnicity_region.trim()
      ? (body.ethnicity_region as string).trim()
      : null;

  // Auto-generate a unique handle for this user (region-aware)
  let handle: string;
  let display_name: string;
  try {
    const generated = await generateUniqueHandle(userId, ethnicity_region);
    handle       = generated.handle;
    display_name = generated.displayName;
  } catch (err) {
    console.error("[POST /api/character/ai-influencers] handle generation failed:", err);
    return serverErr("Failed to generate influencer handle");
  }

  // Mixed/Blended heritage persistence fix — previously ephemeral (frontend-only).
  // Now stored in DB so the generate route can read it via select("*") without changes.
  const mixed_blend_regions: string[] = Array.isArray(body?.mixed_blend_regions)
    ? (body.mixed_blend_regions as unknown[]).filter((r): r is string => typeof r === "string")
    : [];

  // Profile fields (all optional at creation)
  const profile = {
    gender:           typeof body?.gender           === "string" ? body.gender           : null,
    age_range:        typeof body?.age_range         === "string" ? body.age_range         : null,
    skin_tone:        typeof body?.skin_tone         === "string" ? body.skin_tone         : null,
    face_structure:   typeof body?.face_structure    === "string" ? body.face_structure    : null,
    fashion_style:    typeof body?.fashion_style     === "string" ? body.fashion_style     : null,
    realism_level:    typeof body?.realism_level     === "string" ? body.realism_level     : null,
    mood:             Array.isArray(body?.mood)             ? (body.mood as string[])             : [],
    platform_intent:  Array.isArray(body?.platform_intent)  ? (body.platform_intent as string[])  : [],
    appearance_notes: typeof body?.appearance_notes  === "string" ? body.appearance_notes  : null,
    ethnicity_region,
    mixed_blend_regions,
    // Phase A — Advanced Identity Traits (all optional; null/empty = not set)
    species:       typeof body?.species       === "string" ? body.species       : null,
    hair_identity: typeof body?.hair_identity === "string" ? body.hair_identity : null,
    eye_color:     typeof body?.eye_color     === "string" ? body.eye_color     : null,
    eye_type:      typeof body?.eye_type      === "string" ? body.eye_type      : null,
    skin_marks:    Array.isArray(body?.skin_marks)
      ? (body.skin_marks as unknown[]).filter((s): s is string => typeof s === "string")
      : [],
    ear_type:      typeof body?.ear_type      === "string" ? body.ear_type      : null,
    horn_type:     typeof body?.horn_type     === "string" ? body.horn_type     : null,
  };

  // Tags — user-defined library filter labels (e.g. ["Fashion", "Luxury"])
  const tags: string[] = Array.isArray(body?.tags) ? (body.tags as string[]) : [];

  // Create influencer — name mirrors display_name for backwards compatibility
  const { data: influencer, error: infErr } = await supabaseAdmin
    .from("ai_influencers")
    .insert({
      user_id:      userId,
      name:         display_name,   // internal name = display name (e.g. "Nova")
      handle,                       // stored without @ (e.g. "nova")
      display_name,                 // clean display (e.g. "Nova")
      status:       "draft",
      style_category,
      tags,
    })
    .select()
    .single();

  if (infErr || !influencer) {
    console.error("[POST /api/character/ai-influencers] create influencer:", infErr);
    return serverErr("Failed to create influencer");
  }

  // Create profile
  const { error: profErr } = await supabaseAdmin
    .from("ai_influencer_profiles")
    .insert({ influencer_id: influencer.id, ...profile });

  if (profErr) {
    console.error("[POST /api/character/ai-influencers] create profile:", profErr);
    // Non-fatal — influencer exists, profile can be created later
  }

  return ok({ influencer });
}

// Satisfy unused import check
void invalidInput;
