/**
 * Razorpay billing adapter.
 *
 * Razorpay payment flow:
 *   1. Server creates an Order via Razorpay API → gets razorpay_order_id
 *   2. Client opens Razorpay Checkout modal with razorpay_order_id
 *   3. User pays → Razorpay calls onSuccess callback with
 *        { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *   4. Client sends those three values to POST /api/billing/verify
 *   5. Server verifies HMAC-SHA256 signature → calls fulfillOrder()
 *   6. Razorpay ALSO sends a webhook to POST /api/webhooks/razorpay
 *      (as a safety net, handled idempotently)
 *
 * The SDK used here is the raw Razorpay REST API via fetch — no official
 * Node SDK dependency needed for order creation and verification.
 */
import crypto from "crypto";
import type { BillingAdapter, CreateOrderParams, ProviderOrderResult } from "../types";
import { BILLING_DEMO_MODE, makeDemoRazorpayOrder } from "../demo";

function getCredentials() {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET env vars");
  }

  return { keyId, keySecret };
}

/**
 * Creates a Razorpay Order via their REST API.
 * Returns the Razorpay order_id and the clientPayload the frontend needs
 * to open the Checkout modal.
 */
async function createOrder(params: CreateOrderParams): Promise<ProviderOrderResult> {
  // ── Demo mode: return fake order without calling Razorpay API ───────────────
  // BILLING_DEMO_MODE is server-side only — this branch never runs in production.
  if (BILLING_DEMO_MODE) {
    console.log("[razorpay] DEMO MODE — returning fake order, no API call made");
    return makeDemoRazorpayOrder({ amountCents: params.amountCents, currency: params.currency });
  }

  const { keyId, keySecret } = getCredentials();

  const body = {
    amount:   params.amountCents,                    // Razorpay expects smallest currency unit
    currency: params.currency.toUpperCase(),         // "USD"
    receipt:  params.idempotencyKey.slice(0, 40),    // max 40 chars
    notes: {
      user_id:         params.userId,
      credits_to_grant: String(params.creditsToGrant),
      ...params.metadata,
    },
  };

  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Razorpay createOrder failed (${res.status}): ${
        (err as { error?: { description?: string } }).error?.description ?? res.statusText
      }`
    );
  }

  const order = (await res.json()) as { id: string; amount: number; currency: string };

  return {
    providerOrderId: order.id,
    clientPayload: {
      razorpayOrderId: order.id,
      amount:          order.amount,    // already in paise/cents
      currency:        order.currency,
      keyId,                            // NEXT_PUBLIC_RAZORPAY_KEY_ID exposed separately for client
    },
  };
}

/**
 * Verifies the HMAC-SHA256 signature Razorpay sends after a successful payment.
 *
 * The signature is computed over: razorpay_order_id + "|" + razorpay_payment_id
 * using RAZORPAY_KEY_SECRET as the HMAC key.
 *
 * Returns true if the signature is valid — safe to fulfill the order.
 */
export function verifyRazorpaySignature(
  razorpayOrderId:   string,
  razorpayPaymentId: string,
  signature:         string
): boolean {
  const { keySecret } = getCredentials();

  const body    = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature,  "hex")
  );
}

/**
 * Verifies the HMAC-SHA256 signature on a Razorpay webhook delivery.
 *
 * Unlike payment verification, webhook signature uses the raw request body
 * (not a constructed string) and RAZORPAY_WEBHOOK_SECRET (different from key secret).
 */
export function verifyRazorpayWebhookSignature(
  rawBody:   string,
  signature: string
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Missing RAZORPAY_WEBHOOK_SECRET env var");
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    // Buffer lengths won't match if signature is malformed
    return false;
  }
}

export const razorpayAdapter: BillingAdapter = {
  provider:    "razorpay",
  createOrder,
};
