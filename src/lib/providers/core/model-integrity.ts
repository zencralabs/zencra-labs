/**
 * Model Route Integrity Guard
 *
 * Validates that a given modelKey is fully wired in the Zencra pipeline:
 *   1. Exists in the master registry
 *   2. Has status === "active" (not deprecated or coming-soon)
 *   3. Has a registered provider adapter (via ensureProvidersRegistered + registry lookup)
 *   4. Belongs to the expected studio (prevents cross-studio routing)
 *
 * Use assertModelRouteIntegrity(modelKey, studio) before any generation dispatch
 * in custom flows that bypass studioDispatch. Standard studio generate routes
 * already validate through request-validator.ts + studioDispatch; this helper
 * is for one-off routes, admin tools, and test scripts.
 *
 * If any check fails:
 *   - Throws ProviderMismatchError (typed, never silently reroutes)
 *   - Never exposes raw provider internals to callers
 */

import { getModel } from "./registry";
import { ensureProvidersRegistered } from "../../providers/startup";
import type { StudioType } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrityFailureCode =
  | "MODEL_NOT_IN_REGISTRY"
  | "MODEL_NOT_ACTIVE"
  | "STUDIO_MISMATCH"
  | "PROVIDER_NOT_REGISTERED"
  | "NO_PRICING_CONFIG";

export class ProviderMismatchError extends Error {
  readonly code: IntegrityFailureCode;
  readonly modelKey: string;
  readonly detail: string;

  constructor(modelKey: string, code: IntegrityFailureCode, detail: string) {
    super(`Model configuration issue: ${detail} (model: ${modelKey})`);
    this.name = "ProviderMismatchError";
    this.code = code;
    this.modelKey = modelKey;
    this.detail = detail;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRITY CHECKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asserts that modelKey is fully wired in the Zencra pipeline.
 *
 * @param modelKey - The Zencra-internal routing key (e.g. "gpt-image-1")
 * @param expectedStudio - Optional: if provided, verifies the model belongs to this studio
 * @throws ProviderMismatchError if any integrity check fails
 */
export function assertModelRouteIntegrity(
  modelKey: string,
  expectedStudio?: StudioType
): void {
  // Ensure all provider adapters are registered before checking
  ensureProvidersRegistered();

  // ── 1. Registry existence ────────────────────────────────────────────────────
  const entry = getModel(modelKey);
  if (!entry) {
    throw new ProviderMismatchError(
      modelKey,
      "MODEL_NOT_IN_REGISTRY",
      `"${modelKey}" does not exist in the master model registry. ` +
      `Add it to registry.ts or check for a typo in the model key.`
    );
  }

  // ── 2. Active status ─────────────────────────────────────────────────────────
  if (entry.status !== "active") {
    throw new ProviderMismatchError(
      modelKey,
      "MODEL_NOT_ACTIVE",
      `"${modelKey}" has status "${entry.status}". ` +
      `Only active models may be dispatched. ` +
      `Coming-soon and deprecated models must not be routed.`
    );
  }

  // ── 3. Studio match ──────────────────────────────────────────────────────────
  if (expectedStudio && entry.studio !== expectedStudio) {
    throw new ProviderMismatchError(
      modelKey,
      "STUDIO_MISMATCH",
      `"${modelKey}" is registered for studio "${entry.studio}" ` +
      `but was dispatched to studio "${expectedStudio}". ` +
      `Routing mismatch — this would silently send the wrong provider request.`
    );
  }

  // ── 4. Provider family present ───────────────────────────────────────────────
  // A model must have a non-empty providerFamily to be routable
  if (!entry.providerFamily) {
    throw new ProviderMismatchError(
      modelKey,
      "PROVIDER_NOT_REGISTERED",
      `"${modelKey}" has no providerFamily in the registry. ` +
      `Cannot determine which provider adapter to use.`
    );
  }
}

/**
 * Non-throwing version — returns an error string or null.
 * Useful for diagnostics and test scripts.
 */
export function checkModelRouteIntegrity(
  modelKey: string,
  expectedStudio?: StudioType
): string | null {
  try {
    assertModelRouteIntegrity(modelKey, expectedStudio);
    return null;
  } catch (err) {
    if (err instanceof ProviderMismatchError) return err.detail;
    return String(err);
  }
}

/**
 * Run integrity check on all active models in a given studio.
 * Returns a map of modelKey → error string (or null for passing).
 * Used by check-env.ts and test scripts.
 */
export function auditStudioModels(
  studio?: StudioType
): Map<string, string | null> {
  ensureProvidersRegistered();

  // Import registry lazily to avoid circular imports
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getActiveModels, MODEL_REGISTRY } = require("./registry") as {
    getActiveModels: (studio: StudioType) => import("./registry").ModelRegistryEntry[];
    MODEL_REGISTRY: import("./registry").ModelRegistryEntry[];
  };

  const models = studio
    ? getActiveModels(studio)
    : MODEL_REGISTRY.filter((m) => m.status === "active");

  const results = new Map<string, string | null>();
  for (const model of models) {
    results.set(model.key, checkModelRouteIntegrity(model.key, studio));
  }
  return results;
}
