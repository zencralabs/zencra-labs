/**
 * Video Studio Provider Index
 *
 * Phase 1 Active:
 *   kling-30-omni         → Kling 3.0 Omni
 *   kling-30              → Kling 3.0
 *   kling-motion-control  → Kling Motion Control
 *   kling-26              → Kling 2.6
 *   kling-25              → Kling 2.5 Turbo
 *   seedance-20           → Seedance 2.0
 *   seedance-20-fast      → Seedance 2.0 Fast
 *   seedance-15           → Seedance 1.5 Pro
 *
 * Phase 1 Coming Soon (registered but not callable):
 *   runway-gen45          → Runway Gen-4.5
 *
 * Phase 2 Coming Soon (in registry only, no adapters):
 *   veo-32, sora-2, ugc-creator-video, grok-imagine-video,
 *   luma-ai, wan-27, minimax-hailuo-23, topaz-upscale-video
 */

import { registerProvider } from "../core/orchestrator";
import {
  kling30OmniProvider,
  kling30Provider,
  klingMotionControlProvider,
  kling26Provider,
  kling25Provider,
} from "./kling";
import { seedance20Provider, seedance20FastProvider, seedance15Provider } from "./seedance";
import { runwayGen45Provider } from "./runway";

export function registerVideoProviders(): void {
  // Phase 1 active — Kling family
  registerProvider(kling30OmniProvider);
  registerProvider(kling30Provider);
  registerProvider(klingMotionControlProvider);
  registerProvider(kling26Provider);
  registerProvider(kling25Provider);

  // Phase 1 active — Seedance family
  registerProvider(seedance20Provider);
  registerProvider(seedance20FastProvider);
  registerProvider(seedance15Provider);

  // Phase 1 coming-soon — registered so the orchestrator can return a clean
  // "MODEL_NOT_ACTIVE" error rather than "PROVIDER_NOT_REGISTERED"
  registerProvider(runwayGen45Provider);
}

export {
  kling30OmniProvider,
  kling30Provider,
  klingMotionControlProvider,
  kling26Provider,
  kling25Provider,
  seedance20Provider,
  seedance20FastProvider,
  seedance15Provider,
  runwayGen45Provider,
};
