export type CharacterMode = 'base' | 'refine' | 'lookbook' | 'scene' | 'upscale' | 'motion';
export type CharacterStatus = 'active' | 'archived' | 'draft';
export type CharacterType = 'influencer' | 'avatar' | 'brand' | 'fictional' | 'custom';
export type EmbeddingStatus = 'pending' | 'ready' | 'failed' | 'disabled';

export const CHARACTER_MODES: CharacterMode[] = ['base', 'refine', 'lookbook', 'scene', 'upscale', 'motion'];

export function isCharacterMode(value: unknown): value is CharacterMode {
  return typeof value === 'string' && (CHARACTER_MODES as string[]).includes(value);
}

export function assertCharacterMode(value: unknown): CharacterMode {
  if (!isCharacterMode(value)) {
    throw new Error(`Invalid character mode: ${String(value)}. Must be one of: ${CHARACTER_MODES.join(', ')}`);
  }
  return value;
}

export interface Character {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  status: CharacterStatus;
  cover_asset_id: string | null;
  platform_intent: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterProfile {
  id: string;
  character_id: string;
  character_type: CharacterType;
  age_range: string | null;
  gender_presentation: string | null;
  ethnicity_description: string | null;
  body_type: string | null;
  personality_traits: string[];
  style_preferences: Record<string, unknown>;
  platform_intent: string | null;
  appearance_prompt: string | null;
  negative_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoulId {
  id: string;
  character_id: string;
  soul_code: string;
  identity_prompt: string;
  style_dna: Record<string, unknown>;
  reference_asset_ids: string[];
  consistency_score: number | null;
  identity_strength: number | null;
  style_match_score: number | null;
  embedding_provider: string | null;
  embedding_id: string | null;
  embedding_version: string | null;
  embedding_status: EmbeddingStatus;
  created_at: string;
  updated_at: string;
}

export interface CharacterVersion {
  id: string;
  character_id: string;
  soul_id: string | null;
  parent_version_id: string | null;
  asset_id: string | null;
  version_name: string | null;
  mode: CharacterMode | null;
  /** Legacy column — same semantic as mode. Use mode going forward. */
  version_type?: string;
  prompt_snapshot: string | null;
  style_snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CharacterContext {
  characterId: string;
  soulId: string;
  mode?: CharacterMode;
  styleIds?: string[];
}

export interface CharacterWithRelations extends Character {
  profile?: CharacterProfile;
  soul?: SoulId;
}
