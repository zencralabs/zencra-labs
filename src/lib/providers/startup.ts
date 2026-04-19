/**
 * Provider Startup — Master Registration Singleton
 *
 * Call `ensureProvidersRegistered()` at the top of every API route handler
 * that uses the orchestrator. It is idempotent and safe to call in parallel —
 * each studio index already guards with its own internal `_registered` flag.
 *
 * Import pattern in routes:
 *   import { ensureProvidersRegistered } from "@/lib/providers/startup";
 *   ensureProvidersRegistered();   ← before any dispatch() call
 *
 * Registration order does not matter — each studio registers into the same
 * flat orchestrator map keyed by modelKey.
 *
 * FCS is registered separately via its own isolated registry;
 * registerFCSProviders() is called here so that dispatchFCS() is available
 * without any extra imports in route handlers.
 */

import { registerImageProviders }     from "./image";
import { registerVideoProviders }     from "./video";
import { registerAudioProviders }     from "./audio";
import { registerCharacterProviders } from "./character";
import { registerUGCProviders }       from "./ugc";
import { registerFCSProviders }       from "./fcs";

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON GUARD
// ─────────────────────────────────────────────────────────────────────────────

let _initialized = false;

/**
 * Registers all Phase 1 providers into the orchestrator.
 * Idempotent — no-op on subsequent calls within the same process.
 *
 * Each studio's registerXxxProviders() is internally guarded too,
 * so double-registration can never corrupt the registry.
 */
export function ensureProvidersRegistered(): void {
  if (_initialized) return;

  registerImageProviders();
  registerVideoProviders();
  registerAudioProviders();
  registerCharacterProviders();
  registerUGCProviders();

  // FCS has an isolated registry — must be registered separately
  registerFCSProviders();

  _initialized = true;
}

/**
 * Force re-registration — for test environments only.
 * Never call this in production routes.
 */
export function _resetProviderRegistration(): void {
  _initialized = false;
}
