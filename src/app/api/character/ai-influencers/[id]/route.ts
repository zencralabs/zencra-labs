/**
 * PATCH /api/character/ai-influencers/:id
 *
 * Updates the candidate_session jsonb column on a draft ai_influencers record.
 * Called by the client in two situations:
 *   1. When all polling jobs resolve → { candidate_session: { status:'ready', candidate_urls, expected_count, snapshot_extra } }
 *   2. When user discards the batch → { candidate_session: { status:'discarded' } }
 *
 * Only draft records owned by the requesting user can be patched.
 * Returns: { updated: true }
 *
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
import { ok, invalidInput, serverErr, parseBody } from "@/lib/api/route-utils";
import { supabaseAdmin }    from "@/lib/supabase/admin";
import { getUserSlotInfo }  from "@/lib/influencer/identity-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Candidate session shape ───────────────────────────────────────────────────

interface CandidateSessionPatch {
  status:          "generating" | "ready" | "discarded";
  expected_count?: number;
  candidate_urls?: string[];
  snapshot_extra?: {
    bodyType: string;
    leftArm:  string;
    rightArm: string;
    leftLeg:  string;
    rightLeg: string;
    skinArt:  string[];
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  const { id: influencer_id } = await params;

  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  // Validate candidate_session payload
  const session = body?.candidate_session as CandidateSessionPatch | undefined;
  if (!session || !["generating", "ready", "discarded"].includes(session.status)) {
    return invalidInput("candidate_session with valid status is required");
  }

  // Verify ownership + draft status — only draft records can be patched
  const { data: influencer, error: fetchErr } = await supabaseAdmin
    .from("ai_influencers")
    .select("id, user_id, status")
    .eq("id", influencer_id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !influencer) return invalidInput("Influencer not found");
  if (influencer.status !== "draft") {
    return invalidInput("Only draft influencers can be updated via this route");
  }

  // Build the update — merge incoming fields into the session object
  const sessionUpdate: CandidateSessionPatch = { status: session.status };
  if (typeof session.expected_count === "number") {
    sessionUpdate.expected_count = session.expected_count;
  }
  if (Array.isArray(session.candidate_urls)) {
    sessionUpdate.candidate_urls = session.candidate_urls;
  }
  if (session.snapshot_extra && typeof session.snapshot_extra === "object") {
    sessionUpdate.snapshot_extra = session.snapshot_extra;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("ai_influencers")
    .update({
      candidate_session: sessionUpdate,
      updated_at:        new Date().toISOString(),
    })
    .eq("id", influencer_id);

  if (updateErr) {
    console.error("[PATCH /ai-influencers/:id] candidate_session update failed:", updateErr);
    return serverErr("Failed to update candidate session");
  }

  return ok({ updated: true });
}

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
