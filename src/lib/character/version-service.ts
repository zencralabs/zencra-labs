import { supabaseAdmin } from '@/lib/supabase/admin';

export type VersionType = 'base' | 'refine' | 'lookbook' | 'scene' | 'upscale' | 'motion';

export class VersionService {
  static async getVersionsForCharacter(characterId: string) {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('character_versions')
      .select('*, assets(id, url, type)')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  static async createVersion(payload: {
    character_id: string;
    soul_id?: string;
    parent_version_id?: string;
    asset_id?: string;
    version_type: VersionType;
    metadata?: Record<string, unknown>;
  }) {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('character_versions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
