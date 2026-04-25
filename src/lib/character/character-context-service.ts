import { CharacterService } from './character-service';
import { SoulService } from './soul-service';
import { StyleService } from '@/lib/styles/style-service';
import type { CharacterWithRelations } from './types';
import type { SoulId } from './types';
import type { CharacterStyle } from '@/lib/styles/types';

export interface CharacterContext {
  character: CharacterWithRelations;
  soul: SoulId | null;
  styles: CharacterStyle[];
}

/**
 * Single source of truth for character context across all studios.
 * Image Studio, Video Studio, and future Audio Studio must use this
 * instead of assembling character data manually.
 */
export async function getCharacterContext(
  characterId: string,
  userId: string
): Promise<CharacterContext> {
  // Load character + profile together
  const character = await CharacterService.getCharacter(characterId, userId);

  // Load soul — may not exist yet (character in 'draft' state)
  let soul: SoulId | null = null;
  try {
    soul = await SoulService.getSoulByCharacter(characterId);
  } catch {
    soul = null;
  }

  // Load applied styles
  let styles: CharacterStyle[] = [];
  try {
    styles = await StyleService.listCharacterStyles(characterId, userId);
  } catch {
    styles = [];
  }

  return { character, soul, styles };
}
