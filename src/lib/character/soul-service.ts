import { supabaseAdmin } from '@/lib/supabase/admin';
import { nanoid } from 'nanoid';

export class SoulService {
  static async getSoulsForCharacter(characterId: string) {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('soul_ids')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  static async getSoul(soulId: string) {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('soul_ids')
      .select('*')
      .eq('id', soulId)
      .single();
    if (error) throw error;
    return data;
  }

  static async createSoul(characterId: string, payload: {
    identity_prompt?: string;
    style_dna?: Record<string, unknown>;
    reference_asset_ids?: string[];
  }) {
    const supabase = supabaseAdmin;
    const soul_code = `soul_${nanoid(12)}`;
    const { data, error } = await supabase
      .from('soul_ids')
      .insert({
        character_id: characterId,
        soul_code,
        identity_prompt: payload.identity_prompt ?? '',
        style_dna: payload.style_dna ?? {},
        reference_asset_ids: payload.reference_asset_ids ?? [],
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateSoul(soulId: string, updates: {
    identity_prompt?: string;
    style_dna?: Record<string, unknown>;
    reference_asset_ids?: string[];
    consistency_score?: number;
  }) {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('soul_ids')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', soulId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
