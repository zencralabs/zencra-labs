/**
 * /api/creative-director/directions/[id]/canvas
 *
 * PATCH — Write canvas_state for a direction (autosave).
 * GET   — Read canvas_state for a direction (restore on mount).
 *
 * canvas_state shape (version 1):
 * {
 *   version:          1,
 *   frames:           GenerationFrame[],
 *   textNodes:        CanvasTextNode[],
 *   connections:      NodeConnection[],
 *   uploadedAssets:   { id, url, name, assignedRole }[],
 *   selectedModel:    string,
 *   sceneIntent:      { text: string; uploadedUrl: string | null },
 *   characterDirection: CharacterDirection,
 *   activeStyleMood:  string | null,
 *   canvasTransform:  { x: number; y: number; scale: number },
 *   savedAt:          ISO timestamp,
 * }
 *
 * Ownership: direction.user_id must match authenticated user.
 * No credits consumed. No generation triggered.
 */

import { NextResponse } from "next/server";
import { getAuthUser }  from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────

/** Verify the direction belongs to the current user. Returns the direction row or null. */
async function getOwnedDirection(directionId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("creative_directions")
    .select("id, user_id, canvas_state")
    .eq("id", directionId)
    .single();

  if (error || !data) return null;
  if (data.user_id !== userId) return null;
  return data as { id: string; user_id: string; canvas_state: unknown };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — restore canvas state on mount
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const direction = await getOwnedDirection(id, user.id);
  if (!direction) {
    return NextResponse.json({ error: "Direction not found" }, { status: 404 });
  }

  // canvas_state may be null if never saved (new session)
  return NextResponse.json({
    canvas_state: direction.canvas_state ?? null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — autosave canvas state
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { canvas_state } = body as Record<string, unknown>;
  if (!canvas_state || typeof canvas_state !== "object") {
    return NextResponse.json({ error: "canvas_state is required" }, { status: 400 });
  }

  // Basic version guard — only accept v1 shape
  const state = canvas_state as Record<string, unknown>;
  if (state.version !== 1) {
    return NextResponse.json({ error: "Unsupported canvas_state version" }, { status: 400 });
  }

  const { id } = await params;
  const direction = await getOwnedDirection(id, user.id);
  if (!direction) {
    return NextResponse.json({ error: "Direction not found" }, { status: 404 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("creative_directions")
    .update({
      canvas_state,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[canvas PATCH] DB update failed:", updateErr.message);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
