// GET /api/lipsync/mine
// Returns the authenticated user's lip sync generation history,
// ordered newest-first. Includes pagination support via ?limit & ?offset.

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }   from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const url    = new URL(req.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "20", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0",  10);

  const { data, error, count } = await supabaseAdmin
    .from("generations")
    .select("id, status, provider, quality_mode, duration_seconds, aspect_ratio, output_url, thumbnail_url, credits_used, parameters, created_at, completed_at", { count: "exact" })
    .eq("user_id", user.id)
    .eq("tool_category", "lipsync")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Shape each row for the frontend
  const generations = (data ?? []).map(g => ({
    id:              g.id,
    status:          g.status,
    // User-facing quality label — never show internal provider key
    qualityLabel:    g.quality_mode === "pro" ? "Pro" : "Standard",
    qualityMode:     g.quality_mode as "standard" | "pro" ?? "standard",
    durationSeconds: g.duration_seconds,
    aspectRatio:     g.aspect_ratio,
    outputUrl:       g.output_url ?? null,
    thumbnailUrl:    g.thumbnail_url ?? null,
    creditsUsed:     g.credits_used,
    failureReason:   g.parameters?.failure_reason ?? null,
    createdAt:       g.created_at,
    completedAt:     g.completed_at ?? null,
  }));

  return NextResponse.json({
    success:     true,
    generations,
    total:       count ?? 0,
    limit,
    offset,
  });
}
