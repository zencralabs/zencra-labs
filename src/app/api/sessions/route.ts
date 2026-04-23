/**
 * POST /api/sessions — create a new project session
 *
 * Body: { project_id, type?, name? }
 * Returns: { session }
 */

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { project_id?: string; type?: string; name?: string };

  if (!b.project_id) {
    return NextResponse.json({ success: false, error: "project_id is required" }, { status: 400 });
  }

  // Verify user owns the project
  const { data: project, error: projectErr } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", b.project_id)
    .single();

  if (projectErr || !project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== user.id) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const type = b.type === "image" ? "image" : "creative-director";
  const name = b.name?.trim() || null;

  const { data: session, error } = await supabaseAdmin
    .from("project_sessions")
    .insert({
      project_id: b.project_id,
      type,
      name,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    console.error("[sessions/POST] DB error:", error);
    return NextResponse.json({ success: false, error: "Failed to create session" }, { status: 500 });
  }

  // Bump project updated_at so it surfaces in recent projects
  await supabaseAdmin
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", b.project_id);

  return NextResponse.json({ success: true, session }, { status: 201 });
}
