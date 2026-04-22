/**
 * POST /api/creative-director/projects/[projectId]/fork
 *
 * Fork a project: duplicates project + brief + selected concept.
 * Generations are NOT copied — the fork starts fresh.
 * Body: { title?: string }
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateForkProject } from "@/lib/creative-director/schemas";
import { forkProject } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  // Verify source project ownership
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id, title")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const validation = validateForkProject(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { title } = validation.data;

  try {
    const forkedProject = await forkProject(projectId, user.id, title);

    // Log activity on the SOURCE project (fire-and-forget)
    void logActivity(projectId, user.id, "project_forked", {
      forked_project_id: forkedProject.id,
      new_title: forkedProject.title,
    });

    return NextResponse.json({ project: forkedProject }, { status: 201 });
  } catch (err) {
    console.error(`[fork/route] Fork failed for project ${projectId}:`, err);
    return NextResponse.json({ error: "Fork failed" }, { status: 500 });
  }
}
