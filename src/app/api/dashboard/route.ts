/**
 * GET /api/dashboard
 * Returns aggregated data for the project dashboard.
 *
 * Response:
 * {
 *   projects:            Project[]        — all user projects, newest first
 *   recent_generations:  Asset[]          — 20 most recent completed assets
 *   favorites:           Asset[]          — all is_favorite=true assets
 *   sessions:            ProjectSession[] — recent sessions (last 10)
 *   stats: {
 *     total_projects:    number
 *     total_outputs:     number
 *     total_favorites:   number
 *   }
 * }
 */

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_SELECT = `
  id,
  user_id,
  studio,
  provider,
  model_key,
  status,
  url,
  prompt,
  aspect_ratio,
  credits_cost,
  is_favorite,
  visibility,
  project_id,
  session_id,
  concept_id,
  created_at,
  completed_at
` as const;

export async function GET(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const [projectsRes, recentRes, favoritesRes, sessionsRes, countRes] = await Promise.all([
    // All projects, newest first
    supabaseAdmin
      .from("projects")
      .select("id, name, description, cover_url, cover_asset_id, visibility, asset_count, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),

    // 20 most recent completed assets
    supabaseAdmin
      .from("assets")
      .select(ASSET_SELECT)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20),

    // All favorites
    supabaseAdmin
      .from("assets")
      .select(ASSET_SELECT)
      .eq("user_id", user.id)
      .eq("is_favorite", true)
      .order("created_at", { ascending: false })
      .limit(50),

    // 10 most recent sessions (with project name via join)
    supabaseAdmin
      .from("project_sessions")
      .select(`
        id,
        project_id,
        name,
        type,
        status,
        selected_concept_id,
        created_at,
        updated_at,
        projects!inner(id, name, user_id)
      `)
      .eq("projects.user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10),

    // Total outputs count
    supabaseAdmin
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
  ]);

  const projects   = projectsRes.data   ?? [];
  const recent     = recentRes.data     ?? [];
  const favorites  = favoritesRes.data  ?? [];
  const sessions   = sessionsRes.data   ?? [];
  const totalOutputs = countRes.count ?? 0;

  return NextResponse.json({
    success: true,
    data: {
      projects,
      recent_generations: recent,
      favorites,
      sessions,
      stats: {
        total_projects:  projects.length,
        total_outputs:   totalOutputs,
        total_favorites: favorites.length,
      },
    },
  });
}
