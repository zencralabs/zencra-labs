/**
 * POST /api/creative-director/projects
 * Create a new creative project + initial brief shell.
 *
 * GET /api/creative-director/projects
 * List the authenticated user's creative projects.
 * Query params: ?limit=20&status=draft
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateCreateProject } from "@/lib/creative-director/schemas";
import { saveProject, saveBrief } from "@/lib/creative-director/save-history";
import { logActivity } from "@/lib/creative-director/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// POST — Create project
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateCreateProject(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { title, projectType, brandName, audience, platform } = validation.data;

  try {
    // Create the project
    const project = await saveProject({
      user_id: user.id,
      title,
      project_type: projectType,
      brand_name: brandName,
      audience,
      platform,
      status: "draft",
    });

    // Create an empty brief shell — parsed_brief_json intentionally omitted;
    // the concepts route sets it after parseBrief() succeeds.
    const brief = await saveBrief({
      project_id: project.id,
      project_type: projectType,
      mood_tags: [],
      reference_assets: [],
      advanced_settings: {},
    });

    // Log project creation (fire-and-forget)
    void logActivity(project.id, user.id, "project_created", {
      title,
      project_type: projectType,
    });

    return NextResponse.json({ project, brief }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/creative-director/projects]", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — List projects
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const status = searchParams.get("status");

  try {
    let query = supabaseAdmin
      .from("creative_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("last_activity_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: projects, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ projects: projects ?? [] });
  } catch (err) {
    console.error("[GET /api/creative-director/projects]", err);
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}
