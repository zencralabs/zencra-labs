/**
 * GET /api/billing/orders/:orderId
 *
 * Returns the current status of a billing order.
 * Used by the client to poll for payment confirmation — particularly
 * useful for Stripe (no client-side verify callback) or when the
 * Razorpay modal was closed before the onSuccess callback fired.
 *
 * Users can only read their own orders (enforced server-side, not just RLS).
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // ── Auth ─────────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    // ── Load order ───────────────────────────────────────────────────────────
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        provider,
        amount_cents,
        currency,
        credits_to_grant,
        status,
        fulfillment_state,
        fulfilled_at,
        created_at,
        updated_at,
        credit_packs ( name, credits )
      `)
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Server-side ownership check — belt and suspenders alongside RLS
    const { data: ownerCheck } = await supabaseAdmin
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .single();

    if (ownerCheck?.user_id !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
