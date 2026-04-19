/**
 * UGC Studio Provider Index
 *
 * Phase 1 Active:
 *   creatify    → Creatify (product URL → UGC video ad)
 *   arcads      → Arcads (script + actor → video ad)
 *   heygen-ugc  → HeyGen UGC (script + avatar → ad video)
 *
 * NOT included here:
 *   Higgsfield — reference brand only; never a backend provider
 *   heygen-avatar (Video Studio HeyGen) — registered in video/index.ts
 *
 * Routing:
 *   UGC studio dispatches via the shared orchestrator in core/orchestrator.ts.
 *   Provider selection is determined by modelKey passed in ZProviderInput.
 *   Creatify is the default product-to-ad engine; Arcads for actor-driven scripts;
 *   HeyGen UGC for avatar-style branded ad content.
 */

import { registerProvider } from "../core/orchestrator";
import { creatifyProvider } from "./creatify";
import { arcadsProvider }   from "./arcads";
import { heygenUGCProvider } from "./heygen";

export function registerUGCProviders(): void {
  registerProvider(creatifyProvider);
  registerProvider(arcadsProvider);
  registerProvider(heygenUGCProvider);
}

export { creatifyProvider, arcadsProvider, heygenUGCProvider };
