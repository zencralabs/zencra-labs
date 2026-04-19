/**
 * FCS Studio — Provider Index & Orchestrator
 *
 * ISOLATION BOUNDARY:
 *   The Future Cinema Studio (FCS) is a fully separate provider system.
 *   - Its own registry (fcs/registry.ts) — not in main MODEL_REGISTRY
 *   - Its own orchestrator (dispatchFCS below) — not through core/orchestrator
 *   - All model keys prefixed with "fcs_"
 *   - Access gated by the billing entitlement layer (checkEntitlement)
 *     and the explicit fcsAccessGranted flag in dispatch options
 *
 * NAMING RULES (HARD — never violate):
 *   User-facing names must ONLY use cinematic labels ("Cine Director", "Cine Pro").
 *   Never expose model keys, version numbers, or provider names ("LTX", "fal", etc.)
 *   through any API response, UI component, or log that reaches the client.
 *
 * Phase 1 Active:
 *   fcs_ltx23_director  — Cine Director (1080p / 8 s / 24 fps / 60 credits)
 *   fcs_ltx23_pro       — Cine Pro      (720p  / 6 s / 24 fps / 45 credits)
 *
 * Usage (server action / API route):
 *   registerFCSProviders(); // idempotent — call once at startup
 *   const job = await dispatchFCS({ modelKey: "fcs_ltx23_director", prompt: "..." }, { fcsAccessGranted: true });
 */

import type { ZJob, ZJobStatus, ZProviderInput } from "../core/types";
import { isFCSModelKey, isFCSModelActive, getFCSProvider, registerFCSProvider } from "./registry";
import { fcsCineDirectorProvider, fcsCineProProvider } from "./ltx";

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

let _registered = false;

export function registerFCSProviders(): void {
  if (_registered) return;
  registerFCSProvider(fcsCineDirectorProvider);  // Cine Director — 1080p, 8 s
  registerFCSProvider(fcsCineProProvider);       // Cine Pro      — 720p,  6 s
  _registered = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// FCS ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export class FCSError extends Error {
  readonly code: FCSErrorCode;

  constructor(
    message: string,
    code: FCSErrorCode
  ) {
    super(message);
    this.name = "FCSError";
    this.code = code;
  }
}

export type FCSErrorCode =
  | "ACCESS_DENIED"
  | "MODEL_NOT_FOUND"
  | "MODEL_NOT_ACTIVE"
  | "INVALID_MODEL_KEY"
  | "VALIDATION_FAILED"
  | "PROVIDER_ERROR";

export interface FCSDispatchOptions {
  /** Must be true — caller is responsible for entitlement check (checkEntitlement) */
  fcsAccessGranted: true;
  /** Optional credit reservation callback — called before generation */
  onCreditReserve?: (credits: number) => Promise<void>;
  /** Optional credit finalize callback — called on success */
  onCreditFinalize?: (credits: number) => Promise<void>;
  /** Optional rollback callback — called on failure */
  onCreditRollback?: (credits: number) => Promise<void>;
}

/**
 * FCS dispatch — routes a generation request to the appropriate FCS provider.
 *
 * Caller MUST:
 *   1. Verify user has FCS access via checkEntitlement() before calling
 *   2. Pass { fcsAccessGranted: true } in options
 *   3. Ensure registerFCSProviders() has been called at startup
 *
 * All provider errors are caught and surfaced as FCSError("PROVIDER_ERROR")
 * so that routes can map them cleanly without crashing.
 */
export async function dispatchFCS(
  input:   ZProviderInput,
  options: FCSDispatchOptions
): Promise<ZJob> {
  // Guard: access flag must be explicitly set
  if (!options.fcsAccessGranted) {
    throw new FCSError("FCS access not granted.", "ACCESS_DENIED");
  }

  const { modelKey } = input;

  // Guard: model key must be FCS-namespaced
  if (!modelKey || !isFCSModelKey(modelKey)) {
    throw new FCSError(
      `Invalid FCS model key "${modelKey}". Must be prefixed with "fcs_".`,
      "INVALID_MODEL_KEY"
    );
  }

  // Guard: model must be in FCS registry
  const provider = getFCSProvider(modelKey);
  if (!provider) {
    throw new FCSError(`FCS model "${modelKey}" not found in registry.`, "MODEL_NOT_FOUND");
  }

  // Guard: model must be active
  if (!isFCSModelActive(modelKey)) {
    throw new FCSError(`FCS model "${modelKey}" is not currently active.`, "MODEL_NOT_ACTIVE");
  }

  // Input validation
  if (provider.validateInput) {
    const validation = provider.validateInput(input);
    if (!validation.valid) {
      throw new FCSError(
        `FCS input validation failed: ${validation.errors.join("; ")}`,
        "VALIDATION_FAILED"
      );
    }
  }

  // Credit reservation
  let reservedCredits = 0;
  let creditEstimate: import("../core/types").CreditEstimate | undefined;
  if (options.onCreditReserve && provider.estimateCost) {
    creditEstimate  = provider.estimateCost(input);
    reservedCredits = creditEstimate.expected;
    await options.onCreditReserve(reservedCredits);
  }

  try {
    const job = await provider.createJob({
      ...input,
      estimatedCredits: creditEstimate,
    });

    // Credit finalization
    if (options.onCreditFinalize && reservedCredits > 0) {
      await options.onCreditFinalize(reservedCredits).catch(() => {});
    }

    return job;
  } catch (err) {
    // Credit rollback on failure
    if (options.onCreditRollback && reservedCredits > 0) {
      await options.onCreditRollback(reservedCredits).catch(() => {});
    }
    // Re-throw FCSErrors as-is; wrap everything else as PROVIDER_ERROR
    if (err instanceof FCSError) throw err;
    throw new FCSError(
      // Generic message — do NOT leak provider internals to callers
      `FCS generation failed. Please try again.`,
      "PROVIDER_ERROR"
    );
  }
}

/**
 * Poll an active FCS job for its current status.
 * FCS Phase 1 is synchronous — this always returns success immediately.
 * Kept for interface parity with async providers.
 */
export async function pollFCSJob(
  modelKey:      string,
  externalJobId: string,
  options:       Pick<FCSDispatchOptions, "fcsAccessGranted">
): Promise<ZJobStatus> {
  if (!options.fcsAccessGranted) {
    throw new FCSError("FCS access not granted.", "ACCESS_DENIED");
  }
  const provider = getFCSProvider(modelKey);
  if (!provider) {
    throw new FCSError(`FCS model "${modelKey}" not found.`, "MODEL_NOT_FOUND");
  }
  return provider.getJobStatus(externalJobId);
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export { fcsCineDirectorProvider, fcsCineProProvider };
export {
  registerFCSProvider,
  getFCSProvider,
  listFCSProviders,
  getFCSModels,
  getActiveFCSModels,
  getFCSModel,
  isFCSModelKey,
  isFCSModelActive,
} from "./registry";
