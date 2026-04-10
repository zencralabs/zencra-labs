/**
 * Billing demo mode — safe local + preview testing without real provider keys.
 *
 * Activated by: BILLING_DEMO_MODE=true in environment variables.
 * This file is the single source of truth for all demo-mode constants and
 * fake data generators used across the billing system.
 *
 * ── Safety guarantees ────────────────────────────────────────────────────────
 *
 * 1. BILLING_DEMO_MODE is a server-side env var — clients cannot set it.
 * 2. Production verification functions (verifyRazorpaySignature,
 *    verifyRazorpayWebhookSignature, constructStripeEvent) are NEVER modified.
 *    Demo mode bypasses calling them; it never weakens them.
 * 3. The bypass condition is always:
 *      if (BILLING_DEMO_MODE && <demo sentinel matches>) { skip }
 *      else { always verify }
 *    Since BILLING_DEMO_MODE is false in production, the else branch
 *    always runs there regardless of what signature the caller sends.
 * 4. All fake responses include isDemo:true — impossible to confuse
 *    with real provider responses.
 * 5. The fulfillOrder() RPC path is identical in demo and production —
 *    credits and ledger update in exactly the same way.
 *
 * ── What "demo" means per provider ──────────────────────────────────────────
 *
 *  Razorpay: createOrder() returns a fake order_id without calling the API.
 *            Frontend auto-calls /api/billing/verify with DEMO_PAYMENT_ID
 *            and DEMO_RAZORPAY_SIGNATURE instead of opening the modal.
 *            /api/billing/verify skips HMAC check in demo mode.
 *
 *  Stripe:   createOrder() returns a fake client_secret without calling the API.
 *            Frontend calls /api/billing/demo/webhook to simulate
 *            the payment_intent.succeeded event.
 *            /api/webhooks/stripe accepts DEMO_STRIPE_SIGNATURE in demo mode.
 */

/** True when BILLING_DEMO_MODE=true is set in the environment. */
export const BILLING_DEMO_MODE =
  process.env.BILLING_DEMO_MODE === "true";

// ── Demo sentinels ────────────────────────────────────────────────────────────
// These values are accepted as valid signatures only when BILLING_DEMO_MODE=true.
// In production, signature functions run normally and these strings would fail.

/** Accepted as a valid Razorpay payment signature in demo mode. */
export const DEMO_RAZORPAY_SIGNATURE = "demo_razorpay_sig_ok";

/** Accepted as the stripe-signature header value in demo mode. */
export const DEMO_STRIPE_SIGNATURE = "demo_stripe_sig_ok=";

// ── Fake ID generators ────────────────────────────────────────────────────────

/** Generates a deterministic-looking fake Razorpay order ID. */
export function demoPrefixedId(prefix: string): string {
  return `${prefix}_demo_${Date.now()}`;
}

// ── Fake provider payloads ────────────────────────────────────────────────────

/**
 * Returns the fake Razorpay order payload that createOrder() emits in demo mode.
 * Shape mirrors the real Razorpay response so the frontend code path is identical.
 */
export function makeDemoRazorpayOrder(params: {
  amountCents: number;
  currency:    string;
}) {
  const fakeOrderId = demoPrefixedId("order");
  return {
    providerOrderId: fakeOrderId,
    clientPayload: {
      razorpayOrderId: fakeOrderId,
      amount:          params.amountCents,
      currency:        params.currency.toUpperCase(),
      keyId:           process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "demo_key",
      isDemo:          true,
    },
  };
}

/**
 * Returns the fake Stripe PaymentIntent payload that createOrder() emits in demo mode.
 * Shape mirrors the real Stripe response so the frontend code path is identical.
 */
export function makeDemoStripeOrder() {
  const fakeIntentId = demoPrefixedId("pi");
  return {
    providerOrderId: fakeIntentId,
    clientPayload: {
      clientSecret: `${fakeIntentId}_secret_demo`,
      isDemo:       true,
    },
  };
}

/**
 * Constructs the fake Stripe Event object that the webhook handler receives
 * in demo mode. Matches the shape the handler destructures.
 */
export function makeDemoStripeEvent(intentId: string) {
  return {
    id:   demoPrefixedId("evt"),
    type: "payment_intent.succeeded",
    data: {
      object: {
        id:             intentId,
        latest_charge:  demoPrefixedId("ch"),
        status:         "succeeded",
        object:         "payment_intent",
      },
    },
  };
}

/**
 * Constructs the fake Razorpay webhook payload the webhook handler receives
 * in demo mode. Used by /api/billing/demo/webhook.
 */
export function makeDemoRazorpayWebhookPayload(
  razorpayOrderId:   string,
  razorpayPaymentId: string
) {
  return {
    event:      "payment.captured",
    account_id: "demo_account",
    payload: {
      payment: {
        entity: {
          id:       razorpayPaymentId,
          order_id: razorpayOrderId,
          status:   "captured",
          amount:   0,
          currency: "USD",
        },
      },
    },
  };
}
