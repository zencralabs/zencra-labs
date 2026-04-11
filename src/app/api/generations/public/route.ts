/**
 * GET /api/generations/public
 *
 * Returns paginated public generations for the Gallery and Homepage carousel.
 * No auth required — public assets are visible to all (including anon).
 *
 * Query params:
 *   page        number  (default 1)
 *   pageSize    number  (default 20, max 50)
 *   category    "image" | "video" | "audio" | "character" | "enhance"
 *   tool        string  (catalog tool id, e.g. "kling-30")
 *   sort        "latest" | "trending"  (default "latest")
 */

import { NextResponse }     from "next/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import type { PublicAsset } from "@/lib/types/generation";

export const dynamic = "force-dynamic";

const MAX_PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10))
    );
    const category = searchParams.get("category") ?? null;
    const tool     = searchParams.get("tool")     ?? null;
    const sort     = searchParams.get("sort")     ?? "latest";

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // ── Build query ─────────────────────────────────────────────────────────
    let query = supabaseAdmin
      .from("generations")
      .select(
        `id, tool, tool_category, prompt, result_url, result_urls,
         visibility, project_id, credits_used, created_at`,
        { count: "exact" }
      )
      .eq("visibility", "public")
      .eq("status", "completed")
      .not("result_url", "is", null);

    if (category) query = query.eq("tool_category", category);
    if (tool)     query = query.eq("tool", tool);

    // Sorting
    if (sort === "trending") {
      // Trending: recent 7-day window, most credits spent first (proxy for quality/engagement)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query
        .gte("created_at", weekAgo)
        .order("credits_used", { ascending: false })
        .order("created_at",   { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/generations/public]", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch gallery" },
        { status: 500 }
      );
    }

    const total   = count ?? 0;
    const hasMore = from + pageSize < total;

    return NextResponse.json({
      success: true,
      data:     (data ?? []) as PublicAsset[],
      total,
      page,
      pageSize,
      hasMore,
    });
  } catch (err) {
    console.error("[GET /api/generations/public] unexpected:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
