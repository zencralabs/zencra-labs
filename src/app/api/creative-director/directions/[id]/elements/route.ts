/**
 * POST /api/creative-director/directions/[id]/elements
 *
 * Add a scene element to a direction.
 *
 * Body:
 *   type      string   required — subject / world / object / atmosphere
 *   label     string   required — "car", "rain", "neon signs"
 *   assetUrl  string   optional — reference image for this element
 *   weight    number   optional — 0.0–1.0 influence on generation (default 0.5)
 *   position  number   optional — ordering within type group (default 0)
 */

import { NextResponse }     from "next/server";
import { getAuthUser }      from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import type {
  DirectionElementRow,
  DirectionElementType,
} from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ELEMENT_TYPES: DirectionElementType[] = [
  "subject", "world", "object", "atmosphere"
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: directionId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, label, assetUrl, weight, position } = body as Record<string, unknown>;

  if (!type || !VALID_ELEMENT_TYPES.includes(type as DirectionElementType)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_ELEMENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!label || typeof label !== "string" || label.trim() === "") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  if (weight !== undefined) {
    const w = Number(weight);
    if (isNaN(w) || w < 0 || w > 1) {
      return NextResponse.json(
        { error: "weight must be a number between 0 and 1" },
        { status: 400 }
      );
    }
  }

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

  // ── Insert element ────────────────────────────────────────────────────────
  const { data: element, error: insertErr } = await supabaseAdmin
    .from("direction_elements")
    .insert({
      direction_id: directionId,
      type:         type as DirectionElementType,
      label:        label.trim(),
      asset_url:    assetUrl ?? null,
      weight:       weight !== undefined ? Number(weight) : 0.5,
      position:     position !== undefined ? Number(position) : 0,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("[directions/elements POST] insert failed:", insertErr);
    return NextResponse.json({ error: "Failed to add element" }, { status: 500 });
  }

  return NextResponse.json({ element: element as DirectionElementRow }, { status: 201 });
}
