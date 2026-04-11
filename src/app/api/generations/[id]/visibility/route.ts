/**
 * PATCH /api/generations/[id]/visibility
 *
 * Updates the visibility and/or project_id of an owned generation.
 * Requires authentication — owner only.
 *
 * Body: { visibility: "project" | "private" | "public", project_id?: string | null }
 */

import { NextResponse }              from "next/server";
import { supabaseAdmin }             from "@/lib/supabase/admin";
import { requireAuthUser }           from "@/lib/supabase/server";
import type { VisibilityUpdatePayload } from "@/lib/types/generation";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id: generationId } = await params;
  if (!generationId) {
    return NextResponse.json(
      { success: false, error: "Generation ID is required" },
      { status: 400 }
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: Partial<VisibilityUpdatePayload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { visibility, project_id } = body;

  if (!visibility || !["project", "private", "public"].includes(visibility)) {
    return NextResponse.json(
      { success: false, error: "visibility must be 'project', 'private', or 'public'" },
      { status: 400 }
    );
  }

  // ── Verify ownership ─────────────────────────────────────────────────────
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, visibility, project_id")
    .eq("id", generationId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { success: false, error: "Generation not found" },
      { status: 404 }
    );
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  // ── Build update payload ─────────────────────────────────────────────────
  const updatePayload: Record<string, unknown> = { visibility };

  // If moving to a project, supply project_id; if making private/public clear it optionally
  if ("project_id" in body) {
    updatePayload.project_id = project_id ?? null;
  }

  // If setting to 'public' or 'private', unset project_id automatically
  if (visibility !== "project" && !("project_id" in body)) {
    updatePayload.project_id = null;
  }

  // ── Validate project ownership if project_id supplied ────────────────────
  if (updatePayload.project_id) {
    const { data: proj } = await supabaseAdmin
      .from("projects")
      .select("id, user_id")
      .eq("id", updatePayload.project_id as string)
      .single();

    if (!proj || proj.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 400 }
      );
    }
  }

  // ── Persist ──────────────────────────────────────────────────────────────
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("generations")
    .update(updatePayload)
    .eq("id", generationId)
    .select("id, visibility, project_id")
    .single();

  if (updateError) {
    console.error("[PATCH visibility]", updateError);
    return NextResponse.json(
      { success: false, error: "Failed to update visibility" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: updated });
}
