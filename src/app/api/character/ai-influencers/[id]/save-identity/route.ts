/**
 * POST /api/character/ai-influencers/:id/save-identity
 *
 * Finalizes the influencer's status as 'active' in the library.
 * Requires identity lock to already exist.
 */

import { requireAuthUser }  from "@/lib/supabase/server";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { ok, invalidInput, serverErr } from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { id: influencer_id } = await params;

  const { data: influencer, error: infErr } = await supabaseAdmin
    .from("ai_influencers")
    .select("id, user_id, identity_lock_id, status")
    .eq("id", influencer_id)
    .eq("user_id", userId)
    .single();

  if (infErr || !influencer) return invalidInput("Influencer not found");
  if (!influencer.identity_lock_id) {
    return invalidInput("Cannot save identity — influencer has no identity lock. Select a candidate first.");
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("ai_influencers")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", influencer_id)
    .select()
    .single();

  if (updateErr || !updated) {
    console.error("[POST /save-identity]", updateErr);
    return serverErr("Failed to save identity");
  }

  return ok({ influencer: updated, saved: true });
}
