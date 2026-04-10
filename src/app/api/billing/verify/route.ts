/**
 * POST /api/billing/verify
 *
 * Razorpay client-side payment verification.
 * Called immediately after the user completes payment in the Razorpay modal.
 *
 * Stripe does NOT use this endpoint — Stripe fulfillment is webhook-only.
 *
 * Flow:
 *   1. Verify the HMAC-SHA256 signature from Razorpay
 *   2. Load the order and confirm it belongs to the authenticated user
 *   3. Call fulfillOrder() — idempotent, safe even if webhook fires first
 *   4. Return the new credit balance so the UI can update immediately
 *
 * Body:
 *   {
 *     orderId:           string   // our internal orders.id
 *     razorpayPaymentId: string   // e.g. pay_...
 *     razorpayOrderId:   string   // e.g. order_...
 *     razorpaySignature: string   // HMAC from Razorpay callback
 *   }
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import { verifyRazorpaySignature } from "@/lib/billing/providers/razorpay";
import { fulfillOrder, markOrderFulfillmentFailed } from "@/lib/billing/fulfill";
import type { RazorpayVerifyPayload } from "@/lib/billing/types";

const IS_DEV = process.env.NODE_ENV === "development" || process.env.DEMO_MODE === "true";
const DEV_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);
    if (!authUser && !IS_DEV) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser?.id ?? DEV_DEMO_USER_ID;

    // ── 2. Parse and validate body ───────────────────────────────────────────
    const body = await req.json() as Partial<RazorpayVerifyPayload>;
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = body;

    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature" },
        { status: 400 }
      );
    }

    // ── 3. Verify signature ──────────────────────────────────────────────────
    // In DEMO_MODE skip signature verification so it can be tested without real keys
    if (!IS_DEV) {
      let signatureValid: boolean;
      try {
        signatureValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      } catch (err) {
        console.error("[verify] Signature verification threw:", err);
        return NextResponse.json({ success: false, error: "Signature verification failed" }, { status: 400 });
      }

      if (!signatureValid) {
        console.warn("[verify] Invalid signature", { orderId, razorpayOrderId });
        return NextResponse.json({ success: false, error: "Invalid payment signature" }, { status: 400 });
      }
    }

    // ── 4. Load the order and confirm ownership ──────────────────────────────
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, fulfillment_state, credits_to_grant, provider")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (order.user_id !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (order.provider !== "razorpay") {
      return NextResponse.json(
        { success: false, error: "This endpoint is only for Razorpay orders" },
        { status: 400 }
      );
    }

    // ── 5. Fulfill the order (idempotent) ────────────────────────────────────
    let result;
    try {
      result = await fulfillOrder(orderId, razorpayPaymentId);
    } catch (err) {
      await markOrderFulfillmentFailed(orderId, err instanceof Error ? err.message : "Unknown");
      return NextResponse.json({ success: false, error: "Credit fulfillment failed" }, { status: 500 });
    }

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    // ── 6. Return new balance so the credits pill updates immediately ─────────
    return NextResponse.json({
      success:    true,
      data: {
        newBalance:     result.newBalance,
        creditsGranted: order.credits_to_grant,
      },
    });
  } catch (err) {
    console.error("[POST /api/billing/verify]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
