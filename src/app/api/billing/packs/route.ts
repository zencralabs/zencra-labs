/**
 * GET /api/billing/packs
 *
 * Returns all active credit packs sorted by sort_order.
 * Public — no authentication required. Used by the credits page
 * to render the top-up options dynamically from the DB.
 *
 * Cache strategy: CDN/edge caches for 60s so pack changes
 * propagate quickly without hammering Supabase on every page load.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CreditPack } from "@/lib/billing/types";

export const revalidate = 60; // ISR — revalidate once per minute

export async function GET() {
  try {
    const { data: packs, error } = await supabaseAdmin
      .from("credit_packs")
      .select("id, name, credits, price_cents, currency, active, sort_order, metadata")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: (packs ?? []) as CreditPack[] },
      {
        headers: {
          // Allow CDN and browser caching — packs change infrequently
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
