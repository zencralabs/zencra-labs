/**
 * GET /api/generations/mine
 *
 * Returns the authenticated user's own generations, newest first.
 * Used by the studio pages to populate the History panel on load.
 *
 * Query params:
 *   category    "image" | "video" | "audio"   (required — filters by tool_category)
 *   page        number  (default 1)
 *   pageSize    number  (default 30, max 100)
 *   status      "completed" | "processing" | "all"  (default "completed")
 */

import { NextResponse }  from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser }   from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEV_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const IS_DEV = process.env.NODE_ENV === "development" || process.env.DEMO_MODE === "true";

export async function GET(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);
    if (!authUser && !IS_DEV) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser?.id ?? DEV_DEMO_USER_ID;

    // ── Params ───────────────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const category  = searchParams.get("category") ?? "image";
    const page      = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
    const pageSize  = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "30", 10)));
    const statusParam = searchParams.get("status") ?? "completed";

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    // ── Query ────────────────────────────────────────────────────────────────
    let query = supabaseAdmin
      .from("generations")
      .select(
        `id, tool, tool_category, prompt, status, result_url, result_urls,
         visibility, project_id, credits_used, parameters, created_at, completed_at`,
        { count: "exact" }
      )
      .eq("user_id",       userId)
      .eq("tool_category", category)
      .not("result_url",   "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    // Filter by status unless caller wants all
    if (statusParam !== "all") {
      query = query.eq("status", statusParam);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/generations/mine]", error.message);
      return NextResponse.json({ success: false, error: "Failed to fetch history" }, { status: 500 });
    }

    return NextResponse.json({
      success:  true,
      data:     data ?? [],
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
