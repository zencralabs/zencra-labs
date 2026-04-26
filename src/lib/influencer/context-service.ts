// ─────────────────────────────────────────────────────────────────────────────
// Influencer Context Service — getInfluencerContext()
//
// Called by every API route AFTER /generate (i.e. all pack/refine/save routes).
// Validates ownership, verifies active identity lock, returns full context.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { InfluencerContext } from "./types";

export class InfluencerContextError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "NO_IDENTITY_LOCK" | "DB_ERROR",
    public readonly status: number,
  ) {
    super(message);
    this.name = "InfluencerContextError";
  }
}

/**
 * Fetch and validate full influencer context.
 * Throws InfluencerContextError with appropriate status code on failure.
 *
 * @param influencer_id  The influencer's UUID
 * @param user_id        Authenticated user's UUID (ownership check)
 * @param identity_lock_id  The identity_lock UUID from the request body
 */
export async function getInfluencerContext(
  influencer_id: string,
  user_id: string,
  identity_lock_id: string,
): Promise<InfluencerContext> {
  const supabase = supabaseAdmin;

  // ── 1. Fetch influencer ──────────────────────────────────────────────────
  const { data: influencer, error: infErr } = await supabase
    .from("ai_influencers")
    .select("*")
    .eq("id", influencer_id)
    .single();

  if (infErr || !influencer) {
    throw new InfluencerContextError(
      "Influencer not found",
      "NOT_FOUND",
      404,
    );
  }

  // ── 2. Ownership check ───────────────────────────────────────────────────
  if (influencer.user_id !== user_id) {
    throw new InfluencerContextError(
      "Forbidden",
      "FORBIDDEN",
      403,
    );
  }

  // ── 3. Identity lock must exist ──────────────────────────────────────────
  if (!influencer.identity_lock_id) {
    throw new InfluencerContextError(
      "Influencer has no identity lock. Select a candidate first.",
      "NO_IDENTITY_LOCK",
      400,
    );
  }

  // ── 4. Fetch and cross-validate identity lock ────────────────────────────
  const { data: lock, error: lockErr } = await supabase
    .from("identity_locks")
    .select("*")
    .eq("id", identity_lock_id)
    .eq("influencer_id", influencer_id)
    .single();

  if (lockErr || !lock) {
    throw new InfluencerContextError(
      "Identity lock not found or does not belong to this influencer",
      "NOT_FOUND",
      404,
    );
  }

  // ── 5. Fetch profile ─────────────────────────────────────────────────────
  const { data: profile, error: profErr } = await supabase
    .from("ai_influencer_profiles")
    .select("*")
    .eq("influencer_id", influencer_id)
    .single();

  if (profErr || !profile) {
    throw new InfluencerContextError(
      "Influencer profile not found",
      "DB_ERROR",
      500,
    );
  }

  // ── 6. Fetch canonical asset ─────────────────────────────────────────────
  const { data: canonical_asset, error: assetErr } = await supabase
    .from("influencer_assets")
    .select("*")
    .eq("id", lock.canonical_asset_id)
    .single();

  if (assetErr || !canonical_asset) {
    throw new InfluencerContextError(
      "Canonical asset not found",
      "DB_ERROR",
      500,
    );
  }

  return {
    influencer,
    profile,
    identity_lock: lock,
    canonical_asset,
  };
}
