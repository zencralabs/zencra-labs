/**
 * POST /api/webhooks/razorpay
 *
 * Receives payment event notifications from Razorpay.
 * Acts as a safety net — fulfillment may already be done by
 * /api/billing/verify, but the RPC handles that idempotently.
 *
 * Critical rules:
 *   • Read raw body with req.text() — NEVER req.json() before verification
 *   • Log to webhook_events BEFORE processing anything
 *   • Always return HTTP 200 — non-200 causes Razorpay to retry indefinitely
 *   • Use provider_event_id UNIQUE constraint to prevent double-processing
 *
 * Razorpay retries failed webhooks up to 5 times with exponential backoff.
 * Our idempotency key on webhook_events prevents logging the same event twice,
 * and fulfill_order's fulfillment_state check prevents double-crediting.
 *
 * Handled events:
 *   • payment.captured — payment fully captured, safe to grant credits
 *
 * Set webhook URL in Razorpay Dashboard:
 *   https://yourdomain.com/api/webhooks/razorpay
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyRazorpayWebhookSignature } from "@/lib/billing/providers/razorpay";
import { fulfillOrder, markOrderFulfillmentFailed } from "@/lib/billing/fulfill";
import { BILLING_DEMO_MODE, DEMO_RAZORPAY_SIGNATURE } from "@/lib/billing/demo";

// Razorpay webhook payload shapes
interface RazorpayPaymentEntity {
  id:       string;   // pay_...
  order_id: string;   // order_...
  status:   string;   // "captured"
  amount:   number;
  currency: string;
}

interface RazorpayWebhookPayload {
  event:      string;
  account_id: string;
  payload: {
    payment?: {
      entity: RazorpayPaymentEntity;
    };
  };
}

export async function POST(req: Request) {
  // Always return 200 — even on errors — to prevent Razorpay from retrying endlessly.
  // Errors are logged to webhook_events.error for inspection.

  let rawBody = "";
  let eventId = `rz-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parsedPayload: RazorpayWebhookPayload | null = null;

  try {
    // ── 1. Read raw body (required for HMAC verification) ───────────────────
    rawBody = await req.text();

    // ── 2. Parse payload ─────────────────────────────────────────────────────
    try {
      parsedPayload = JSON.parse(rawBody) as RazorpayWebhookPayload;
      // Use Razorpay's payment ID as the dedup key when available
      const paymentId = parsedPayload.payload?.payment?.entity?.id;
      if (paymentId) eventId = paymentId;
    } catch {
      await logWebhookEvent({ provider: "razorpay", eventId, eventType: "parse_error", payload: {}, processed: false, error: "JSON parse failed" });
      return NextResponse.json({ received: true });
    }

    const eventType = parsedPayload.event ?? "unknown";

    // ── 3. Verify signature ──────────────────────────────────────────────────
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    // Demo sentinel accepted only when BILLING_DEMO_MODE=true (server env var).
    // In production BILLING_DEMO_MODE is always false — this branch never runs.
    const isDemoRequest = BILLING_DEMO_MODE && signature === DEMO_RAZORPAY_SIGNATURE;

    if (!isDemoRequest) {
      // Production path: always verify HMAC — unchanged
      let signatureValid = false;
      try {
        signatureValid = verifyRazorpayWebhookSignature(rawBody, signature);
      } catch (err) {
        const error = err instanceof Error ? err.message : "Signature check threw";
        await logWebhookEvent({ provider: "razorpay", eventId, eventType, payload: parsedPayload, processed: false, error });
        return NextResponse.json({ received: true });
      }

      if (!signatureValid) {
        await logWebhookEvent({ provider: "razorpay", eventId, eventType, payload: parsedPayload, processed: false, error: "Invalid signature" });
        return NextResponse.json({ received: true });
      }
    } else {
      console.log("[webhook/razorpay] DEMO MODE — signature verification skipped");
    }

    // ── 4. Log the raw event (before processing, before any DB writes) ───────
    // UNIQUE (provider, provider_event_id) — if this returns a conflict error,
    // we've already processed this event; skip processing silently.
    const logResult = await logWebhookEvent({ provider: "razorpay", eventId, eventType, payload: parsedPayload, processed: false });
    if (logResult.alreadyLogged) {
      // Duplicate delivery — safe to acknowledge without re-processing
      return NextResponse.json({ received: true });
    }
    const webhookEventDbId = logResult.id;

    // ── 5. Handle the event ──────────────────────────────────────────────────
    if (eventType === "payment.captured") {
      const payment = parsedPayload.payload?.payment?.entity;

      if (!payment?.order_id || !payment?.id) {
        await updateWebhookEvent(webhookEventDbId, false, "Missing payment entity fields");
        return NextResponse.json({ received: true });
      }

      // Find our order by the Razorpay order_id
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id, fulfillment_state")
        .eq("provider_order_id", payment.order_id)
        .eq("provider", "razorpay")
        .single();

      if (!order) {
        await updateWebhookEvent(webhookEventDbId, false, `No order found for razorpay order_id: ${payment.order_id}`, null);
        return NextResponse.json({ received: true });
      }

      // Update the webhook_events row with the matched order_id
      await supabaseAdmin.from("webhook_events").update({ order_id: order.id }).eq("id", webhookEventDbId);

      // Fulfill (idempotent — if verify endpoint already ran, this is a no-op)
      try {
        const result = await fulfillOrder(order.id, payment.id);
        await updateWebhookEvent(webhookEventDbId, result.success, result.error ?? null);
      } catch (err) {
        const error = err instanceof Error ? err.message : "fulfillOrder threw";
        await markOrderFulfillmentFailed(order.id, error);
        await updateWebhookEvent(webhookEventDbId, false, error);
      }
    } else {
      // Unhandled event type — log as processed (we don't need to act on it)
      await updateWebhookEvent(webhookEventDbId, true);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    // Last-resort catch — log and return 200
    const error = err instanceof Error ? err.message : "Unhandled exception";
    console.error("[webhook/razorpay] Unhandled error:", error);
    try {
      await logWebhookEvent({ provider: "razorpay", eventId, eventType: parsedPayload?.event ?? "unknown", payload: parsedPayload ?? {}, processed: false, error });
    } catch { /* ignore logging failure */ }
    return NextResponse.json({ received: true });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface LogParams {
  provider:  string;
  eventId:   string;
  eventType: string;
  payload:   unknown;
  processed: boolean;
  error?:    string;
}

async function logWebhookEvent(p: LogParams): Promise<{ id: string; alreadyLogged: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("webhook_events")
    .insert({
      provider:          p.provider,
      provider_event_id: p.eventId,
      event_type:        p.eventType,
      payload:           p.payload,
      processed:         p.processed,
      error:             p.error ?? null,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {  // unique_violation — already logged
    return { id: "", alreadyLogged: true };
  }

  return { id: data?.id ?? "", alreadyLogged: false };
}

async function updateWebhookEvent(id: string, processed: boolean, error?: string | null, _orderId?: string | null): Promise<void> {
  if (!id) return;
  await supabaseAdmin
    .from("webhook_events")
    .update({ processed, error: error ?? null })
    .eq("id", id);
}
