// ─────────────────────────────────────────────────────────────────────────────
// Identity Lock Service
//
// Handles:
//   - Building identity signatures from profile data
//   - Creating the identity_lock record at selection time
//   - Updating ai_influencers with hero_asset_id + identity_lock_id
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  AIInfluencer,
  AIInfluencerProfile,
  IdentityLock,
  InfluencerAsset,
  AppearanceSignature,
  StyleSignature,
  BodySignature,
  FaceEmbedding,
} from "./types";

// ── Signature builders ────────────────────────────────────────────────────────

function buildAppearanceSignature(profile: AIInfluencerProfile): AppearanceSignature {
  return {
    skin_tone:     profile.skin_tone     ?? undefined,
    face_structure: profile.face_structure ?? undefined,
    age_range:     profile.age_range     ?? undefined,
    gender:        profile.gender        ?? undefined,
    // hair and eye_area: derived from appearance_notes if present
    ...(profile.appearance_notes
      ? { appearance_notes: profile.appearance_notes }
      : {}),
  };
}

function buildStyleSignature(profile: AIInfluencerProfile): StyleSignature {
  return {
    fashion_style:   profile.fashion_style   ?? undefined,
    realism_level:   profile.realism_level   ?? undefined,
    mood:            profile.mood.length > 0  ? profile.mood            : undefined,
    platform_intent: profile.platform_intent.length > 0 ? profile.platform_intent : undefined,
  };
}

function buildBodySignature(profile: AIInfluencerProfile): BodySignature {
  return {
    gender_presentation: profile.gender ?? undefined,
    // height_estimate and build: stubs — future embedding provider fills these
    build:            "standard",
    height_estimate:  "medium",
  };
}

const STUB_FACE_EMBEDDING: FaceEmbedding = {
  provider: "stub",
  version: "v0",
  data: {},
  status: "pending_embedding",
};

// ── Create identity lock (called at selection time) ───────────────────────────

export interface CreateIdentityLockInput {
  influencer_id: string;
  candidate_url: string;
  profile: AIInfluencerProfile;
}

export interface CreateIdentityLockResult {
  asset: InfluencerAsset;
  lock: IdentityLock;
  influencer: AIInfluencer;
}

export async function createIdentityLock(
  input: CreateIdentityLockInput,
): Promise<CreateIdentityLockResult> {
  const supabase = supabaseAdmin;
  const { influencer_id, candidate_url, profile } = input;

  // ── 1. Persist candidate as hero asset ────────────────────────────────────
  const { data: asset, error: assetErr } = await supabase
    .from("influencer_assets")
    .insert({
      influencer_id,
      asset_type: "candidate",
      url: candidate_url,
      thumbnail_url: candidate_url,
      is_hero: true,
      metadata: { selected_at: new Date().toISOString() },
    })
    .select()
    .single();

  if (assetErr || !asset) {
    throw new Error(`Failed to persist candidate asset: ${assetErr?.message}`);
  }

  // ── 2. Build identity signatures from profile ─────────────────────────────
  const appearance_signature = buildAppearanceSignature(profile);
  const style_signature      = buildStyleSignature(profile);
  const body_signature       = buildBodySignature(profile);

  // ── 3. Create identity lock ───────────────────────────────────────────────
  const { data: lock, error: lockErr } = await supabase
    .from("identity_locks")
    .insert({
      influencer_id,
      canonical_asset_id:    asset.id,
      reference_asset_ids:   [asset.id],
      face_embedding:        STUB_FACE_EMBEDDING,
      appearance_signature,
      style_signature,
      body_signature,
      identity_strength_score: 1.0,
    })
    .select()
    .single();

  if (lockErr || !lock) {
    throw new Error(`Failed to create identity lock: ${lockErr?.message}`);
  }

  // ── 4. Update asset with identity_lock_id ────────────────────────────────
  await supabase
    .from("influencer_assets")
    .update({ identity_lock_id: lock.id })
    .eq("id", asset.id);

  // ── 5. Promote influencer to active ──────────────────────────────────────
  const { data: influencer, error: updateErr } = await supabase
    .from("ai_influencers")
    .update({
      hero_asset_id:    asset.id,
      identity_lock_id: lock.id,
      thumbnail_url:    candidate_url,
      status:           "active",
      updated_at:       new Date().toISOString(),
    })
    .eq("id", influencer_id)
    .select()
    .single();

  if (updateErr || !influencer) {
    throw new Error(`Failed to promote influencer: ${updateErr?.message}`);
  }

  return {
    asset: asset as InfluencerAsset,
    lock:  lock  as IdentityLock,
    influencer: influencer as AIInfluencer,
  };
}
