/**
 * POST /api/creative-director/generations/[generationId]/refund
 *
 * Issues a credit refund for a failed Creative Director generation.
 * Called by CDv2Shell when async polling resolves to "error" or "failed".
 *
 * The CD generate route uses spend_credits upfront (before dispatch) with
 * skipCredits=true on studioDispatch. This means async provider failures
 * that only surface during polling have no automatic refund path — this
 * endpoint fills that gap.
 *
 * Guards:
 *   - Must be authenticated
 *   - Generation must belong to the calling user
 *   - Generation must be in a failed/error state (no refund for completed)
 *   - Idempotent: a generation can only be refunded once (tracks via refund_at column)
 *
 * Response:
 *   200 { refunded: true, amount: number }
 *   200 { refunded: false, reason: string }  — already refunded or not failed
 *   401 / 403 / 404 on auth/ownership/not-found
 */

import { NextResponse }  from "next/server";
import { getAuthUser }   from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ generationId: string }> }
): Promise<Response> {
  const { generationId } = await params;

  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Load generation record ─────────────────────────────────────────────────
  const { data: gen, error: genErr } = await supabaseAdmin
    .from("creative_generations")
    .select("id, user_id, status, credit_cost, refunded_at")
    .eq("id", generationId)
    .single();

  if (genErr || !gen) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  // ── Ownership check ────────────────────────────────────────────────────────
  if (gen.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Idempotency — already refunded ────────────────────────────────────────
  if (gen.refunded_at) {
    return NextResponse.json({ refunded: false, reason: "already_refunded" });
  }

  // ── Only refund failed generations ────────────────────────────────────────
  const failedStatuses = ["failed", "error"];
  if (!failedStatuses.includes(gen.status)) {
    return NextResponse.json({
      refunded: false,
      reason:   `generation_status_is_${gen.status}`,
    });
  }

  const amount = gen.credit_cost ?? 0;

  // ── Mark as refunded before calling RPC (prevents duplicate parallel calls) ─
  await supabaseAdmin
    .from("creative_generations")
    .update({ refunded_at: new Date().toISOString() })
    .eq("id", generationId)
    .eq("refunded_at", null as unknown as string); // only update if not already set

  if (amount > 0) {
    const { error: refundErr } = await supabaseAdmin.rpc("refund_credits", {
      p_user_id:     user.id,
      p_amount:      amount,
      p_description: `Refund: CD async failure — generation ${generationId}`,
    });

    if (refundErr) {
      // Roll back the refunded_at mark so the client can retry
      await supabaseAdmin
        .from("creative_generations")
        .update({ refunded_at: null })
        .eq("id", generationId);

      console.error(`[cd/refund] refund_credits RPC failed for gen ${generationId}:`, refundErr);
      return NextResponse.json({ error: "Refund failed" }, { status: 500 });
    }
  }

  console.log(`[cd/refund] refunded ${amount} cr for gen=${generationId} user=${user.id}`);
  return NextResponse.json({ refunded: true, amount });
}
