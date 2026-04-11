/**
 * GET    /api/projects/[id]  — get single project (with recent assets)
 * PUT    /api/projects/[id]  — rename / update description
 * DELETE /api/projects/[id]  — delete project (assets become visibility=private)
 */

import { NextResponse }       from "next/server";
import { supabaseAdmin }      from "@/lib/supabase/admin";
import { requireAuthUser }    from "@/lib/supabase/server";
import type { ProjectUpdate } from "@/lib/types/generation";

export const dynamic = "force-dynamic";

// ── Ownership guard ───────────────────────────────────────────────────────────

async function assertOwner(projectId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (error || !data) return { project: null, ownerError: "not_found" as const };
  if (data.user_id !== userId) return { project: null, ownerError: "forbidden" as const };
  return { project: data, ownerError: null };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;
  const { project, ownerError } = await assertOwner(id, user.id);

  if (ownerError === "not_found") {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  if (ownerError === "forbidden") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  // Fetch full project + recent assets
  const [projectRes, assetsRes] = await Promise.all([
    supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", id)
      .single(),

    supabaseAdmin
      .from("generations")
      .select("id, tool, tool_category, prompt, result_url, result_urls, visibility, created_at, credits_used")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (projectRes.error) {
    return NextResponse.json({ success: false, error: "Failed to fetch project" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      project: projectRes.data,
      assets:  assetsRes.data ?? [],
    },
  });
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;
  const { ownerError } = await assertOwner(id, user.id);
  if (ownerError === "not_found") {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  if (ownerError === "forbidden") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: Partial<ProjectUpdate>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 80) {
      return NextResponse.json(
        { success: false, error: "Name must be 1–80 characters" },
        { status: 400 }
      );
    }
    update.name = name;
  }

  if (body.description !== undefined) {
    update.description = body.description?.trim() ?? null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[PUT /api/projects/[id]]", error);
    return NextResponse.json({ success: false, error: "Failed to update project" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;
  const { ownerError } = await assertOwner(id, user.id);
  if (ownerError === "not_found") {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  if (ownerError === "forbidden") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  // Orphan assets → make them private (not deleted)
  await supabaseAdmin
    .from("generations")
    .update({ project_id: null, visibility: "private" })
    .eq("project_id", id)
    .eq("user_id", user.id);

  const { error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[DELETE /api/projects/[id]]", error);
    return NextResponse.json({ success: false, error: "Failed to delete project" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
