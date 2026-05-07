/**
 * GET /api/credits/model-costs
 *
 * Returns the live credit_model_costs table as a pricing manifest.
 *
 * ── Phase 1 ────────────────────────────────────────────────────────────────────
 *   Used by the pre-dispatch safety check to confirm the UI-displayed cost
 *   matches what the backend would charge.
 *
 * ── Phase 2 ────────────────────────────────────────────────────────────────────
 *   The frontend pricing engine (calculateCreditCost) will fetch this manifest
 *   at app boot and pass it as PricingConfig to calculateCreditCost(). The
 *   engine's static fallback tables can then be deleted.
 *
 *   When Phase 2 is ready, the frontend should:
 *     1. Fetch this endpoint at boot (cached 60s)
 *     2. Pass the response as PricingConfig to calculateCreditCost()
 *     3. Delete STATIC_QUALITY_MULTIPLIERS + STATIC_ADDON_COSTS from engine.ts
 *     4. Delete MODEL_BASE_CREDITS from model-costs.ts
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       baseCosts: Record<string, number>,               // model_key → base_credits
 *       qualityMultipliers: Record<string, Record<string, number>>,  // model_key → tier → multiplier
 *       addonCosts: Record<string, number>,              // addon_key → credits
 *     }
 *   }
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
      .select("model_key, base_credits, quality_multipliers")
      .eq("active", true)
      .order("model_key");

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Build three separate maps for clean consumption by the engine.
    //
    // baseCosts:           { "nano-banana-pro": 12, "kling-30": 320, ... }
    // qualityMultipliers:  { "nano-banana-pro": { "1K": 1.0, "2K": 1.25, "4K": 1.75 }, ... }
    // addonCosts:          { "addon-start-end": 80, ... }
    //
    // Add-on rows are identified by model_key starting with "addon-".
    // They are separated out so the frontend engine can pass them as PricingConfig.addonCosts.
    const baseCosts:          Record<string, number>                       = {};
    const qualityMultipliers: Record<string, Record<string, number>>       = {};
    const addonCosts:         Record<string, number>                       = {};

    type Row = { model_key: string; base_credits: number; quality_multipliers: Record<string, number> | null };

    for (const row of (data ?? []) as Row[]) {
      const { model_key, base_credits, quality_multipliers } = row;

      // Add-on rows go into addonCosts, not baseCosts
      if (model_key.startsWith("addon-")) {
        addonCosts[model_key] = base_credits;
      } else {
        baseCosts[model_key] = base_credits;
      }

      // Quality multipliers are set only on rows where the DB has them.
      // NULL rows → engine falls back to STATIC_QUALITY_MULTIPLIERS (same values in Phase 1).
      if (quality_multipliers && typeof quality_multipliers === "object") {
        qualityMultipliers[model_key] = quality_multipliers;
      }
    }

    return NextResponse.json(
      { success: true, data: { baseCosts, qualityMultipliers, addonCosts } },
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
