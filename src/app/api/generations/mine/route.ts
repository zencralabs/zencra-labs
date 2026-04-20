/**
 * GET /api/generations/mine
 *
 * Returns the authenticated user's own generations, newest first.
 * Used by the studio pages to populate the History panel on load.
 *
 * Query params:
 *   category    "image" | "video" | "audio"   (required — filters by studio type)
 *   page        number  (default 1)
 *   pageSize    number  (default 30, max 100)
 *
 * NOTE: Queries the `assets` table (new provider system).
 * Column mapping to legacy shape so studio pages don't need updating:
 *   model_key      → tool
 *   studio         → tool_category
 *   url            → result_url
 *   { aspect_ratio } → parameters.aspectRatio
 */

import { NextResponse }  from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser }   from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    // ── Params ───────────────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const category  = searchParams.get("category") ?? "image";
    const page      = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
    const pageSize  = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "30", 10)));

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // ── Query assets table ────────────────────────────────────────────────────
    // Include both "ready" and "failed" so failed cards persist across refreshes.
    // "deleted" and "pending" are excluded — pending are polled live, deleted are gone.
    const { data, error, count } = await supabaseAdmin
      .from("assets")
      .select(
        "id, model_key, studio, prompt, status, url, aspect_ratio, error_message, created_at",
        { count: "exact" }
      )
      .eq("user_id",  userId)
      .eq("studio",   category)
      .in("status",   ["ready", "failed"])
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[GET /api/generations/mine]", error.message);
      return NextResponse.json({ success: false, error: "Failed to fetch history" }, { status: 500 });
    }

    // ── Map to legacy shape expected by studio pages ───────────────────────────
    const mapped = (data ?? []).map((row) => ({
      id:            row.id,
      tool:          row.model_key,
      tool_category: row.studio,
      prompt:        row.prompt ?? "",
      status:        row.status === "failed" ? "failed" : "completed",
      result_url:    row.url ?? null,
      result_urls:   row.url ? [row.url] : null,
      visibility:    "project",
      project_id:    null,
      credits_used:  0,
      parameters:    row.aspect_ratio ? { aspectRatio: row.aspect_ratio } : null,
      error_message: (row as Record<string, unknown>).error_message as string | null ?? null,
      created_at:    row.created_at,
    }));

    return NextResponse.json({
      success:  true,
      data:     mapped,
      total:    count ?? 0,
      page,
      pageSize,
      hasMore:  from + pageSize < (count ?? 0),
    });

  } catch (err) {
    console.error("[GET /api/generations/mine] unexpected:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
