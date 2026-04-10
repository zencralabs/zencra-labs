/**
 * POST /api/billing/demo/webhook
 *
 * Simulates a successful payment webhook for local and preview testing.
 * Returns HTTP 403 in production — this endpoint is completely inert when
 * BILLING_DEMO_MODE is not set.
 *
 * What it does:
 *   1. Guards: returns 403 unless BILLING_DEMO_MODE=true
 *   2. Validates that the order exists and belongs to the authenticated user
 *   3. Calls fulfillOrder() — the SAME path as real Razorpay/Stripe webhooks
 *   4. Returns the new credit balance
 *
 * The credits and credit_transactions update identically to a real payment.
 * No mocking happens inside fulfillOrder() itself.
 *
 * Body:
 *   {
 *     orderId:  string                    // our internal orders.id
 *     provider: "razorpay" | "stripe"     // which provider to simulate
 *   }
 *
 * Use this to test:
 *   • Full Stripe fulfillment path (no verify endpoint for Stripe)
 *   • Razorpay webhook safety-net path
 *   • Idempotency: call twice, credits only granted once
 *
 * curl example (local):
 *   curl -s -X POST http://localhost:3000/api/billing/demo/webhook \
 *     -H "Content-Type: application/json" \
 *     -d '{"orderId":"<uuid>","provider":"razorpay"}'
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import { fulfillOrder, markOrderFulfillmentFailed } from "@/lib/billing/fulfill";
import {
  BILLING_DEMO_MODE,
  demoPrefixedId,
} from "@/lib/billing/demo";

const IS_DEV = process.env.NODE_ENV === "development" || process.env.DEMO_MODE === "true";
const DEV_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request) {
  // ── Gate: 403 in production ──────────────────────────────────────────────
  if (!BILLING_DEMO_MODE) {
    return NextResponse.json(
      { success: false, error: "This endpoint is only available in demo mode" },
      { status: 403 }
    );
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);
    if (!authUser && !IS_DEV) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser?.id ?? DEV_DEMO_USER_ID;

    // ── Parse body ───────────────────────────────────────────────────────────
    const body = await req.json() as { orderId?: string; provider?: string };
    const { orderId, provider } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });
    }
    if (!provider || !["razorpay", "stripe"].includes(provider)) {
      return NextResponse.json(
        { success: false, error: "provider must be 'razorpay' or 'stripe'" },
        { status: 400 }
      );
    }

    // ── Load order and verify ownership ─────────────────────────────────────
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, provider, status, fulfillment_state, credits_to_grant, provider_order_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (order.user_id !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (order.provider !== provider) {
      return NextResponse.json(
        { success: false, error: `Order was created for provider '${order.provider}', not '${provider}'` },
        { status: 400 }
      );
    }

    // ── Generate a deterministic fake payment ID ─────────────────────────────
    // Shape mirrors the real provider: Razorpay pay_... / Stripe ch_...
    const fakePaymentId = provider === "razorpay"
      ? demoPrefixedId("pay")
      : demoPrefixedId("ch");

    console.log(`[demo/webhook] Simulating ${provider} payment.captured for order ${orderId}`);
    console.log(`[demo/webhook] Fake payment ID: ${fakePaymentId}`);

    // ── Fulfill via the same RPC as real webhooks ────────────────────────────
    // fulfillOrder() is not mocked — credits and ledger update exactly as real.
    let result;
    try {
      result = await fulfillOrder(orderId, fakePaymentId);
    } catch (err) {
      await markOrderFulfillmentFailed(orderId, err instanceof Error ? err.message : "Unknown");
      return NextResponse.json({ success: false, error: "Fulfillment failed" }, { status: 500 });
    }

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      isDemo:  true,
      data: {
        orderId,
        provider,
        fakePaymentId,
        newBalance:     result.newBalance,
        creditsGranted: order.credits_to_grant,
        // Show clearly this was a simulated payment — impossible to confuse with real
        message: `[DEMO] Simulated ${provider} payment — ${order.credits_to_grant} credits granted`,
      },
    });
  } catch (err) {
    console.error("[demo/webhook] Unhandled error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
