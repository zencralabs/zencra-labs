import type { Character, CharacterProfile, SoulId, CharacterMode } from './types';
import type { Style } from '@/lib/styles/types';

interface PromptBuildInput {
  character: Character;
  profile: CharacterProfile;
  soul: SoulId;
  styles?: Style[];
  mode: CharacterMode;
  userPrompt: string;
}

interface BuiltPrompt {
  prompt: string;
  negativePrompt?: string;
  metadata: Record<string, unknown>;
}

const MODE_INSTRUCTIONS: Record<CharacterMode, string> = {
  base: 'Clean character identity generation. Emphasize face, likeness, and physical traits. Neutral pose and setting.',
  refine: 'Preserve exact identity and likeness. Improve detail quality while maintaining consistency.',
  lookbook: 'Same identity and likeness. New outfit, style, or mood. Maintain face and character consistency.',
  scene: 'Preserve character identity exactly. Place in a specific environment or scene context.',
  upscale: 'Preserve all identity details. Maximize quality and resolution. No style changes.',
  motion: 'Preserve identity. Use motion-friendly description. Clear pose with room for animation.',
};

export function buildCharacterPrompt({
  character,
  profile,
  soul,
  styles = [],
  mode,
  userPrompt,
}: PromptBuildInput): BuiltPrompt {
  const parts: string[] = [];

  // 1. Identity anchor from soul
  if (soul.identity_prompt) {
    parts.push(soul.identity_prompt);
  }

  // 2. Physical traits from profile
  const physicalParts: string[] = [];
  if (profile.appearance_prompt) physicalParts.push(profile.appearance_prompt);
  if (profile.age_range) physicalParts.push(`age ${profile.age_range}`);
  if (profile.body_type) physicalParts.push(profile.body_type);
  if (physicalParts.length) parts.push(physicalParts.join(', '));

  // 3. Mode instruction
  parts.push(MODE_INSTRUCTIONS[mode]);

  // 4. Style DNA from soul
  const styleDna = soul.style_dna as Record<string, string>;
  if (styleDna.visual) parts.push(styleDna.visual);
  if (styleDna.lighting) parts.push(styleDna.lighting);
  if (styleDna.mood) parts.push(styleDna.mood);

  // 5. Applied styles
  for (const style of styles) {
    if (style.prompt_template) parts.push(style.prompt_template);
  }

  // 6. User prompt
  if (userPrompt.trim()) parts.push(userPrompt.trim());

  // Negative prompt aggregation
  const negativeParts: string[] = [];
  if (profile.negative_prompt) negativeParts.push(profile.negative_prompt);
  for (const style of styles) {
    if (style.negative_prompt) negativeParts.push(style.negative_prompt);
  }

  return {
    prompt: parts.filter(Boolean).join(', '),
    negativePrompt: negativeParts.filter(Boolean).join(', ') || undefined,
    metadata: {
      character_id: character.id,
      soul_id: soul.id,
      soul_code: soul.soul_code,
      mode,
      style_ids: styles.map(s => s.id),
    },
  };
}
