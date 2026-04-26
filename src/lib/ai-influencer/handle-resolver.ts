// ─────────────────────────────────────────────────────────────────────────────
// AI Influencer Handle Resolver
//
// Detects @Handle mentions in prompts and resolves them to influencer identity
// context (influencer_id, identity_lock_id, canonical_asset_id).
//
// Used by Image Studio, Video Studio, Creative Director to automatically
// apply influencer identity locks when a user types "@Nova walking through..."
//
// Usage:
//   const resolved = await resolveInfluencerHandles({ userId, prompt });
//   // resolved.influencerContext → array of matched influencer contexts
//   // resolved.cleanedPrompt    → prompt with handles replaced by clean name
//   // resolved.primaryContext   → first/primary influencer (if any)
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InfluencerIdentityContext {
  handle:             string;   // e.g. "nova"
  displayName:        string;   // e.g. "Nova"
  influencer_id:      string;
  identity_lock_id:   string;
  canonical_asset_id: string;
  canonical_asset_url: string | null;
}

export interface ResolvedPrompt {
  /** Original prompt, unchanged */
  originalPrompt: string;
  /** Prompt with @handles replaced by clean display names */
  cleanedPrompt: string;
  /** All influencer contexts found in this prompt */
  influencerContexts: InfluencerIdentityContext[];
  /**
   * Primary influencer (first match, or the only one).
   * Generation routes inject this context into their requests.
   */
  primaryContext: InfluencerIdentityContext | null;
  /** True if any handles were found and resolved */
  hasInfluencers: boolean;
}

// ── Handle pattern — matches @word tokens ─────────────────────────────────────

const HANDLE_PATTERN = /@([a-zA-Z][a-zA-Z0-9_]{0,30})/g;

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Parses a prompt for @Handle mentions and resolves each to its influencer
 * identity context, querying the database for this user's influencers.
 *
 * Only active influencers with an identity lock are resolved.
 * Unknown handles are left as-is in the cleaned prompt.
 */
export async function resolveInfluencerHandles({
  userId,
  prompt,
}: {
  userId: string;
  prompt: string;
}): Promise<ResolvedPrompt> {
  // Extract all unique @handles from the prompt
  const matches = [...prompt.matchAll(HANDLE_PATTERN)];
  const rawHandles = [...new Set(matches.map(m => m[1].toLowerCase()))];

  if (rawHandles.length === 0) {
    return {
      originalPrompt:     prompt,
      cleanedPrompt:      prompt,
      influencerContexts: [],
      primaryContext:     null,
      hasInfluencers:     false,
    };
  }

  // Look up all matching active influencers for this user
  const { data: influencers, error } = await supabaseAdmin
    .from("ai_influencers")
    .select(`
      id,
      handle,
      display_name,
      identity_lock_id,
      hero_asset_id,
      status,
      influencer_assets!hero_asset_id (
        id,
        url
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .in("handle", rawHandles)
    .not("identity_lock_id", "is", null)
    .not("hero_asset_id", "is", null);

  if (error || !influencers || influencers.length === 0) {
    // No matches — return prompt unchanged
    return {
      originalPrompt:     prompt,
      cleanedPrompt:      prompt,
      influencerContexts: [],
      primaryContext:     null,
      hasInfluencers:     false,
    };
  }

  // Build context map: handle → context
  const contextMap = new Map<string, InfluencerIdentityContext>();

  for (const inf of influencers) {
    if (!inf.handle || !inf.identity_lock_id || !inf.hero_asset_id) continue;

    // hero_asset_id is a FK — the join returns the asset row
    // Supabase joins return arrays even for single FK references
    const assetRows = Array.isArray(inf.influencer_assets)
      ? inf.influencer_assets
      : inf.influencer_assets
        ? [inf.influencer_assets]
        : [];
    const heroAsset = assetRows[0] as { id: string; url: string } | undefined;

    contextMap.set(inf.handle, {
      handle:              inf.handle,
      displayName:         inf.display_name ?? inf.handle,
      influencer_id:       inf.id,
      identity_lock_id:    inf.identity_lock_id,
      canonical_asset_id:  inf.hero_asset_id,
      canonical_asset_url: heroAsset?.url ?? null,
    });
  }

  // Replace each @Handle in the prompt with the clean display name
  let cleanedPrompt = prompt;
  const influencerContexts: InfluencerIdentityContext[] = [];

  // Reset regex lastIndex (needed after matchAll)
  HANDLE_PATTERN.lastIndex = 0;

  cleanedPrompt = prompt.replace(HANDLE_PATTERN, (_match, rawName) => {
    const ctx = contextMap.get(rawName.toLowerCase());
    if (!ctx) return _match; // unknown handle — keep as-is
    if (!influencerContexts.some(c => c.influencer_id === ctx.influencer_id)) {
      influencerContexts.push(ctx);
    }
    return ctx.displayName;
  });

  return {
    originalPrompt:     prompt,
    cleanedPrompt,
    influencerContexts,
    primaryContext:     influencerContexts[0] ?? null,
    hasInfluencers:     influencerContexts.length > 0,
  };
}

// ── Identity injection helper ─────────────────────────────────────────────────

/**
 * Builds the identity anchor text that should be prepended to any prompt
 * when an influencer context is active.
 *
 * This is the same anchor phrase injected by buildBaseIdentity() in pack-prompts.ts
 * to maintain consistency across all generation paths.
 */
export function buildIdentityAnchor(displayName: string): string {
  return `Same person. Same face. Same identity as ${displayName}. Do not change facial structure, skin tone, age, or identity.`;
}

/**
 * Prepends identity anchor to a cleaned prompt when an influencer is active.
 *
 * Input:  "Nova walking through a luxury hotel lobby"
 * Output: "Same person. Same face. Same identity as Nova. Do not change facial structure, skin tone, age, or identity. Nova walking through a luxury hotel lobby"
 */
export function injectIdentityIntoPrompt(
  cleanedPrompt: string,
  ctx: InfluencerIdentityContext,
): string {
  const anchor = buildIdentityAnchor(ctx.displayName);
  return `${anchor} ${cleanedPrompt}`;
}
