/**
 * GET  /api/creative-director/projects/[projectId]
 * Return full project chain: project + brief + concepts + generations.
 *
 * PATCH /api/creative-director/projects/[projectId]
 * Update project title, status, or cover_asset_id.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { validateUpdateProject } from "@/lib/creative-director/schemas";
import { getProjectChain, updateProject } from "@/lib/creative-director/save-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — Full project chain
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const chain = await getProjectChain(projectId, user.id);

    if (!chain) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(chain);
  } catch (err) {
    console.error(`[GET /api/creative-director/projects/${projectId}]`, err);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — Update project fields
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateUpdateProject(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Verify ownership before update
  const chain = await getProjectChain(projectId, user.id);
  if (!chain) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    await updateProject(projectId, validation.data);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[PATCH /api/creative-director/projects/${projectId}]`, err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
