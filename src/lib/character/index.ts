// ── Services ──────────────────────────────────────────────────────────────────
export { CharacterService } from './character-service';
export { SoulService } from './soul-service';
export { VersionService, CharacterVersionService } from './version-service';
export { CharacterOrchestrator } from './character-orchestrator';
export { SafetyGate } from './safety-gate';
export { evaluateCharacterConsistency } from './consistency-service';
export { validateCharacterPrompt, validateReferenceConsent, logReferenceConsent } from './character-safety';
export { buildCharacterPrompt } from './character-prompt-builder';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  Character,
  CharacterProfile,
  SoulId,
  CharacterVersion,
  CharacterMode,
  CharacterStatus,
  CharacterType,
  EmbeddingStatus,
  CharacterContext,
  CharacterWithRelations,
} from './types';
export { CHARACTER_MODES, isCharacterMode, assertCharacterMode } from './types';
