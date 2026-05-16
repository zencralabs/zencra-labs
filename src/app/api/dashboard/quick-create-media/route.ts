/**
 * GET /api/dashboard/quick-create-media
 *
 * Returns the latest media cover URL for each Quick Create card on the dashboard.
 * One authenticated request replaces up to 8 separate client-side queries.
 *
 * ─── Card sources ─────────────────────────────────────────────────────────────
 *
 *   image    → assets WHERE studio='image' AND model_key != 'reference-stack-render' AND status='ready'
 *   cd       → assets WHERE studio='image' AND model_key = 'reference-stack-render' AND status='ready'
 *   video    → assets WHERE studio='video' AND status='ready'
 *   fcs      → assets WHERE studio='fcs'   AND status='ready'
 *   lipsync  → assets WHERE studio='lipsync' AND status='ready'
 *   audio    → always null (mp3 URL is not a visual; client renders animated equalizer)
 *   projects → projects WHERE cover_url IS NOT NULL, latest updated
 *   library  → assets WHERE status='ready' AND url IS NOT NULL, any studio, latest
 *
 * ─── Response ────────────────────────────────────────────────────────────────
 *
 *   200 { success: true, data: QuickCreateMedia }
 *   401 UNAUTHORIZED
 *
 * ─── Fail-safe ───────────────────────────────────────────────────────────────
 *
 *   All queries run in parallel via Promise.allSettled.
 *   Individual query failures return null for that card — the client falls back
 *   to a premium gradient placeholder. The endpoint never throws.
 *
 * ─── Performance ─────────────────────────────────────────────────────────────
 *
 *   All queries are indexed on (user_id, studio, status, created_at).
 *   Each query fetches only the `url` or `cover_url` field of 1 row.
 *   Total round-trips: 1 request → up to 7 parallel DB reads.
 */

import type { NextRequest } from "next/server";
import { requireAuthUser }  from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { ok, unauthorized } from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Response type
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickCreateMedia {
  image:    { url: string | null };
  cd:       { url: string | null };
  video:    { url: string | null };
  fcs:      { url: string | null };
  lipsync:  { url: string | null };
  audio:    null;
  projects: { cover_url: string | null };
  library:  { url: string | null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Safely extracts `url` from a settled Supabase single-row result. */
function safeUrl(res: PromiseSettledResult<unknown>): string | null {
  if (res.status !== "fulfilled") return null;
  const value = res.value as { data?: { url?: string | null } | null } | null;
  return value?.data?.url ?? null;
}

/** Safely extracts `cover_url` from a settled Supabase single-row result. */
function safeCoverUrl(res: PromiseSettledResult<unknown>): string | null {
  if (res.status !== "fulfilled") return null;
  const value = res.value as { data?: { cover_url?: string | null } | null } | null;
  return value?.data?.cover_url ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? unauthorized();
  const userId = user!.id;

  // ── Run all queries in parallel ──────────────────────────────────────────────
  const [imageRes, cdRes, videoRes, fcsRes, lipSyncRes, projectRes, libraryRes] =
    await Promise.allSettled([

      // 1. Image Studio — latest image asset, excluding Creative Director outputs
      supabaseAdmin
        .from("assets")
        .select("url")
        .eq("user_id", userId)
        .eq("studio", "image")
        .eq("status", "ready")
        .neq("model_key", "reference-stack-render")
        .not("url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),

      // 2. Creative Director — latest reference-stack-render image
      supabaseAdmin
        .from("assets")
        .select("url")
        .eq("user_id", userId)
        .eq("studio", "image")
        .eq("status", "ready")
        .eq("model_key", "reference-stack-render")
        .not("url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),

      // 3. Video Studio — latest video asset
      supabaseAdmin
        .from("assets")
        .select("url")
        .eq("user_id", userId)
        .eq("studio", "video")
        .eq("status", "ready")
        .not("url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),

      // 4. Future Cinema Studio — latest FCS asset
      supabaseAdmin
        .from("assets")
        .select("url")
        .eq("user_id", userId)
        .eq("studio", "fcs")
        .eq("status", "ready")
        .not("url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),

      // 5. LipSyncZ — latest dedicated lipsync asset (assets table, studio='lipsync')
      //    This is the Sync Labs v3 / fal-ai pipeline — NOT Kling Lip Sync.
      supabaseAdmin
        .from("assets")
        .select("url")
        .eq("user_id", userId)
        .eq("studio", "lipsync")
        .eq("status", "ready")
        .not("url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),

      // 6. My Projects — latest project with a cover image set
      supabaseAdmin
        .from("projects")
        .select("cover_url")
        .eq("user_id", userId)
        .not("cover_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single(),

      // 7. Library — latest ready asset across all studios (broadest possible preview)
      supabaseAdmin
        .from("assets")
        .select("url")
        .eq("user_id", userId)
        .eq("status", "ready")
        .not("url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

  // ── Build response — fail-safe: individual nulls, never a thrown error ────────
  const media: QuickCreateMedia = {
    image:    { url: safeUrl(imageRes)        },
    cd:       { url: safeUrl(cdRes)           },
    video:    { url: safeUrl(videoRes)        },
    fcs:      { url: safeUrl(fcsRes)          },
    lipsync:  { url: safeUrl(lipSyncRes)      },
    audio:    null,                             // no visual — client renders animated equalizer
    projects: { cover_url: safeCoverUrl(projectRes) },
    library:  { url: safeUrl(libraryRes)      },
  };

  return ok(media);
}
