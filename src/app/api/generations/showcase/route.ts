/**
 * GET /api/generations/showcase
 *
 * Returns up to 10 randomly-selected videos from the top 20 trending
 * public generations made by paid members (plan != 'free').
 *
 * Falls back to any public video if no paid-member results exist.
 * No auth required — public endpoint.
 */

import { NextResponse }  from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Shuffle array in-place (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET() {
  try {
    // ── Primary: paid members, last 30 days, ordered by credits_used ─────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: paidData } = await supabaseAdmin
      .from("generations")
      .select(
        `id, tool, tool_category, prompt, result_url, result_urls,
         credits_used, created_at,
         profiles!inner ( plan )`
      )
      .eq("visibility",    "public")
      .eq("status",        "completed")
      .eq("tool_category", "video")
      .not("result_url", "is", null)
      .neq("profiles.plan", "free")
      .gte("created_at", thirtyDaysAgo)
      .order("credits_used", { ascending: false })
      .order("created_at",   { ascending: false })
      .limit(20);

    if (paidData && paidData.length > 0) {
      // Strip the joined profiles field before returning
      const clean = paidData.map(({ profiles: _p, ...rest }) => rest);
      return NextResponse.json({
        success: true,
        data:    shuffle(clean).slice(0, 10),
        source:  "paid_members",
      });
    }

    // ── Fallback 1: any paid member video, no time limit ─────────────────────
    const { data: paidAny } = await supabaseAdmin
      .from("generations")
      .select(
        `id, tool, tool_category, prompt, result_url, result_urls,
         credits_used, created_at,
         profiles!inner ( plan )`
      )
      .eq("visibility",    "public")
      .eq("status",        "completed")
      .eq("tool_category", "video")
      .not("result_url", "is", null)
      .neq("profiles.plan", "free")
      .order("credits_used", { ascending: false })
      .limit(20);

    if (paidAny && paidAny.length > 0) {
      const clean = paidAny.map(({ profiles: _p, ...rest }) => rest);
      return NextResponse.json({
        success: true,
        data:    shuffle(clean).slice(0, 10),
        source:  "paid_members_all_time",
      });
    }

    // ── Fallback 2: any public video (platform still new) ────────────────────
    const { data: anyPublic } = await supabaseAdmin
      .from("generations")
      .select(
        `id, tool, tool_category, prompt, result_url, result_urls,
         credits_used, created_at`
      )
      .eq("visibility",    "public")
      .eq("status",        "completed")
      .eq("tool_category", "video")
      .not("result_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      data:    shuffle(anyPublic ?? []).slice(0, 10),
      source:  "all_public",
    });

  } catch (err) {
    console.error("[GET /api/generations/showcase] unexpected:", err);
    return NextResponse.json({ success: false, data: [], source: "error" });
  }
}
