import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Style, CharacterStyle, StyleCategory } from './types';

export class StyleService {
  static async listStyles(userId: string, filters?: { category?: StyleCategory; include_system?: boolean }): Promise<Style[]> {
    const supabase = supabaseAdmin;
    const includeSystem = filters?.include_system !== false;

    let data: Style[] = [];
    if (includeSystem) {
      const { data: systemStyles } = await supabase
        .from('styles')
        .select('*')
        .eq('is_system', true)
        .eq('is_active', true);
      data = [...(systemStyles ?? [])] as Style[];
    }

    const { data: userStyles } = await supabase
      .from('styles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    data = [...data, ...(userStyles ?? [])] as Style[];

    if (filters?.category) data = data.filter(s => s.category === filters.category);
    return data;
  }

  static async createUserStyle(userId: string, payload: {
    name: string;
    category: StyleCategory;
    description?: string;
    prompt_template: string;
    negative_prompt?: string;
  }): Promise<Style> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('styles')
      .insert({
        user_id: userId,
        name: payload.name,
        category: payload.category,
        description: payload.description ?? null,
        prompt_template: payload.prompt_template,
        negative_prompt: payload.negative_prompt ?? null,
        is_system: false,
        is_active: true,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to create style');
    return data as unknown as Style;
  }

  static async applyStyleToCharacter(characterId: string, userId: string, styleId: string, options?: {
    weight?: number;
    is_primary?: boolean;
  }): Promise<CharacterStyle> {
    const supabase = supabaseAdmin;
    // Verify character ownership
    const { data: char } = await supabase.from('characters').select('id').eq('id', characterId).eq('user_id', userId).single();
    if (!char) throw new Error('Character not found or unauthorized');

    const weight = Math.min(1.0, Math.max(0, options?.weight ?? 1.0));

    // If setting as primary, unset existing primary
    if (options?.is_primary) {
      await supabase.from('character_styles').update({ is_primary: false }).eq('character_id', characterId).eq('is_primary', true);
    }

    const { data, error } = await supabase
      .from('character_styles')
      .upsert(
        { character_id: characterId, style_id: styleId, weight, is_primary: options?.is_primary ?? false },
        { onConflict: 'character_id,style_id' }
      )
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to apply style');
    return data as unknown as CharacterStyle;
  }

  static async removeStyleFromCharacter(characterId: string, userId: string, styleId: string): Promise<void> {
    const supabase = supabaseAdmin;
    const { data: char } = await supabase.from('characters').select('id').eq('id', characterId).eq('user_id', userId).single();
    if (!char) throw new Error('Character not found or unauthorized');
    await supabase.from('character_styles').delete().eq('character_id', characterId).eq('style_id', styleId);
  }

  static async listCharacterStyles(characterId: string, userId: string): Promise<CharacterStyle[]> {
    const supabase = supabaseAdmin;
    const { data: char } = await supabase.from('characters').select('id').eq('id', characterId).eq('user_id', userId).single();
    if (!char) throw new Error('Character not found or unauthorized');
    const { data, error } = await supabase.from('character_styles').select('*, styles(*)').eq('character_id', characterId);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as CharacterStyle[];
  }
}
