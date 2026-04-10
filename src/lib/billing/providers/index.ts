/**
 * Provider registry — resolves a BillingProvider string to the correct adapter.
 * Import this in API routes instead of importing adapters directly.
 */
import type { BillingAdapter, BillingProvider } from "../types";
import { razorpayAdapter } from "./razorpay";
import { stripeAdapter }   from "./stripe";

const ADAPTERS: Record<string, BillingAdapter> = {
  razorpay: razorpayAdapter,
  stripe:   stripeAdapter,
  // crypto: cryptoAdapter  — add when ready
};

export function getBillingAdapter(provider: BillingProvider): BillingAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`No billing adapter registered for provider: ${provider}`);
  }
  return adapter;
}

export { razorpayAdapter, stripeAdapter };
