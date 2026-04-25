import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Character, CharacterProfile, CharacterStatus, CharacterType, CharacterWithRelations } from './types';

export class CharacterService {
  static async createCharacter(userId: string, payload: {
    name: string;
    project_id?: string;
    platform_intent?: string;
    notes?: string;
    description?: string; // legacy compat — ignored (not a DB column)
    profile?: {
      character_type?: CharacterType;
      age_range?: string;
      gender_presentation?: string;
      ethnicity_description?: string;
      body_type?: string;
      personality_traits?: string[];
      style_preferences?: Record<string, unknown>;
      appearance_prompt?: string;
      negative_prompt?: string;
    };
  }): Promise<CharacterWithRelations> {
    const supabase = supabaseAdmin;

    // The characters table still has the legacy soul_id text column (NOT NULL).
    // Generate a placeholder — soul_ids table is authoritative going forward.
    const placeholderSoulId = `soul_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const { data: character, error: charError } = await supabase
      .from('characters')
      .insert({
        user_id: userId,
        name: payload.name,
        project_id: payload.project_id ?? null,
        platform_intent: payload.platform_intent ?? null,
        notes: payload.notes ?? null,
        status: 'active',
        // Legacy required columns
        soul_id: placeholderSoulId,
        appearance_prompt: '',
        visual_style: 'cinematic',
      })
      .select()
      .single();

    if (charError || !character) throw new Error(charError?.message ?? 'Failed to create character');

    const { data: profile, error: profileError } = await supabase
      .from('character_profiles')
      .insert({
        character_id: character.id,
        character_type: payload.profile?.character_type ?? 'custom',
        age_range: payload.profile?.age_range ?? null,
        gender_presentation: payload.profile?.gender_presentation ?? null,
        ethnicity_description: payload.profile?.ethnicity_description ?? null,
        body_type: payload.profile?.body_type ?? null,
        personality_traits: payload.profile?.personality_traits ?? [],
        style_preferences: payload.profile?.style_preferences ?? {},
        appearance_prompt: payload.profile?.appearance_prompt ?? null,
        negative_prompt: payload.profile?.negative_prompt ?? null,
      })
      .select()
      .single();

    if (profileError) throw new Error(profileError.message);

    return { ...character, profile: profile ?? undefined } as unknown as CharacterWithRelations;
  }

  static async getCharacter(characterId: string, userId: string): Promise<CharacterWithRelations> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('characters')
      .select('*, character_profiles(*)')
      .eq('id', characterId)
      .eq('user_id', userId)
      .neq('status', 'archived')
      .single();
    if (error || !data) throw new Error('Character not found');
    const { character_profiles, ...char } = data as Record<string, unknown> & { character_profiles?: CharacterProfile[] };
    return { ...char, profile: character_profiles?.[0] ?? undefined } as unknown as CharacterWithRelations;
  }

  static async listCharacters(userId: string, projectIdOrFilters?: string | { project_id?: string; status?: CharacterStatus }): Promise<CharacterWithRelations[]> {
    const supabase = supabaseAdmin;
    // Support both old signature (projectId string) and new (filters object)
    const projectId = typeof projectIdOrFilters === 'string' ? projectIdOrFilters : projectIdOrFilters?.project_id;
    const statusFilter = typeof projectIdOrFilters === 'object' ? projectIdOrFilters?.status : undefined;

    let query = supabase
      .from('characters')
      .select('*, character_profiles(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (statusFilter) query = query.eq('status', statusFilter);
    else query = query.neq('status', 'archived');

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, unknown> & { character_profiles?: CharacterProfile[] }) => {
      const { character_profiles, ...char } = row;
      return { ...char, profile: character_profiles?.[0] ?? undefined } as unknown as CharacterWithRelations;
    });
  }

  static async updateCharacter(characterId: string, userId: string, updates: Partial<Pick<Character, 'name' | 'platform_intent' | 'notes' | 'cover_asset_id' | 'project_id'>> & Record<string, unknown>): Promise<Character> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('characters')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', characterId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) throw new Error('Failed to update character');
    return data as unknown as Character;
  }

  static async archiveCharacter(characterId: string, userId: string): Promise<void> {
    const supabase = supabaseAdmin;
    const { error } = await supabase
      .from('characters')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', characterId)
      .eq('user_id', userId);
    if (error) throw new Error('Failed to archive character');
  }

  /** @deprecated Use archiveCharacter instead. Kept for backward compat. */
  static async deleteCharacter(characterId: string, userId: string): Promise<void> {
    const supabase = supabaseAdmin;
    const { error } = await supabase
      .from('characters')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', characterId)
      .eq('user_id', userId);
    if (error) throw new Error('Failed to delete character');
  }
}
