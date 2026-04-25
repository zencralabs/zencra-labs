import { supabaseAdmin } from '@/lib/supabase/admin';

export class CharacterService {
  static async getCharacter(characterId: string, userId: string) {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('characters')
      .select('*, character_profiles(*)')
      .eq('id', characterId)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  static async listCharacters(userId: string, projectId?: string) {
    const supabase = supabaseAdmin;
    let query = supabase
      .from('characters')
      .select('*, character_profiles(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  static async createCharacter(userId: string, payload: {
    name: string;
    description?: string;
    platform_intent?: string;
    project_id?: string;
  }) {
    const supabase = supabaseAdmin;
    // characters.soul_id is NOT NULL, so generate a placeholder value.
    // The proper soul identity is stored in the soul_ids table going forward.
    const placeholderSoulId = `soul_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
      .from('characters')
      .insert({
        user_id: userId,
        name: payload.name,
        description: payload.description,
        platform_intent: payload.platform_intent,
        project_id: payload.project_id,
        status: 'active',
        // Required legacy column — kept for schema compat but soul_ids table is authoritative
        soul_id: placeholderSoulId,
        appearance_prompt: '',
        visual_style: 'cinematic',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateCharacter(characterId: string, userId: string, updates: Record<string, unknown>) {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('characters')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', characterId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteCharacter(characterId: string, userId: string) {
    const supabase = supabaseAdmin;
    const { error } = await supabase
      .from('characters')
      .update({ status: 'deleted' })
      .eq('id', characterId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}
