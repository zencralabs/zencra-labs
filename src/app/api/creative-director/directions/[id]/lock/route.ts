/**
 * PATCH /api/creative-director/directions/[id]/lock
 *
 * Lock or unlock a direction.
 * Locking commits the direction — UI enables the Generate button.
 * Unlocking allows the user to explore / change refinements again.
 *
 * Body:
 *   isLocked  boolean  required
 *   modelKey  string   optional — model to lock for this direction
 */

import { NextResponse }     from "next/server";
import { getAuthUser }      from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import type { CreativeDirectionRow } from "@/lib/creative-director/types";

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

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { isLocked, modelKey } = body as { isLocked?: boolean; modelKey?: string };

  if (typeof isLocked !== "boolean") {
    return NextResponse.json({ error: "isLocked (boolean) is required" }, { status: 400 });
  }

  // ── Verify ownership ──────────────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("creative_directions")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Direction not found" }, { status: 404 });
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Update lock state ─────────────────────────────────────────────────────
  const updates: Record<string, unknown> = {
    is_locked:  isLocked,
    updated_at: new Date().toISOString(),
  };

  if (modelKey !== undefined) {
    updates.model_key = modelKey;
  }

  const { data: direction, error: updateErr } = await supabaseAdmin
    .from("creative_directions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    console.error("[directions/lock PATCH] update failed:", updateErr);
    return NextResponse.json({ error: "Failed to update direction" }, { status: 500 });
  }

  return NextResponse.json({ direction: direction as CreativeDirectionRow });
}
