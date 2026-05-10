/**
 * Image Studio Provider Index
 *
 * Phase 1 Active:
 *   gpt-image-1            → GPT Image 1.5      (OpenAI gpt-image-1)
 *   gpt-image-2            → GPT Image 2         (OpenAI gpt-image-2)
 *   nano-banana-standard   → Nano Banana         (api.nanobananaapi.ai /generate)
 *   nano-banana-pro        → Nano Banana Pro      (api.nanobananaapi.ai /generate-pro)
 *   nano-banana-2          → Nano Banana 2        (api.nanobananaapi.ai /generate-v2)
 *   seedream-v5            → Seedream v5          (fal-ai/seedream via fal.ai — primary t2i)
 *   seedream-v5-lite       → Seedream Lite        (fal-ai/seedream/edit via fal.ai — fast+edit)
 *   seedream-4-5           → Seedream 4.5         (fal-ai/seedream/v4.5 — legacy, DB inactive)
 *   flux-kontext           → FLUX.1 Kontext       (fal-ai/flux-pro/kontext via fal.ai)
 *
 * Phase 2 Registered (coming-soon — NOT callable):
 *   flux-2-image           → FLUX.2              (fal-ai/flux-2/dev — placeholder, activate when BFL publishes)
 *   flux-2-max             → FLUX.2 Max          (no adapter yet — registered so orchestrator errors correctly)
 *   grok-imagine-image     → Grok Imagine        (no adapter yet)
 *   topaz-upscale-image    → Topaz Gigapixel AI  (no adapter yet)
 *
 * FLUX.2 is fully wired (adapter exists, registered) but its validateInput()
 * always returns an error until status is flipped to "active" in the registry.
 * Switch from FLUX.1 → FLUX.2: update FAL_MODEL_FLUX_2 env + flip registry status.
 *
 * GPT Image 2 (gpt-image-2): fully wired. Requires GPT_IMAGE_2_MODEL_ID env var
 * to match the exact string OpenAI's API accepts. Default: "gpt-image-2".
 */

import { registerProvider } from "../core/orchestrator";
import { gptImageProvider, gptImage2Provider } from "./gpt-image";
import { nanoBananaStandardProvider, nanoBananaProProvider, nanoBanana2Provider } from "./nano-banana";
import { seedreamV5Provider, seedreamV5LiteProvider, seedream45Provider } from "./seedream";
import { fluxKontextProvider }      from "./flux-kontext";
import { bflKontextProvider }       from "./bfl-kontext";
import { flux2Provider }            from "./flux2";

export function registerImageProviders(): void {
  // Phase 1 active
  registerProvider(gptImageProvider);
  registerProvider(gptImage2Provider);
  registerProvider(nanoBananaStandardProvider);
  registerProvider(nanoBananaProProvider);
  registerProvider(nanoBanana2Provider);
  registerProvider(seedreamV5Provider);
  registerProvider(seedreamV5LiteProvider);
  registerProvider(seedream45Provider);   // legacy — DB inactive; registered so orchestrator returns MODEL_INACTIVE
  registerProvider(fluxKontextProvider);
  registerProvider(bflKontextProvider);   // Look Pack — direct BFL Kontext API (identity-preserving)

  // Phase 2 — registered but NOT callable (status: "coming-soon", validateInput always fails)
  // Kept here so orchestrator returns MODEL_NOT_ACTIVE instead of PROVIDER_NOT_REGISTERED.
  registerProvider(flux2Provider);
  // flux-2-max: no adapter yet — orchestrator will return PROVIDER_NOT_REGISTERED
  // until a dedicated adapter is built. flux-2-image adapter covers FLUX.2 family for now.
}

export {
  gptImageProvider,
  gptImage2Provider,
  nanoBananaStandardProvider,
  nanoBananaProProvider,
  nanoBanana2Provider,
  seedreamV5Provider,
  seedreamV5LiteProvider,
  seedream45Provider,
  fluxKontextProvider,
  bflKontextProvider,
  flux2Provider,
};
