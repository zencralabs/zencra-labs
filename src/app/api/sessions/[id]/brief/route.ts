/**
 * POST /api/sessions/[id]/brief
 * Save brief JSON to a session and update status → 'draft' (already draft, but explicit).
 *
 * Body: { brief_json, parsed_brief_json? }
 */

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertSessionOwner(sessionId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("project_sessions")
    .select("id, project_id, projects!inner(user_id)")
    .eq("id", sessionId)
    .single();

  if (error || !data) return { session: null, err: "not_found" as const };
  const proj = data.projects as unknown as { user_id: string };
  if (proj.user_id !== userId) return { session: null, err: "forbidden" as const };
  return { session: data, err: null };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;
  const { session, err } = await assertSessionOwner(id, user.id);
  if (err === "not_found") return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  if (err === "forbidden")  return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  void session;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { brief_json?: unknown; parsed_brief_json?: unknown };

  const update: Record<string, unknown> = {};
  if (b.brief_json        !== undefined) update.brief_json        = b.brief_json;
  if (b.parsed_brief_json !== undefined) update.parsed_brief_json = b.parsed_brief_json;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: "No brief data provided" }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("project_sessions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[sessions/brief/POST] DB error:", error);
    return NextResponse.json({ success: false, error: "Failed to save brief" }, { status: 500 });
  }

  return NextResponse.json({ success: true, session: updated });
}
