/**
 * DELETE /api/creative-director/elements/[id]
 *
 * Remove a scene element from a direction.
 * Ownership is verified by traversing element → direction → user_id.
 */

import { NextResponse }   from "next/server";
import { getAuthUser }    from "@/lib/supabase/server";
import { supabaseAdmin }  from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: elementId } = await params;

  // ── Load element + direction for ownership check ──────────────────────────
  const { data: element, error: fetchErr } = await supabaseAdmin
    .from("direction_elements")
    .select("id, direction_id")
    .eq("id", elementId)
    .single();

  if (fetchErr || !element) {
    return NextResponse.json({ error: "Element not found" }, { status: 404 });
  }

  // Verify direction belongs to user
  const { data: direction, error: dirErr } = await supabaseAdmin
    .from("creative_directions")
    .select("id, user_id")
    .eq("id", element.direction_id)
    .single();

  if (dirErr || !direction) {
    return NextResponse.json({ error: "Direction not found" }, { status: 404 });
  }

  if (direction.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Delete element ────────────────────────────────────────────────────────
  const { error: deleteErr } = await supabaseAdmin
    .from("direction_elements")
    .delete()
    .eq("id", elementId);

  if (deleteErr) {
    console.error("[elements DELETE] delete failed:", deleteErr);
    return NextResponse.json({ error: "Failed to delete element" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, id: elementId });
}
