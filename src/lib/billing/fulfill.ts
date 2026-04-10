/**
 * fulfillOrder — TypeScript wrapper around the fulfill_order Postgres RPC.
 *
 * This is the ONLY place in the codebase that grants credits after a payment.
 * Both /api/billing/verify and /api/webhooks/* call this function.
 *
 * The underlying RPC is:
 *   • Idempotent  — safe to call twice; second call is a no-op
 *   • Atomic      — credits + ledger + order state update in one transaction
 *   • Race-safe   — row-locks the order before checking fulfillment_state
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FulfillResult } from "./types";

export async function fulfillOrder(
  orderId:            string,
  providerPaymentId:  string
): Promise<FulfillResult> {
  const { data, error } = await supabaseAdmin.rpc("fulfill_order", {
    p_order_id:            orderId,
    p_provider_payment_id: providerPaymentId,
  });

  if (error) {
    console.error("[fulfillOrder] RPC error:", error.message, { orderId, providerPaymentId });
    return { success: false, error: error.message };
  }

  const row = data?.[0];

  if (!row?.success) {
    console.error("[fulfillOrder] RPC returned failure:", row?.error_message, { orderId });
    return { success: false, error: row?.error_message ?? "Fulfillment failed" };
  }

  return { success: true, newBalance: row.new_balance };
}

/**
 * markOrderFulfillmentFailed — called when fulfillOrder throws unexpectedly.
 * Marks the order so a retry job can pick it up later.
 * Does NOT roll back the payment — the money was already captured.
 */
export async function markOrderFulfillmentFailed(
  orderId: string,
  reason:  string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      fulfillment_state: "failed",
      updated_at:        new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("fulfillment_state", "pending");  // only update if still pending

  if (error) {
    console.error("[markOrderFulfillmentFailed]", error.message, { orderId, reason });
  }
}
