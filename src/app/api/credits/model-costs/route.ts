/**
 * GET /api/credits/model-costs
 *
 * Returns the live credit_model_costs table for frontend verification.
 * Used by the pre-dispatch safety check to confirm the UI-displayed cost
 * matches what the backend would charge.
 *
 * Response shape:
 *   { success: true, data: Record<string, number> }
 *
 * Auth: required — only authenticated users can read costs.
 * Caching: 60 s (prices change rarely, not per-request sensitive).
 */

import { NextResponse }   from "next/server";
import { supabaseAdmin }  from "@/lib/supabase/admin";
import { getAuthUser }    from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("credit_model_costs")
      .select("model_key, base_credits")
      .eq("active", true)
      .order("model_key");

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Build a flat map: { "nano-banana-pro": 12, "kling-30": 320, ... }
    const costs: Record<string, number> = {};
    for (const row of (data ?? []) as Array<{ model_key: string; base_credits: number }>) {
      costs[row.model_key] = row.base_credits;
    }

    return NextResponse.json(
      { success: true, data: costs },
      {
        headers: {
          // Cache for 60 seconds — prices rarely change
          "Cache-Control": "private, max-age=60",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
