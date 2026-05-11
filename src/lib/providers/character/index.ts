/**
 * Character Studio Provider Index
 *
 * Registers all Character Studio provider adapters with the orchestrator.
 * Import this file in server-side initialization to activate character providers.
 *
 * Tool → Provider mapping:
 *   AI Influencer Builder  → FLUX (flux-character)
 *   Character Trainer      → FLUX (flux-character) + embedding prep
 *   Soul ID                → internal system only (no provider)
 *   Lookbook               → FLUX (flux-character) + Stability (stability-character)
 *   Scene Builder          → Stability (stability-character)
 *   Refinement Tools       → Stability (stability-character)
 *   Motion Starter         → Motion abstraction (motion-abstraction)
 *
 * Cross-studio rule:
 *   All studios (Image, Video, Audio, UGC) must pass identity context
 *   (character_id + soul_id) when generating with a selected character.
 *   The identity system in identity.ts enforces this contract.
 */

import { registerProvider } from "../core/orchestrator";
import { seedreamIdentityProvider }   from "./seedream-identity";
import { instantCharacterProvider }   from "./instant-character";
import { fluxCharacterProvider }      from "./flux";
import { stabilityCharacterProvider } from "./stability";
import { motionProvider }             from "./motion";

export function registerCharacterProviders(): void {
  // ── Casting engine (initial candidate generation — text-to-image) ────────────
  // Seedream V5 re-registered as a character studio provider.
  // Routes initial casting through a true t2i model so each candidate's
  // facial structure is driven by the prompt, not inherited from a seed image.
  registerProvider(seedreamIdentityProvider);   // primary — influencer casting
  // ── Identity engine (post-lock packs + refinement — image-to-image) ─────────
  registerProvider(instantCharacterProvider);   // retained — post-lock pack generation
  registerProvider(fluxCharacterProvider);       // fallback — FLUX.1 Pro
  registerProvider(stabilityCharacterProvider);
  registerProvider(motionProvider);
}

// Re-export identity utilities for cross-studio use
export {
  newCharacterId,
  newSoulId,
  assertIdentityContext,
  buildIdentityContext,
} from "./identity";

export type {
  CharacterIdentity,
  SoulID,
  IdentityContext,
  CharacterGenerationContext,
  CharacterAssetMetadata,
} from "./identity";

export type { MotionAdapter } from "./motion";
export { registerMotionAdapter } from "./motion";
