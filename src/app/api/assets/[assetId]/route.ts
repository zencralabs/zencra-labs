/**
 * GET    /api/assets/[assetId]  — fetch single asset (ownership verified)
 * PATCH  /api/assets/[assetId]  — update visibility and/or project_id
 * DELETE /api/assets/[assetId]  — hard-delete asset (ownership verified)
 *
 * PATCH body:
 *   { visibility?: "private" | "public" | "project", project_id?: string | null }
 *
 *   Setting visibility="project" requires project_id to be provided.
 *   Setting visibility="private" or "public" clears project_id (unless project_id is also supplied).
 *
 * DELETE:
 *   Permanently removes the asset row. Storage cleanup is deferred.
 *   Returns 200 { success: true } on success.
 */

import { NextResponse }   from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }  from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

// ── Ownership guard ──────────────────────────────────────────────────────────

async function assertOwner(assetId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("assets")
    .select("id, user_id, visibility, project_id")
    .eq("id", assetId)
    .single();

  if (error || !data) return { asset: null, ownerError: "not_found" as const };
  if (data.user_id !== userId) return { asset: null, ownerError: "forbidden" as const };
  return { asset: data, ownerError: null };
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request, { params }: RouteContext): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { assetId } = await params;
  const { asset, ownerError } = await assertOwner(assetId, user.id);

  if (ownerError === "not_found") {
    return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
  }
  if (ownerError === "forbidden") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: full, error } = await supabaseAdmin
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .single();

  if (error || !full) {
    return NextResponse.json({ success: false, error: "Failed to fetch asset" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: full });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: Request, { params }: RouteContext): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { assetId } = await params;
  const { ownerError } = await assertOwner(assetId, user.id);

  if (ownerError === "not_found") {
    return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
  }
  if (ownerError === "forbidden") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: { visibility?: string; project_id?: string | null };
  try {
    body = await req.json() as { visibility?: string; project_id?: string | null };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const VALID_VISIBILITY = new Set(["private", "public", "project"]);
  const update: Record<string, unknown> = {};

  if (body.visibility !== undefined) {
    if (!VALID_VISIBILITY.has(body.visibility)) {
      return NextResponse.json(
        { success: false, error: `Invalid visibility: "${body.visibility}". Must be private, public, or project.` },
        { status: 400 }
      );
    }
    update.visibility = body.visibility;
  }

  if ("project_id" in body) {
    update.project_id = body.project_id ?? null;
  }

  // Convenience: setting visibility=project without a project_id is invalid
  if (update.visibility === "project" && !update.project_id && !("project_id" in body)) {
    return NextResponse.json(
      { success: false, error: "visibility=project requires a project_id" },
      { status: 400 }
    );
  }

  // Verify the target project belongs to this user (if provided)
  if (update.project_id) {
    const { data: proj } = await supabaseAdmin
      .from("projects")
      .select("id, user_id")
      .eq("id", update.project_id as string)
      .single();

    if (!proj || proj.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found or not owned by you" }, { status: 404 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("assets")
    .update(update)
    .eq("id", assetId)
    .select("id, visibility, project_id, updated_at")
    .single();

  if (updateError) {
    console.error("[PATCH /api/assets/[assetId]]", updateError.message);
    return NextResponse.json({ success: false, error: "Failed to update asset" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: updated });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: Request, { params }: RouteContext): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { assetId } = await params;
  const { ownerError } = await assertOwner(assetId, user.id);

  if (ownerError === "not_found") {
    return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });
  }
  if (ownerError === "forbidden") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("assets")
    .delete()
    .eq("id", assetId);

  if (error) {
    console.error("[DELETE /api/assets/[assetId]]", error.message);
    return NextResponse.json({ success: false, error: "Failed to delete asset" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
