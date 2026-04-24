/**
 * POST /api/projects/ensure-session
 *
 * Atomic helper: creates a project + session in a single round-trip.
 * If either insert fails the entire operation fails (no orphaned records).
 *
 * Body: { name, description?, sessionType?, sessionName? }
 * Returns: { project: { id, name }, session: { id, type, status } }
 *
 * Used by CreativeDirectorShell to ensure both records exist before
 * stamping session_id on concepts and generations.
 */

import { NextResponse }    from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }   from "@/lib/supabase/admin";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    name?:        string;
    description?: string;
    sessionType?: string;
    sessionName?: string;
  };

  const name = b.name?.trim();
  if (!name || name.length === 0) {
    return NextResponse.json(
      { success: false, error: "Project name is required" },
      { status: 400 }
    );
  }
  if (name.length > 80) {
    return NextResponse.json(
      { success: false, error: "Project name must be ≤ 80 characters" },
      { status: 400 }
    );
  }

  const sessionType =
    b.sessionType === "image" ? "image" : "creative-director";
  const sessionName = b.sessionName?.trim() || name;

  // ── Step 1: Create project ─────────────────────────────────────────────────
  const { data: project, error: projectErr } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id:     user.id,
      name,
      description: b.description?.trim() ?? null,
    })
    .select("id, name, created_at")
    .single();

  if (projectErr || !project) {
    console.error("[ensure-session] project insert error:", projectErr?.message);
    return NextResponse.json(
      { success: false, error: "Failed to create project" },
      { status: 500 }
    );
  }

  // ── Step 2: Create session linked to that project ─────────────────────────
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("project_sessions")
    .insert({
      project_id: project.id,
      type:       sessionType,
      name:       sessionName,
      status:     "draft",
    })
    .select("id, type, status, created_at")
    .single();

  if (sessionErr || !session) {
    console.error("[ensure-session] session insert error:", sessionErr?.message);
    // Project was created — attempt cleanup so we don't leave orphans
    await supabaseAdmin.from("projects").delete().eq("id", project.id);
    return NextResponse.json(
      { success: false, error: "Failed to create session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, project, session }, { status: 201 });
}
