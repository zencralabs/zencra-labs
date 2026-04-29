/**
 * GET /api/studio/influencer/readiness?handles=amanda,nova
 *
 * Lightweight canonical readiness check for the Video Studio Start Frame Identity card
 * and the @handle badge avatar in both Image Studio and Video Studio.
 *
 * Returns a map of { [handle]: { ready: boolean; avatarUrl: string | null } } where:
 *   - ready: true if both identity_lock_id and hero_asset_id are set
 *   - avatarUrl: public URL of the hero asset (via influencer_assets join), or null
 *
 * Used by VideoStudioShell and Image Studio page to:
 *   - Surface a pre-generate disabled state when canonical is missing
 *   - Render the influencer's avatar in @handle badges and the Start Frame card
 */

import { NextResponse }   from "next/server";
import { getAuthUser }    from "@/lib/supabase/server";
import { supabaseAdmin }  from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    // Parse ?handles=amanda,nova
    const url     = new URL(req.url);
    const raw     = url.searchParams.get("handles") ?? "";
    const handles = raw.split(",").map(h => h.trim().toLowerCase()).filter(Boolean);

    if (handles.length === 0) {
      return NextResponse.json({});
    }

    // Join influencer_assets via hero_asset_id to get the avatar URL in one query
    const { data, error } = await supabaseAdmin
      .from("ai_influencers")
      .select("handle, identity_lock_id, hero_asset_id, influencer_assets!hero_asset_id(url)")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("handle", handles);

    if (error || !data) {
      // On DB error return all handles as not ready (conservative)
      const fallback: Record<string, { ready: boolean; avatarUrl: string | null }> = {};
      handles.forEach(h => { fallback[h] = { ready: false, avatarUrl: null }; });
      return NextResponse.json(fallback);
    }

    // Build result — a handle is ready iff both identity_lock_id and hero_asset_id are set
    const result: Record<string, { ready: boolean; avatarUrl: string | null }> = {};
    handles.forEach(h => {
      const row = data.find(r => r.handle === h);
      const ready = !!(row?.identity_lock_id && row?.hero_asset_id);
      // influencer_assets join returns an object (one-to-one via FK) or null
      const assetRow = row?.influencer_assets as { url: string } | null | undefined;
      const avatarUrl = assetRow?.url ?? null;
      result[h] = { ready, avatarUrl };
    });

    return NextResponse.json(result);

  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
