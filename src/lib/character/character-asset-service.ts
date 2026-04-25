import { supabaseAdmin } from '@/lib/supabase/admin';
import type { CharacterMode } from './types';

export interface CharacterAsset {
  id: string;
  character_id: string | null;
  soul_id: string | null;
  url: string;
  type: string;
  mode: string | null;
  source_studio: string | null;
  style_ids: string[] | null;
  prompt: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Returns all assets linked to a character, newest first.
 * Abstracts away the raw asset table so UI never queries it directly.
 */
export async function getCharacterAssets(
  characterId: string,
  userId: string
): Promise<CharacterAsset[]> {
  // First verify ownership
  const { data: char, error: charError } = await supabaseAdmin
    .from('characters')
    .select('id')
    .eq('id', characterId)
    .eq('user_id', userId)
    .single();

  if (charError || !char) throw new Error('Character not found or unauthorized');

  // Determine actual asset table name — try 'assets' first, fall back handled by service
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('id, character_id, soul_id, url, type, mode, source_studio, style_ids, prompt, created_at, metadata')
    .eq('character_id', characterId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch character assets: ${error.message}`);
  return (data ?? []) as CharacterAsset[];
}

/**
 * Returns assets for a character filtered by mode.
 * Used by lookbook, scene, motion views in Phase 3B UI.
 */
export async function getCharacterAssetsByMode(
  characterId: string,
  userId: string,
  mode: CharacterMode
): Promise<CharacterAsset[]> {
  const { data: char, error: charError } = await supabaseAdmin
    .from('characters')
    .select('id')
    .eq('id', characterId)
    .eq('user_id', userId)
    .single();

  if (charError || !char) throw new Error('Character not found or unauthorized');

  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('id, character_id, soul_id, url, type, mode, source_studio, style_ids, prompt, created_at, metadata')
    .eq('character_id', characterId)
    .eq('mode', mode)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch character assets: ${error.message}`);
  return (data ?? []) as CharacterAsset[];
}
