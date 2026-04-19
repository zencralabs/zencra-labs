/**
 * FCS Registry — Fully isolated from main provider registry
 *
 * The Future Cinema Studio (FCS) runs under a separate namespace.
 *   - All model keys are prefixed with "fcs_"
 *   - No FCS entries appear in the main MODEL_REGISTRY
 *   - Access is gated by the entitlement layer (checkEntitlement) and
 *     the explicit fcsAccessGranted flag passed to dispatchFCS
 *   - The FCS orchestrator delegates to this registry exclusively
 *
 * NAMING RULES (HARD — never violate):
 *   displayName → CINEMATIC NAME ONLY ("Cine Director", "Cine Pro")
 *   description → may describe capabilities, never expose LTX / Lightricks / version
 *   modelKey    → internal routing only, never shown to users
 *
 * Current active models (Phase 1):
 *   fcs_ltx23_director  — Cine Director, 1080p, 8 s, 24 fps, 60 credits
 *   fcs_ltx23_pro       — Cine Pro,      720p,  6 s, 24 fps, 45 credits
 *
 * Backend: LTX-2.3 via fal.ai — synchronous, no polling or webhook.
 */

import type { ZProvider } from "../core/types";

// ─────────────────────────────────────────────────────────────────────────────
// FCS MODEL REGISTRY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type FCSModelStatus = "active" | "coming-soon" | "deprecated";

export interface FCSModelEntry {
  /** Must start with "fcs_" — internal routing only */
  modelKey:          string;
  /** Cinematic name — the ONLY name shown to users */
  displayName:       string;
  /** Capability description — no provider/version branding */
  description:       string;
  status:            FCSModelStatus;
  /** Fixed output resolution */
  resolution:        string;
  /** Fixed clip duration in seconds */
  durationSeconds:   number;
  /** Fixed frame rate */
  fps:               number;
  /** Credit cost — matches credit_model_costs.base_credits */
  credits:           number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FCS MODEL DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const FCS_MODEL_REGISTRY: FCSModelEntry[] = [
  {
    modelKey:        "fcs_ltx23_director",
    displayName:     "Cine Director",
    description:     "Full HD cinematic generation — 1080p, 8 seconds, 24fps. Maximum quality for final-look renders.",
    status:          "active",
    resolution:      "1920x1080",
    durationSeconds: 8,
    fps:             24,
    credits:         60,
  },
  {
    modelKey:        "fcs_ltx23_pro",
    displayName:     "Cine Pro",
    description:     "High-quality cinematic generation — 720p, 6 seconds, 24fps. Faster output for iteration and preview.",
    status:          "active",
    resolution:      "1280x720",
    durationSeconds: 6,
    fps:             24,
    credits:         45,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FCS PROVIDER REGISTRY (runtime adapter map)
// ─────────────────────────────────────────────────────────────────────────────

const _fcsProviders = new Map<string, ZProvider>();

export function registerFCSProvider(provider: ZProvider): void {
  if (!provider.modelKey.startsWith("fcs_")) {
    throw new Error(
      `FCS providers must use model keys prefixed with "fcs_". Got: "${provider.modelKey}"`
    );
  }
  _fcsProviders.set(provider.modelKey, provider);
}

export function getFCSProvider(modelKey: string): ZProvider | undefined {
  return _fcsProviders.get(modelKey);
}

export function listFCSProviders(): ZProvider[] {
  return Array.from(_fcsProviders.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// FCS REGISTRY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns all registered FCS model definitions */
export function getFCSModels(): FCSModelEntry[] {
  return FCS_MODEL_REGISTRY;
}

/** Returns only active FCS models */
export function getActiveFCSModels(): FCSModelEntry[] {
  return FCS_MODEL_REGISTRY.filter(m => m.status === "active");
}

/** Look up a single FCS model definition */
export function getFCSModel(modelKey: string): FCSModelEntry | undefined {
  return FCS_MODEL_REGISTRY.find(m => m.modelKey === modelKey);
}

/** Guard: is this model key registered as a known FCS model? */
export function isFCSModelKey(modelKey: string): boolean {
  return modelKey.startsWith("fcs_");
}

/** Guard: is a specific FCS model active? */
export function isFCSModelActive(modelKey: string): boolean {
  const entry = getFCSModel(modelKey);
  return entry?.status === "active";
}
