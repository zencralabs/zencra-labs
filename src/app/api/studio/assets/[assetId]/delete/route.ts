/**
 * POST /api/studio/assets/[assetId]/delete
 *
 * Soft-deletes an asset by setting its status to "deleted".
 * Used by the Image Studio to dismiss failed generation cards.
 *
 * Only the asset owner may delete their own assets.
 *
 * Response:
 *   200 { success: true }
 *
 * Errors:
 *   401 UNAUTHORIZED
 *   403 NOT_OWNER
 *   404 ASSET_NOT_FOUND
 */

import type { NextRequest }    from "next/server";
import { requireAuthUser }     from "@/lib/supabase/server";
import { supabaseAdmin }       from "@/lib/supabase/admin";
import { ok, unauthorized, jobNotFound, notOwner, serverErr }
                               from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
): Promise<Response> {
  const { assetId } = await params;

  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? unauthorized();
  const userId = user!.id;

  // ── Look up asset and verify ownership ──────────────────────────────────────
  const { data: asset, error: fetchErr } = await supabaseAdmin
    .from("assets")
    .select("id, user_id, status")
    .eq("id", assetId)
    .single();

  if (fetchErr || !asset) return jobNotFound(assetId);
  if (asset.user_id !== userId) return notOwner();

  // ── Soft delete ─────────────────────────────────────────────────────────────
  const { error: updateErr } = await supabaseAdmin
    .from("assets")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", assetId);

  if (updateErr) {
    console.error("[DELETE asset]", updateErr.message);
    return serverErr("Failed to delete asset");
  }

  return ok({ deleted: assetId });
}
