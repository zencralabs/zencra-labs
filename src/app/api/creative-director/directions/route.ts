/**
 * POST /api/creative-director/directions
 *
 * Create a new creative direction.
 * A direction is what the user commits to after orienting from a concept.
 *
 * Scope: Image Studio / Creative Director only. Still images.
 *
 * Body:
 *   projectId  string   optional — if provided, direction is linked to the project
 *   sessionId  string   optional
 *   conceptId  string   optional — link to an AI concept card
 *   name       string   optional — label e.g. "Neon Night Scene"
 *   is_locked  boolean  optional — whether direction is in locked mode
 */

import { NextResponse }     from "next/server";
import { getAuthUser }      from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import type { CreativeDirectionRow } from "@/lib/creative-director/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    projectId,
    sessionId,
    conceptId,
    name,
    is_locked,
  } = body as Record<string, string | boolean | undefined>;

  // ── Optionally verify project belongs to user ─────────────────────────────
  // projectId is optional — CDv2 canvas creates "free" directions without a project.
  let resolvedProjectId: string | null = null;
  if (projectId && typeof projectId === "string") {
    const { data: project, error: projErr } = await supabaseAdmin
      .from("creative_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    resolvedProjectId = projectId;
  }

  // ── Create direction ──────────────────────────────────────────────────────
  const { data: direction, error } = await supabaseAdmin
    .from("creative_directions")
    .insert({
      user_id:    user.id,
      project_id: resolvedProjectId,
      session_id: typeof sessionId === "string" ? sessionId : null,
      concept_id: typeof conceptId === "string" ? conceptId : null,
      name:       typeof name === "string" && name.trim() ? name.trim() : null,
      is_locked:  is_locked === true,
    })
    .select()
    .single();

  if (error) {
    console.error("[directions POST] insert failed:", error);
    return NextResponse.json({ error: "Failed to create direction" }, { status: 500 });
  }

  return NextResponse.json({ direction: direction as CreativeDirectionRow }, { status: 201 });
}
