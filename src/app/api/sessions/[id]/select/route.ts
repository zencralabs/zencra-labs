/**
 * POST /api/sessions/[id]/select
 * Set the selected concept for a session.
 *
 * Body: { concept_id: string | null }
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
  const { err } = await assertSessionOwner(id, user.id);
  if (err === "not_found") return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  if (err === "forbidden")  return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { concept_id?: string | null };
  const conceptId = b.concept_id ?? null;

  const { data: updated, error } = await supabaseAdmin
    .from("project_sessions")
    .update({ selected_concept_id: conceptId })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[sessions/select/POST] DB error:", error);
    return NextResponse.json({ success: false, error: "Failed to save selection" }, { status: 500 });
  }

  return NextResponse.json({ success: true, session: updated });
}
