import { supabaseAdmin } from '@/lib/supabase/admin';
import type { CharacterVersion, CharacterMode } from './types';
import { assertCharacterMode } from './types';

export type VersionType = 'base' | 'refine' | 'lookbook' | 'scene' | 'upscale' | 'motion';

export class VersionService {
  // ── Legacy Phase 3A API (preserved for backward compat) ────────────────────

  static async getVersionsForCharacter(characterId: string): Promise<CharacterVersion[]> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('character_versions')
      .select('*, assets(id, url, type)')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as CharacterVersion[];
  }

  static async createVersion(payload: {
    character_id: string;
    soul_id?: string;
    parent_version_id?: string;
    asset_id?: string;
    version_type?: VersionType;
    mode?: CharacterMode | string;
    version_name?: string;
    prompt_snapshot?: string;
    style_snapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<CharacterVersion> {
    const supabase = supabaseAdmin;

    // Determine mode — prefer explicit mode, fall back to version_type
    const resolvedMode = payload.mode ?? payload.version_type ?? 'base';
    const validatedMode = assertCharacterMode(resolvedMode);

    const { data, error } = await supabase
      .from('character_versions')
      .insert({
        character_id: payload.character_id,
        soul_id: payload.soul_id ?? null,
        parent_version_id: payload.parent_version_id ?? null,
        asset_id: payload.asset_id ?? null,
        version_type: validatedMode,  // legacy column
        mode: validatedMode,           // new column
        version_name: payload.version_name ?? null,
        prompt_snapshot: payload.prompt_snapshot ?? null,
        style_snapshot: payload.style_snapshot ?? {},
        metadata: payload.metadata ?? {},
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CharacterVersion;
  }
}

// ── Phase 3B CharacterVersionService (new class name) ────────────────────────

export class CharacterVersionService {
  static async createCharacterVersion(payload: {
    character_id: string;
    soul_id: string;
    mode: CharacterMode | string;
    asset_id?: string;
    parent_version_id?: string;
    version_name?: string;
    prompt_snapshot?: string;
    style_snapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<CharacterVersion> {
    return VersionService.createVersion(payload);
  }

  static async listCharacterVersions(characterId: string, userId: string): Promise<CharacterVersion[]> {
    const supabase = supabaseAdmin;
    // Verify ownership
    const { data: char } = await supabase.from('characters').select('id').eq('id', characterId).eq('user_id', userId).single();
    if (!char) throw new Error('Character not found or unauthorized');
    return VersionService.getVersionsForCharacter(characterId);
  }

  static async setCoverVersion(characterId: string, userId: string, assetId: string): Promise<void> {
    const supabase = supabaseAdmin;
    const { error } = await supabase
      .from('characters')
      .update({ cover_asset_id: assetId, updated_at: new Date().toISOString() })
      .eq('id', characterId)
      .eq('user_id', userId);
    if (error) throw new Error('Failed to set cover version');
  }
}
