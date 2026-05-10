/**
 * DELETE /api/character/ai-influencers/:id
 *
 * Soft-delete an influencer by setting status='archived'.
 * This frees one identity slot.
 *
 * Rules:
 *   - Only the owning user can delete
 *   - Archived influencers are hidden from library (GET filters .neq("status","archived"))
 *   - No credit refund (credits were for generation work, not storage)
 *   - Identity lock record is NOT deleted (audit trail preserved)
 *
 * Returns: { freed: true, slots_remaining: number }
 */

import { requireAuthUser }  from "@/lib/supabase/server";
import { ok, invalidInput, serverErr } from "@/lib/api/route-utils";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { getUserSlotInfo }  from "@/lib/influencer/identity-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { id: influencer_id } = await params;

  // ── Verify ownership ───────────────────────────────────────────────────────
  const { data: influencer, error: fetchErr } = await supabaseAdmin
    .from("ai_influencers")
    .select("id, user_id, status")
    .eq("id", influencer_id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !influencer) return invalidInput("Influencer not found");
  if (influencer.status === "archived") {
    return ok({ freed: false, message: "Already archived" });
  }

  // ── Soft-delete: set status = archived ────────────────────────────────────
  const { error: updateErr } = await supabaseAdmin
    .from("ai_influencers")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", influencer_id);

  if (updateErr) {
    console.error("[DELETE /ai-influencers/:id] archive failed:", updateErr);
    return serverErr("Failed to delete influencer");
  }

  // ── Return updated slot count ──────────────────────────────────────────────
  const slotInfo = await getUserSlotInfo(userId);

  return ok({ freed: true, slots_remaining: slotInfo.remaining });
}
