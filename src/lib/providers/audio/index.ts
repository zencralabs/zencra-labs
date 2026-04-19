/**
 * Audio Studio Provider Index
 *
 * Phase 1 Active:
 *   elevenlabs → ElevenLabs TTS (text-to-speech, voice roster, Supabase storage)
 *
 * Phase 2 Future Slot:
 *   kits-ai → Kits AI (voice convert, voice clone) — not callable yet
 *
 * Future routing:
 *   When Phase 2 launches, multi-provider routing will select between
 *   ElevenLabs and Kits AI based on requested capability and user plan.
 *   Character voice mapping (soul_id → voiceId) will be resolved in
 *   each provider's resolveVoiceId() before dispatch.
 */

import { registerProvider } from "../core/orchestrator";
import { elevenLabsProvider } from "./elevenlabs";
import { kitsProvider }       from "./kits";

export function registerAudioProviders(): void {
  registerProvider(elevenLabsProvider);
  registerProvider(kitsProvider);   // registered as coming-soon — won't dispatch until active
}

export { elevenLabsProvider, kitsProvider };
