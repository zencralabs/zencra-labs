/**
 * POST /api/billing/orders
 *
 * Creates a billing order:
 *   1. Validates the credit pack exists and is active
 *   2. Creates an order row in our DB (status: 'created')
 *   3. Calls the provider adapter to create the upstream order/intent
 *   4. Updates the order row with provider_order_id
 *   5. Returns the provider-specific clientPayload for the frontend
 *
 * Body:
 *   {
 *     packId:         string               // credit_packs.id
 *     provider:       "razorpay" | "stripe"
 *     idempotencyKey: string               // client-generated, e.g. `${userId}-${packId}-${Date.now()}`
 *   }
 *
 * Response (Razorpay):
 *   {
 *     success: true,
 *     data: {
 *       orderId:         string   // our internal orders.id
 *       provider:        "razorpay"
 *       razorpayOrderId: string
 *       amount:          number   // in paise/cents
 *       currency:        string
 *       keyId:           string   // NEXT_PUBLIC_RAZORPAY_KEY_ID
 *     }
 *   }
 *
 * Response (Stripe):
 *   {
 *     success: true,
 *     data: {
 *       orderId:      string   // our internal orders.id
 *       provider:     "stripe"
 *       clientSecret: string   // for Stripe Elements
 *     }
 *   }
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import { getBillingAdapter } from "@/lib/billing/providers";
import type { BillingProvider, CreditPack } from "@/lib/billing/types";

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

    // ── 2. Validate input ────────────────────────────────────────────────────
    const body = await req.json() as {
      packId?:         string;
      provider?:       string;
      idempotencyKey?: string;
    };

    const { packId, provider, idempotencyKey } = body;

    if (!packId || typeof packId !== "string") {
      return NextResponse.json({ success: false, error: "packId is required" }, { status: 400 });
    }

    if (!provider || !["razorpay", "stripe"].includes(provider)) {
      return NextResponse.json(
        { success: false, error: "provider must be 'razorpay' or 'stripe'" },
        { status: 400 }
      );
    }

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return NextResponse.json({ success: false, error: "idempotencyKey is required" }, { status: 400 });
    }

    // ── 3. Load the pack ─────────────────────────────────────────────────────
    const { data: pack, error: packError } = await supabaseAdmin
      .from("credit_packs")
      .select("id, name, credits, price_cents, currency, active")
      .eq("id", packId)
      .eq("active", true)
      .single();

    if (packError || !pack) {
      return NextResponse.json(
        { success: false, error: "Credit pack not found or inactive" },
        { status: 404 }
      );
    }

    const creditPack = pack as CreditPack;

    // ── 4. Idempotency check — return existing order if key was already used ─
    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("id, provider_order_id, status, fulfillment_state")
      .eq("idempotency_key", idempotencyKey)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingOrder) {
      // Order already created — return the same response so client can retry safely
      return NextResponse.json({
        success: true,
        data: {
          orderId:   existingOrder.id,
          provider,
          // Caller will need to re-fetch provider details if needed,
          // but idempotency_key match means the client already has them
          idempotent: true,
        },
      });
    }

    // ── 5. Create the order row (status: 'created') ──────────────────────────
    const { data: newOrder, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id:          userId,
        credit_pack_id:   creditPack.id,
        provider:         provider as BillingProvider,
        provider_order_id: `pending-${Date.now()}`,   // temporary; updated in step 7
        amount_cents:     creditPack.price_cents,
        currency:         creditPack.currency,
        credits_to_grant: creditPack.credits,
        status:           "created",
        fulfillment_state: "pending",
        idempotency_key:  idempotencyKey,
      })
      .select("id")
      .single();

    if (insertError || !newOrder) {
      return NextResponse.json(
        { success: false, error: insertError?.message ?? "Failed to create order" },
        { status: 500 }
      );
    }

    // ── 6. Call the provider adapter to create the upstream order ────────────
    const adapter = getBillingAdapter(provider as BillingProvider);

    let providerResult;
    try {
      providerResult = await adapter.createOrder({
        amountCents:    creditPack.price_cents,
        currency:       creditPack.currency,
        creditsToGrant: creditPack.credits,
        idempotencyKey,
        userId,
        metadata: { pack_name: creditPack.name },
      });
    } catch (providerErr) {
      // Provider call failed — mark order as failed and surface the error
      await supabaseAdmin
        .from("orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", newOrder.id);

      const msg = providerErr instanceof Error ? providerErr.message : "Provider error";
      console.error("[POST /api/billing/orders] Provider error:", msg);
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }

    // ── 7. Update order with real provider_order_id ──────────────────────────
    await supabaseAdmin
      .from("orders")
      .update({
        provider_order_id: providerResult.providerOrderId,
        status:            "pending",
        updated_at:        new Date().toISOString(),
      })
      .eq("id", newOrder.id);

    // ── 8. Return provider checkout data to client ───────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        orderId:  newOrder.id,
        provider,
        ...providerResult.clientPayload,
      },
    });
  } catch (err) {
    console.error("[POST /api/billing/orders]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
