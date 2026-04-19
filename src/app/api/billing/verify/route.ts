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
import { BILLING_DEMO_MODE, DEMO_RAZORPAY_SIGNATURE } from "@/lib/billing/demo";
import type { RazorpayVerifyPayload } from "@/lib/billing/types";

const IS_DEV = process.env.NODE_ENV === "development" || process.env.DEMO_MODE === "true";

/**
 * Returns true when signature verification should be skipped.
 *
 * Skipped only when ALL of these are true:
 *   1. BILLING_DEMO_MODE=true (server-side env var)
 *   2. The signature matches the known demo sentinel
 *
 * In production BILLING_DEMO_MODE is always false, so this
 * function always returns false there — no weakening of prod path.
 */
function shouldSkipSignatureVerification(signature: string): boolean {
  return BILLING_DEMO_MODE && signature === DEMO_RAZORPAY_SIGNATURE;
}

export async function POST(req: Request) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

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
    // Skip only when: BILLING_DEMO_MODE=true AND sentinel signature is present.
    // In all other cases (including all production and IS_DEV requests) the HMAC runs.
    // IS_DEV is intentionally NOT part of this condition — bypassing HMAC via env flag
    // is a security hole if DEMO_MODE=true ever leaks into production.
    const skipSig = shouldSkipSignatureVerification(razorpaySignature);

    if (!skipSig) {
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
    } else if (BILLING_DEMO_MODE) {
      console.log("[verify] DEMO MODE — signature verification skipped");
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
