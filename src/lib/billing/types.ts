/**
 * Billing types — shared across lib/billing/, API routes, and webhook handlers.
 *
 * Keep this file free of any SDK imports so it can be imported anywhere
 * including client components (for type-only usage).
 */

// ── Enums (mirror DB enums) ───────────────────────────────────────────────────

export type BillingProvider = "razorpay" | "stripe" | "crypto";

export type OrderStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export type FulfillmentState = "pending" | "fulfilled" | "failed";

// ── Credit pack ───────────────────────────────────────────────────────────────

export interface CreditPack {
  id:          string;
  name:        string;
  credits:     number;
  price_cents: number;
  currency:    string;
  active:      boolean;
  sort_order:  number;
  metadata:    {
    color?:       string;
    popular?:     boolean;
    description?: string;
    [key: string]: unknown;
  };
}

// ── Order ─────────────────────────────────────────────────────────────────────

export interface BillingOrder {
  id:                  string;
  user_id:             string;
  credit_pack_id:      string | null;
  provider:            BillingProvider;
  provider_order_id:   string;
  provider_payment_id: string | null;
  amount_cents:        number;
  currency:            string;
  credits_to_grant:    number;
  status:              OrderStatus;
  fulfillment_state:   FulfillmentState;
  idempotency_key:     string | null;
  fulfilled_at:        string | null;
  created_at:          string;
  updated_at:          string;
}

// ── Provider adapter interface ────────────────────────────────────────────────
// Each provider (Razorpay, Stripe) implements this contract.
// The API route calls the adapter — never the provider SDK directly.

export interface CreateOrderParams {
  amountCents:     number;
  currency:        string;
  creditsToGrant:  number;
  idempotencyKey:  string;
  userId:          string;
  metadata?:       Record<string, string>;
}

/** What the adapter returns to the API route after creating the upstream order */
export interface ProviderOrderResult {
  /** The provider's own order/intent ID to store in orders.provider_order_id */
  providerOrderId: string;
  /**
   * Provider-specific data to return to the client so it can open the
   * payment UI. Shape differs per provider:
   *   Razorpay: { razorpayOrderId, amount, currency, keyId }
   *   Stripe:   { clientSecret }
   */
  clientPayload:   Record<string, unknown>;
}

export interface BillingAdapter {
  provider:    BillingProvider;
  createOrder: (params: CreateOrderParams) => Promise<ProviderOrderResult>;
}

// ── Verify (Razorpay client-side verification) ────────────────────────────────

export interface RazorpayVerifyPayload {
  orderId:            string;   // our internal orders.id
  razorpayPaymentId:  string;
  razorpayOrderId:    string;
  razorpaySignature:  string;
}

// ── Fulfill result ────────────────────────────────────────────────────────────

export interface FulfillResult {
  success:    boolean;
  newBalance?: number;
  error?:     string;
}
