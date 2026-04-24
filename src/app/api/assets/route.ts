/**
 * GET /api/assets
 *
 * Returns the authenticated user's generated assets with filtering and cursor pagination.
 * Used by the Dashboard Generated Library page.
 *
 * Query params:
 *   studio      string    — filter by studio (image|video|audio|character)
 *   model_key   string    — filter by model key
 *   project_id  string    — filter by project ("none" = unlinked assets)
 *   visibility  string    — filter by visibility (private|public|project)
 *   is_favorite boolean   — "true" to show favorites only
 *   cursor      string    — ISO timestamp for cursor pagination (created_at < cursor)
 *   limit       number    — page size (default 40, max 100)
 *
 * Response:
 *   { success: true, data: Asset[], nextCursor: string | null, total: number }
 *
 * Ownership: only returns assets owned by the authenticated user.
 */

import { NextResponse }   from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }  from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_SELECT = `
  id,
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

const DEFAULT_LIMIT = 40;
const MAX_LIMIT     = 100;

export async function GET(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const url    = new URL(req.url);
  const params = url.searchParams;

  // Parse filter params
  const studio     = params.get("studio")     ?? undefined;
  const model_key  = params.get("model_key")  ?? undefined;
  const project_id = params.get("project_id") ?? undefined; // "none" = unlinked
  const visibility = params.get("visibility") ?? undefined;
  const isFavStr   = params.get("is_favorite");
  const is_favorite = isFavStr === "true" ? true : isFavStr === "false" ? false : undefined;
  const cursor     = params.get("cursor")     ?? undefined;
  const limitRaw   = parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit      = Math.min(isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw, MAX_LIMIT);

  // ── Build query ──────────────────────────────────────────────────────────────
  let query = supabaseAdmin
    .from("assets")
    .select(ASSET_SELECT)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit + 1); // fetch one extra to determine if there's a next page

  if (studio)        query = query.eq("studio", studio);
  if (model_key)     query = query.eq("model_key", model_key);
  if (visibility)    query = query.eq("visibility", visibility);
  if (is_favorite !== undefined) query = query.eq("is_favorite", is_favorite);

  // Project filter: "none" = no project, otherwise filter by project_id
  if (project_id === "none") {
    query = query.is("project_id", null);
  } else if (project_id) {
    query = query.eq("project_id", project_id);
  }

  // Cursor pagination: get assets older than cursor timestamp
  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/assets]", error.message);
    return NextResponse.json({ success: false, error: "Failed to load assets" }, { status: 500 });
  }

  const assets     = data ?? [];
  const hasMore    = assets.length > limit;
  const page       = hasMore ? assets.slice(0, limit) : assets;
  const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;

  // ── Get total count (without cursor — full matching set) ────────────────────
  let countQuery = supabaseAdmin
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed");

  if (studio)       countQuery = countQuery.eq("studio", studio);
  if (model_key)    countQuery = countQuery.eq("model_key", model_key);
  if (visibility)   countQuery = countQuery.eq("visibility", visibility);
  if (is_favorite !== undefined) countQuery = countQuery.eq("is_favorite", is_favorite);

  if (project_id === "none") {
    countQuery = countQuery.is("project_id", null);
  } else if (project_id) {
    countQuery = countQuery.eq("project_id", project_id);
  }

  const { count } = await countQuery;

  return NextResponse.json({
    success:    true,
    data:       page,
    nextCursor,
    hasMore,
    total: count ?? 0,
  });
}
