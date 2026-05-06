/**
 * Feature Gate — Studio and Provider Guards for API Routes
 *
 * Every studio generate route calls guardStudio() before dispatching.
 * Provider-level checks call guardProvider() when a specific adapter
 * needs an explicit flag in addition to its registry status.
 *
 * All gates return NextResponse | null — if non-null, return it immediately.
 *
 * Usage:
 *   const gate = guardStudio("image");
 *   if (gate) return gate;
 */

import type { NextResponse } from "next/server";
import { isStudioEnabled, isProviderEnabled } from "@/lib/providers/core/feature-flags";
import type { StudioType } from "@/lib/providers/core/types";
import type { ProviderFamily } from "@/lib/providers/core/types";
import { featureDisabled } from "./route-utils";

// ─────────────────────────────────────────────────────────────────────────────
// STUDIO GATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an error response if the entire studio is disabled via feature flags.
 * Returns null if the studio is enabled and the route should proceed.
 */
export function guardStudio(studio: StudioType): NextResponse | null {
  if (!isStudioEnabled(studio)) {
    return featureDisabled(`${studioLabel(studio)} is not currently available`);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER GATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an error response if a specific provider is disabled.
 * Use when a route exposes a single provider and needs a crisp error.
 * The orchestrator also enforces this — this is a fast pre-flight guard.
 */
export function guardProvider(provider: ProviderFamily): NextResponse | null {
  if (!isProviderEnabled(provider)) {
    return featureDisabled(`${provider} provider is not currently available`);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FCS ACCESS GATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a user has FCS (Frame Capture Studio) access.
 * In Phase 1, FCS is entirely disabled — this always returns false
 * unless ZENCRA_FLAG_FCS_ENABLED=true AND the user has the fcs_access flag.
 *
 * The fcs_access flag is stored in the user's profile row in Supabase
 * (column: fcs_access boolean, defaults to false).
 *
 * Returns true if the user may call FCS routes; false otherwise.
 */
export async function hasFCSAccess(
  userId: string,
  supabase: import("@supabase/supabase-js").SupabaseClient
): Promise<boolean> {
  // Primary guard: global FCS flag must be on
  if (!isStudioEnabled("fcs")) return false;

  // Secondary guard: user must have fcs_access on their profile
  const { data, error } = await supabase
    .from("profiles")
    .select("fcs_access")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return data.fcs_access === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function studioLabel(studio: StudioType): string {
  const labels: Record<StudioType, string> = {
    image:     "Image Studio",
    video:     "Video Studio",
    audio:     "Audio Studio",
    character: "Character Studio",
    ugc:       "UGC Studio",
    fcs:       "Future Cinema Studio",
    lipsync:   "Lip Sync Studio",
  };
  return labels[studio] ?? studio;
}
