import { supabaseAdmin } from '@/lib/supabase/admin';
import type { SoulId } from './types';

function generateSoulCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'SOUL-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class SoulService {
  // ── New Phase 3B API ────────────────────────────────────────────────────────

  static async createSoulId(characterId: string, payload: {
    identity_prompt: string;
    style_dna?: Record<string, unknown>;
    reference_asset_ids?: string[];
  }): Promise<SoulId> {
    const supabase = supabaseAdmin;

    // Enforce one soul per character (DB UNIQUE constraint also enforces this)
    const existing = await SoulService.getSoulByCharacter(characterId).catch(() => null);
    if (existing) throw new Error('Character already has a Soul ID. Use updateSoulScores to modify it.');

    let soul_code: string = generateSoulCode();
    let attempts = 0;
    while (true) {
      const { data: conflict } = await supabase.from('soul_ids').select('id').eq('soul_code', soul_code).single();
      if (!conflict) break;
      if (++attempts > 10) throw new Error('Failed to generate unique soul code');
      soul_code = generateSoulCode();
    }

    const { data, error } = await supabase
      .from('soul_ids')
      .insert({
        character_id: characterId,
        soul_code,
        identity_prompt: payload.identity_prompt,
        style_dna: payload.style_dna ?? {},
        reference_asset_ids: payload.reference_asset_ids ?? [],
        embedding_status: 'pending',
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to create Soul ID');
    return data as unknown as SoulId;
  }

  static async getSoulByCharacter(characterId: string): Promise<SoulId> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('soul_ids')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) throw new Error('Soul ID not found for character');
    return data as unknown as SoulId;
  }

  static async updateSoulScores(soulId: string, updates: {
    consistency_score?: number;
    identity_strength?: number;
    style_match_score?: number;
    embedding_status?: 'pending' | 'ready' | 'failed' | 'disabled';
    embedding_provider?: string;
    embedding_id?: string;
    embedding_version?: string;
  }): Promise<SoulId> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('soul_ids')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', soulId)
      .select()
      .single();
    if (error || !data) throw new Error('Failed to update Soul ID');
    return data as unknown as SoulId;
  }

  static async getSoulById(soulId: string): Promise<SoulId> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase.from('soul_ids').select('*').eq('id', soulId).single();
    if (error || !data) throw new Error('Soul ID not found');
    return data as unknown as SoulId;
  }

  // ── Legacy Phase 3A API (preserved for backward compat) ────────────────────

  /** @deprecated Use getSoulByCharacter instead. Returns array for legacy compat. */
  static async getSoulsForCharacter(characterId: string): Promise<SoulId[]> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('soul_ids')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as SoulId[];
  }

  /** @deprecated Use getSoulById instead. */
  static async getSoul(soulId: string): Promise<SoulId> {
    return SoulService.getSoulById(soulId);
  }

  /** @deprecated Use createSoulId for new characters. Uses legacy soul_code format for compat. */
  static async createSoul(characterId: string, payload: {
    identity_prompt?: string;
    style_dna?: Record<string, unknown>;
    reference_asset_ids?: string[];
  }): Promise<SoulId> {
    return SoulService.createSoulId(characterId, {
      identity_prompt: payload.identity_prompt ?? '',
      style_dna: payload.style_dna,
      reference_asset_ids: payload.reference_asset_ids,
    });
  }

  /** @deprecated Use updateSoulScores instead. */
  static async updateSoul(soulId: string, updates: {
    identity_prompt?: string;
    style_dna?: Record<string, unknown>;
    reference_asset_ids?: string[];
    consistency_score?: number;
    embedding_provider?: string;
    embedding_id?: string;
    embedding_version?: string;
  }): Promise<SoulId> {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('soul_ids')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', soulId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as SoulId;
  }
}
