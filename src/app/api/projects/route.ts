/**
 * GET  /api/projects       — list the authenticated user's projects
 * POST /api/projects       — create a new project
 */

import { NextResponse }       from "next/server";
import { supabaseAdmin }      from "@/lib/supabase/admin";
import { requireAuthUser }    from "@/lib/supabase/server";
import type { ProjectInsert } from "@/lib/types/generation";

export const dynamic = "force-dynamic";

// ── GET — list user projects ─────────────────────────────────────────────────

export async function GET(req: Request) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, description, cover_url, asset_count, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[GET /api/projects]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch projects" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

// ── POST — create project ─────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  let body: Partial<ProjectInsert>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const name = body.name?.trim();
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

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id:     user.id,
      name,
      description: body.description?.trim() ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create project" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
