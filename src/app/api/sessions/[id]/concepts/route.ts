/**
 * POST /api/sessions/[id]/concepts
 * Link existing creative_concepts rows to this session and mark session as
 * concepts_generated.
 *
 * Body: { concept_ids: string[] }
 * This does NOT create concepts — the Creative Director already creates them
 * in creative_concepts. This route just stamps session_id onto each one.
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
  void user;

  const { id } = await params;
  const { session, err } = await assertSessionOwner(id, await params.then(p => p.id === id ? id : p.id));
  void session;

  if (err === "not_found") return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  if (err === "forbidden")  return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { concept_ids?: string[] };
  if (!Array.isArray(b.concept_ids) || b.concept_ids.length === 0) {
    return NextResponse.json({ success: false, error: "concept_ids array is required" }, { status: 400 });
  }

  // Stamp session_id on all concepts
  const { error: updateErr } = await supabaseAdmin
    .from("creative_concepts")
    .update({ session_id: id })
    .in("id", b.concept_ids);

  if (updateErr) {
    console.error("[sessions/concepts/POST] DB error:", updateErr);
    return NextResponse.json({ success: false, error: "Failed to link concepts" }, { status: 500 });
  }

  // Advance session status
  await supabaseAdmin
    .from("project_sessions")
    .update({ status: "concepts_generated" })
    .eq("id", id);

  return NextResponse.json({ success: true, linked: b.concept_ids.length });
}
