/**
 * Stripe billing adapter.
 *
 * Stripe payment flow:
 *   1. Server creates a PaymentIntent → gets client_secret
 *   2. Client mounts Stripe Elements with client_secret
 *   3. User pays → Stripe confirms the PaymentIntent
 *   4. Stripe sends webhook to POST /api/webhooks/stripe
 *        event: payment_intent.succeeded
 *   5. Webhook handler verifies signature → calls fulfillOrder()
 *
 * Unlike Razorpay, Stripe does NOT have a client-side verify step —
 * fulfillment is driven entirely by the webhook.
 * The client can poll GET /api/billing/orders/:id to get confirmation.
 */
import Stripe from "stripe";
import type { BillingAdapter, CreateOrderParams, ProviderOrderResult } from "../types";
import { BILLING_DEMO_MODE, makeDemoStripeOrder } from "../demo";

// Lazy singleton — avoids instantiating on every request in serverless
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY env var");
    _stripe = new Stripe(secretKey, { apiVersion: "2025-03-31.basil" });
  }
  return _stripe;
}

/**
 * Creates a Stripe PaymentIntent.
 * The client_secret in clientPayload is used by Stripe Elements to render
 * the payment UI — it never leaves the server except to the authenticated user.
 */
async function createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
  // ── Demo mode: return fake PaymentIntent without calling Stripe API ─────────
  // BILLING_DEMO_MODE is server-side only — this branch never runs in production.
  if (BILLING_DEMO_MODE) {
    console.log("[stripe] DEMO MODE — returning fake PaymentIntent, no API call made");
    return makeDemoStripeOrder();
  }

  const stripe = getStripe();

  const intent = await stripe.paymentIntents.create({
    amount:   params.amountCents,
    currency: params.currency.toLowerCase(),
    metadata: {
      user_id:          params.userId,
      credits_to_grant: String(params.creditsToGrant),
      idempotency_key:  params.idempotencyKey,
      ...params.metadata,
    },
    // Automatically captures on confirmation — no separate capture step needed
    capture_method: "automatic",
  }, {
    // Stripe-level idempotency key prevents double-creates on retry
    idempotencyKey: params.idempotencyKey,
  });

  return {
    providerOrderId: intent.id,          // pi_...
    clientPayload: {
      clientSecret: intent.client_secret, // used by Stripe Elements
    },
  };
}

/**
 * Verifies a Stripe webhook signature using the raw request body.
 * Returns the verified Stripe Event object, or throws if invalid.
 *
 * IMPORTANT: Next.js must NOT parse the body before this function —
 * use req.text() in the webhook route, not req.json().
 */
export function constructStripeEvent(
  rawBody:   string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET env var");
  }

  // constructEvent throws if the signature is invalid — catch at the call site
  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export const stripeAdapter: BillingAdapter = {
  provider:    "stripe",
  createOrder,
};
