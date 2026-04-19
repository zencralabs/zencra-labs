/**
 * Image Studio Provider Index
 *
 * Phase 1 Active:
 *   gpt-image-1            → GPT Image (OpenAI gpt-image-1) — replaces DALL-E completely
 *   nano-banana-standard   → Nano Banana        (api.nanobananaapi.ai /generate)
 *   nano-banana-pro        → Nano Banana Pro     (api.nanobananaapi.ai /generate-pro)
 *   nano-banana-2          → Nano Banana 2       (api.nanobananaapi.ai /generate-v2)
 *   seedream-v5            → Seedream v5         (fal-ai/seedream-3 via fal.ai)
 *   seedream-4-5           → Seedream 4.5        (fal-ai/seedream-v4-5 via fal.ai)
 *   flux-kontext           → FLUX.1 Kontext      (fal-ai/flux-pro/kontext via fal.ai)
 *
 * Phase 2 Registered (coming-soon — NOT callable):
 *   flux-2-image           → FLUX.2              (fal-ai/flux-2/dev — placeholder, activate when BFL publishes)
 *   grok-imagine-image     → Grok Imagine        (no adapter yet)
 *   topaz-upscale-image    → Topaz Gigapixel AI  (no adapter yet)
 *
 * FLUX.2 is fully wired (adapter exists, registered) but its validateInput()
 * always returns an error until status is flipped to "active" in the registry.
 * Switch from FLUX.1 → FLUX.2: update FAL_MODEL_FLUX_2 env + flip registry status.
 */

import { registerProvider } from "../core/orchestrator";
import { gptImageProvider }         from "./gpt-image";
import { nanoBananaStandardProvider, nanoBananaProProvider, nanoBanana2Provider } from "./nano-banana";
import { seedreamV5Provider, seedream45Provider } from "./seedream";
import { fluxKontextProvider }      from "./flux-kontext";
import { flux2Provider }            from "./flux2";

export function registerImageProviders(): void {
  // Phase 1 active
  registerProvider(gptImageProvider);
  registerProvider(nanoBananaStandardProvider);
  registerProvider(nanoBananaProProvider);
  registerProvider(nanoBanana2Provider);
  registerProvider(seedreamV5Provider);
  registerProvider(seedream45Provider);
  registerProvider(fluxKontextProvider);

  // Phase 2 — registered but NOT callable (status: "coming-soon", validateInput always fails)
  // Kept here so orchestrator returns MODEL_NOT_ACTIVE instead of PROVIDER_NOT_REGISTERED.
  registerProvider(flux2Provider);
}

export {
  gptImageProvider,
  nanoBananaStandardProvider,
  nanoBananaProProvider,
  nanoBanana2Provider,
  seedreamV5Provider,
  seedream45Provider,
  fluxKontextProvider,
  flux2Provider,
};
