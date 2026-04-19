/**
 * Zencra Character Studio — Identity System
 *
 * Types, contracts, and helpers for the identity-first architecture.
 * All character generation — across ALL studios — must carry IdentityContext.
 *
 * Rules:
 *   - No character provider call without character_id or soul_id
 *   - character_id is globally reusable across Image, Video, Audio, UGC
 *   - soul_id binds voice + personality + style to a character identity
 *   - Identity context must propagate to every downstream provider call
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORE IDENTITY TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A persistent digital human identity. */
export interface CharacterIdentity {
  character_id: string;           // Zencra-generated UUID for this character
  soul_id?: string;               // soul binding (voice + personality + style)
  display_name?: string;
  created_by: string;             // user_id
  created_at: string;

  // Reference data for consistency scoring
  reference_urls: string[];       // source identity images used for generation
  embedding_ref?: string;         // future: embedding vector reference

  // Cross-studio availability
  available_in_image:   boolean;
  available_in_video:   boolean;
  available_in_audio:   boolean;
  available_in_ugc:     boolean;
}

/** A soul binding — voice + personality + visual style attached to a character. */
export interface SoulID {
  soul_id: string;
  character_id: string;
  voice_provider?: string;        // e.g. "elevenlabs"
  voice_id?: string;              // e.g. ElevenLabs voice ID
  personality_description?: string;
  visual_style_description?: string;
  created_at: string;
}

/** Identity context passed into every provider call that is character-aware. */
export interface IdentityContext {
  character_id?: string;
  soul_id?: string;
  reference_urls?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY GENERATION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended input for Character Studio generation.
 * Enforces identity context — all character calls must include at minimum
 * a character_id (or signal intent to create a new one).
 */
export interface CharacterGenerationContext {
  // Identity — at least one must be present for non-creation calls
  character_id?: string;
  soul_id?: string;
  is_new_character?: boolean;     // true = creating a new identity from scratch

  // Reference materials
  reference_urls?: string[];

  // Character Studio tool being used
  tool:
    | "influencer-builder"        // FLUX: new identity creation
    | "character-trainer"         // FLUX + embedding prep
    | "soul-id"                   // internal system only
    | "lookbook"                  // FLUX + Stability
    | "scene-builder"             // Stability
    | "refinement"                // Stability: inpaint / outpaint / upscale
    | "motion-starter";           // Motion abstraction: image → video
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET TRACKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metadata stored with every Character Studio asset output.
 * All character assets must reference the generating job + identity.
 */
export interface CharacterAssetMetadata {
  user_id: string;
  character_id: string;
  soul_id?: string;

  // Generation
  provider: string;
  model_key: string;
  job_id: string;
  generation_status: "pending" | "success" | "error";

  // Asset type
  asset_type:
    | "reference"         // source identity image uploaded by user
    | "generated"         // AI-generated character output
    | "refined"           // Stability AI refinement
    | "scene"             // scene expansion output
    | "motion";           // motion clip output

  // Provider metadata
  prompt?: string;
  seed?: number;
  provider_job_id?: string;

  // Storage
  storage_path?: string;
  public_url?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a new character ID. Format: chr_{timestamp}_{random} */
export function newCharacterId(): string {
  return `chr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a new soul ID. Format: soul_{timestamp}_{random} */
export function newSoulId(): string {
  return `soul_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Assert that an identity context is present for non-creation calls.
 * Throws if neither character_id nor soul_id is provided and is_new_character is false.
 */
export function assertIdentityContext(
  ctx: CharacterGenerationContext,
  callerLabel: string,
): void {
  if (ctx.is_new_character) return; // creating new — no ID required yet
  if (ctx.character_id || ctx.soul_id) return; // identity present

  throw new Error(
    `[${callerLabel}] Identity context required. ` +
    `Provide character_id or soul_id, or set is_new_character: true for new identity creation.`
  );
}

/**
 * Build a cross-studio identity context from a CharacterGenerationContext.
 * Safe to pass into ZProviderInput.identity.
 */
export function buildIdentityContext(ctx: CharacterGenerationContext): IdentityContext {
  return {
    character_id:   ctx.character_id,
    soul_id:        ctx.soul_id,
    reference_urls: ctx.reference_urls ?? [],
  };
}
