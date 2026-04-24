/**
 * GET /api/projects/[id]/overview
 *
 * Returns everything the project detail page needs in one shot:
 *   project        — projects row (full)
 *   sessions       — project_sessions for this project (newest first)
 *   assets         — completed assets WHERE project_id = id (limit 50)
 *   concepts       — creative_concepts stamped with any session under this project
 *   stats          — { total_sessions, total_assets, total_concepts }
 *
 * Ownership verified: only the project owner can call this.
 * Does NOT touch or modify the existing GET /api/projects/[id] route.
 */

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteContext): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { id } = await params;

  // ── Ownership check ────────────────────────────────────────────────────────
  const { data: projectRow, error: projErr } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, name, description, cover_url, cover_asset_id, visibility, asset_count, created_at, updated_at")
    .eq("id", id)
    .single();

  if (projErr || !projectRow) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  if (projectRow.user_id !== user.id) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  // ── Parallel fetch ─────────────────────────────────────────────────────────
  const [sessionsRes, assetsRes] = await Promise.all([
    supabaseAdmin
      .from("project_sessions")
      .select("id, project_id, name, type, status, selected_concept_id, brief_json, created_at, updated_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("assets")
      .select("id, studio, provider, model_key, status, url, prompt, aspect_ratio, credits_cost, is_favorite, visibility, project_id, session_id, concept_id, created_at, completed_at")
      .eq("project_id", id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const sessions = sessionsRes.data ?? [];
  const assets   = assetsRes.data   ?? [];

  // ── Fetch concepts stamped to any session under this project ───────────────
  // Fire a second query only if sessions exist (avoids empty IN clause)
  let concepts: unknown[] = [];
  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id);
    const { data: conceptRows } = await supabaseAdmin
      .from("creative_concepts")
      .select("id, title, summary, rationale, recommended_provider, recommended_use_case, scores, is_selected, session_id, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });
    concepts = conceptRows ?? [];
  }

  return NextResponse.json({
    success: true,
    data: {
      project:  projectRow,
      sessions,
      assets,
      concepts,
      stats: {
        total_sessions:  sessions.length,
        total_assets:    assets.length,
        total_concepts:  concepts.length,
      },
    },
  });
}
