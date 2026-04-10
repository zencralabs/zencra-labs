/**
 * POST /api/webhooks/stripe
 *
 * Receives payment event notifications from Stripe.
 * For Stripe, this is the PRIMARY fulfillment path (not a safety net) —
 * there is no client-side verify step equivalent to Razorpay.
 *
 * Critical rules:
 *   • Read raw body with req.text() BEFORE any parsing
 *   • Pass raw body + stripe-signature header to constructStripeEvent()
 *   • Log to webhook_events BEFORE processing
 *   • Always return HTTP 200 — Stripe retries on non-200 for 72 hours
 *
 * Handled events:
 *   • payment_intent.succeeded — PaymentIntent fully confirmed, grant credits
 *   • payment_intent.payment_failed — mark order failed (no refund needed, payment didn't capture)
 *
 * Set webhook URL in Stripe Dashboard:
 *   https://yourdomain.com/api/webhooks/stripe
 *
 * For local testing:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { constructStripeEvent } from "@/lib/billing/providers/stripe";
import { fulfillOrder, markOrderFulfillmentFailed } from "@/lib/billing/fulfill";

export async function POST(req: Request) {
  let rawBody = "";
  let stripeEvent: Stripe.Event | null = null;

  try {
    // ── 1. Read raw body (must happen before any other body access) ──────────
    rawBody = await req.text();

    // ── 2. Verify signature and parse event ──────────────────────────────────
    const signature = req.headers.get("stripe-signature") ?? "";

    try {
      stripeEvent = constructStripeEvent(rawBody, signature);
    } catch (err) {
      const error = err instanceof Error ? err.message : "constructEvent failed";
      console.error("[webhook/stripe] Signature verification failed:", error);
      await logWebhookEvent({ provider: "stripe", eventId: `sig-fail-${Date.now()}`, eventType: "signature_failure", payload: {}, processed: false, error });
      // Return 400 for invalid signatures — Stripe won't retry these
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const eventId   = stripeEvent.id;       // evt_...
    const eventType = stripeEvent.type;

    // ── 3. Log the raw event ─────────────────────────────────────────────────
    const logResult = await logWebhookEvent({
      provider:  "stripe",
      eventId,
      eventType,
      payload:   stripeEvent as unknown as Record<string, unknown>,
      processed: false,
    });

    if (logResult.alreadyLogged) {
      // Duplicate delivery — Stripe guarantees at-least-once delivery
      return NextResponse.json({ received: true });
    }

    const webhookEventDbId = logResult.id;

    // ── 4. Handle the event ──────────────────────────────────────────────────
    if (eventType === "payment_intent.succeeded") {
      const intent = stripeEvent.data.object as Stripe.PaymentIntent;
      const intentId = intent.id;  // pi_...

      // Find our order by the Stripe PaymentIntent ID
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id, fulfillment_state")
        .eq("provider_order_id", intentId)
        .eq("provider", "stripe")
        .single();

      if (!order) {
        await updateWebhookEvent(webhookEventDbId, false, `No order for PaymentIntent: ${intentId}`);
        return NextResponse.json({ received: true });
      }

      await supabaseAdmin.from("webhook_events").update({ order_id: order.id }).eq("id", webhookEventDbId);

      // The payment_intent.succeeded event's charge ID (latest_charge) is the
      // canonical payment identifier for Stripe records
      const chargeId = typeof intent.latest_charge === "string"
        ? intent.latest_charge
        : intentId;   // fallback to intent ID

      try {
        const result = await fulfillOrder(order.id, chargeId);
        await updateWebhookEvent(webhookEventDbId, result.success, result.error ?? null);
      } catch (err) {
        const error = err instanceof Error ? err.message : "fulfillOrder threw";
        await markOrderFulfillmentFailed(order.id, error);
        await updateWebhookEvent(webhookEventDbId, false, error);
      }

    } else if (eventType === "payment_intent.payment_failed") {
      const intent = stripeEvent.data.object as Stripe.PaymentIntent;

      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("provider_order_id", intent.id)
        .eq("provider", "stripe")
        .single();

      if (order) {
        await supabaseAdmin
          .from("orders")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", order.id);

        await supabaseAdmin.from("webhook_events").update({ order_id: order.id }).eq("id", webhookEventDbId);
      }

      await updateWebhookEvent(webhookEventDbId, true);

    } else {
      // Unhandled event — mark processed so it doesn't show up in the retry queue
      await updateWebhookEvent(webhookEventDbId, true);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    const error = err instanceof Error ? err.message : "Unhandled exception";
    console.error("[webhook/stripe] Unhandled error:", error);
    try {
      await logWebhookEvent({
        provider:  "stripe",
        eventId:   stripeEvent?.id ?? `err-${Date.now()}`,
        eventType: stripeEvent?.type ?? "unknown",
        payload:   stripeEvent as unknown as Record<string, unknown> ?? {},
        processed: false,
        error,
      });
    } catch { /* ignore */ }
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

  if (error?.code === "23505") {  // unique_violation
    return { id: "", alreadyLogged: true };
  }

  return { id: data?.id ?? "", alreadyLogged: false };
}

async function updateWebhookEvent(id: string, processed: boolean, error?: string | null): Promise<void> {
  if (!id) return;
  await supabaseAdmin
    .from("webhook_events")
    .update({ processed, error: error ?? null })
    .eq("id", id);
}
