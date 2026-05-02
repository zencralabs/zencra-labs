/**
 * PATCH /api/creative-director/directions/[id]/refine
 *
 * Upsert the refinement parameters for a direction.
 * Cinematic still-image composition controls only.
 * No video/motion language — sceneEnergy represents pose state for a still frame.
 *
 * Body (all optional — partial updates are valid):
 *   toneIntensity   number    0–100
 *   colorPalette    string    warm / cool / cinematic / neon / desaturated / vivid / monochrome
 *   lightingStyle   string    dramatic / soft / golden-hour / neon / overcast / studio / practical
 *   shotType        string    close / medium / wide / extreme-wide / macro / aerial
 *   lens            string    24mm / 35mm / 50mm / 85mm / 135mm
 *   cameraAngle     string    eye-level / low / high / dutch / top-down / worms-eye
 *   sceneEnergy     string    static / walking-pose / action-pose / dramatic-still
 *   identityLock    boolean   true = inject @handle identity into prompt
 */

import { NextResponse }     from "next/server";
import { getAuthUser }      from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import type { DirectionRefinementsRow } from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: directionId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    toneIntensity,
    colorPalette,
    lightingStyle,
    shotType,
    lens,
    cameraAngle,
    sceneEnergy,
    identityLock,
  } = body as Record<string, unknown>;

  // ── Verify direction ownership ────────────────────────────────────────────
  const { data: direction, error: fetchErr } = await supabaseAdmin
    .from("creative_directions")
    .select("id, user_id")
    .eq("id", directionId)
    .single();

  if (fetchErr || !direction) {
    return NextResponse.json({ error: "Direction not found" }, { status: 404 });
  }

  if (direction.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Validate tone_intensity range ─────────────────────────────────────────
  if (toneIntensity !== undefined) {
    const n = Number(toneIntensity);
    if (isNaN(n) || n < 0 || n > 100) {
      return NextResponse.json(
        { error: "toneIntensity must be a number between 0 and 100" },
        { status: 400 }
      );
    }
  }

  // ── Build upsert payload ──────────────────────────────────────────────────
  const upsertData: Record<string, unknown> = {
    direction_id: directionId,
    updated_at:   new Date().toISOString(),
  };

  if (toneIntensity  !== undefined) upsertData.tone_intensity  = Number(toneIntensity);
  if (colorPalette   !== undefined) upsertData.color_palette   = colorPalette;
  if (lightingStyle  !== undefined) upsertData.lighting_style  = lightingStyle;
  if (shotType       !== undefined) upsertData.shot_type       = shotType;
  if (lens           !== undefined) upsertData.lens            = lens;
  if (cameraAngle    !== undefined) upsertData.camera_angle    = cameraAngle;
  if (sceneEnergy    !== undefined) upsertData.scene_energy    = sceneEnergy;
  if (identityLock   !== undefined) upsertData.identity_lock   = Boolean(identityLock);

  // ── Upsert (one refinements row per direction) ────────────────────────────
  const { data: refinements, error: upsertErr } = await supabaseAdmin
    .from("direction_refinements")
    .upsert(upsertData, { onConflict: "direction_id" })
    .select()
    .single();

  if (upsertErr) {
    console.error("[directions/refine PATCH] upsert failed:", upsertErr);
    return NextResponse.json({ error: "Failed to save refinements" }, { status: 500 });
  }

  return NextResponse.json({ refinements: refinements as DirectionRefinementsRow });
}
