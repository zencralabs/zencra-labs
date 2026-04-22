/**
 * POST /api/creative-director/concepts/[conceptId]/select
 *
 * Mark a concept as selected for its project.
 * Deselects all other concepts in the same project.
 * Updates creative_projects.selected_concept_id.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { markConceptSelected } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ conceptId: string }>;
}

export async function POST(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conceptId } = await params;

  // Load concept and verify ownership via project
  const { data: concept, error: conceptErr } = await supabaseAdmin
    .from("creative_concepts")
    .select("id, project_id, title")
    .eq("id", conceptId)
    .single();

  if (conceptErr || !concept) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const { project_id: projectId, title } = concept as {
    project_id: string;
    title: string;
  };

  // Verify user owns the parent project
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    await markConceptSelected(conceptId, projectId);

    // Log activity (fire-and-forget)
    void logActivity(projectId, user.id, "concept_selected", {
      concept_id: conceptId,
      concept_title: title,
    });

    return NextResponse.json({ success: true, conceptId, projectId });
  } catch (err) {
    console.error(`[concepts/select] Failed to select concept ${conceptId}:`, err);
    return NextResponse.json({ error: "Failed to select concept" }, { status: 500 });
  }
}
