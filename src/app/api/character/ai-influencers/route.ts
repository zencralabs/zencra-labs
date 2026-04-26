/**
 * GET  /api/character/ai-influencers  — list user's influencers
 * POST /api/character/ai-influencers  — create new influencer + profile
 */

import { requireAuthUser }  from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { ok, serverErr, invalidInput, unauthorized } from "@/lib/api/route-utils";
import { parseBody }        from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { data: influencers, error } = await supabaseAdmin
    .from("ai_influencers")
    .select("*, ai_influencer_profiles(*)")
    .eq("user_id", userId)
    .neq("status", "archived")
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

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return invalidInput("name is required");

  // Profile fields (all optional at creation)
  const profile = {
    gender:           typeof body?.gender         === "string" ? body.gender         : null,
    age_range:        typeof body?.age_range       === "string" ? body.age_range       : null,
    skin_tone:        typeof body?.skin_tone       === "string" ? body.skin_tone       : null,
    face_structure:   typeof body?.face_structure  === "string" ? body.face_structure  : null,
    fashion_style:    typeof body?.fashion_style   === "string" ? body.fashion_style   : null,
    realism_level:    typeof body?.realism_level   === "string" ? body.realism_level   : null,
    mood:             Array.isArray(body?.mood)            ? (body.mood as string[])            : [],
    platform_intent:  Array.isArray(body?.platform_intent) ? (body.platform_intent as string[]) : [],
    appearance_notes: typeof body?.appearance_notes === "string" ? body.appearance_notes : null,
  };

  // Create influencer
  const { data: influencer, error: infErr } = await supabaseAdmin
    .from("ai_influencers")
    .insert({ user_id: userId, name, status: "draft" })
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
