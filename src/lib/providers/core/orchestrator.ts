/**
 * Zencra Unified Orchestrator
 *
 * Single entry point for all generation requests in the new provider system.
 * No route, page, or business logic should call a provider directly.
 *
 * Lifecycle per request:
 *   1. Validate input + check feature flags
 *   2. Look up model in registry
 *   3. Look up provider adapter
 *   4. Run pre-flight validation (if provider implements validateInput)
 *   5. Estimate credits
 *   6. Reserve credits (via credit hook)
 *   7. Create job lifecycle object
 *   8. Dispatch to provider (createJob)
 *   9. Update job with external ID / status
 *  10. Finalize credits on completion
 *  11. Return normalized ZJob
 *
 * ⚠️  This orchestrator does NOT poll or wait for async results.
 *     Async jobs return status "pending" with an externalJobId.
 *     Callers must poll via getJobStatus() or handle webhooks.
 */

import type { ZProvider, ZProviderInput, ZJob, ZJobStatus } from "./types";
import { createJob, markPending, markError, markSuccess, isTerminalStatus } from "./job-lifecycle";
import { getModel, isModelActive, isFCSModel } from "./registry";
import { isStudioEnabled, isDryRun } from "./feature-flags";

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER REGISTRY (populated by each studio's index.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The orchestrator resolves providers at runtime from this map.
 * Each studio's index.ts calls registerProvider() to add its adapters.
 *
 * Key format: modelKey (e.g. "kling-30-omni", "elevenlabs", "fcs_ltx-v095")
 */
const _providerRegistry = new Map<string, ZProvider>();

export function registerProvider(provider: ZProvider): void {
  if (_providerRegistry.has(provider.modelKey)) {
    console.warn(`[orchestrator] provider already registered for model "${provider.modelKey}" — overwriting`);
  }
  _providerRegistry.set(provider.modelKey, provider);
}

export function getRegisteredProvider(modelKey: string): ZProvider | undefined {
  return _providerRegistry.get(modelKey);
}

export function listRegisteredProviders(): string[] {
  return Array.from(_providerRegistry.keys());
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATION ERRORS
// ─────────────────────────────────────────────────────────────────────────────

export class OrchestratorError extends Error {
  readonly code:
    | "MODEL_NOT_FOUND"
    | "MODEL_NOT_ACTIVE"
    | "STUDIO_DISABLED"
    | "PROVIDER_NOT_REGISTERED"
    | "VALIDATION_FAILED"
    | "CREDIT_RESERVE_FAILED"
    | "FCS_ACCESS_DENIED"
    | "DRY_RUN"
    | "PROVIDER_ERROR";

  constructor(
    message: string,
    code:
      | "MODEL_NOT_FOUND"
      | "MODEL_NOT_ACTIVE"
      | "STUDIO_DISABLED"
      | "PROVIDER_NOT_REGISTERED"
      | "VALIDATION_FAILED"
      | "CREDIT_RESERVE_FAILED"
      | "FCS_ACCESS_DENIED"
      | "DRY_RUN"
      | "PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "OrchestratorError";
    this.code = code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT HOOK INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Credit hook contract — implemented in credits/hooks.ts.
 * The orchestrator accepts this as a parameter to stay decoupled from
 * the credit system (allows easier testing and future replacement).
 */
export interface CreditHooks {
  estimate(input: ZProviderInput): Promise<import("./types").CreditEstimate>;
  reserve(userId: string, jobId: string, estimate: import("./types").CreditEstimate): Promise<boolean>;
  finalize(userId: string, jobId: string, actual: number): Promise<void>;
  rollback(userId: string, jobId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

export interface DispatchOptions {
  creditHooks?: CreditHooks;
  skipCreditCheck?: boolean;   // internal use only (admin, previews)
  fcsAccessGranted?: boolean;  // must be true for FCS model calls
}

/**
 * Dispatch a generation request through the full orchestration pipeline.
 * Returns a ZJob. If the provider is async, the job will be in "pending" state
 * and the caller must poll via pollJobStatus() or wait for a webhook.
 */
export async function dispatch(
  input: ZProviderInput,
  options: DispatchOptions = {},
): Promise<ZJob> {

  // ── 1. Studio gate ──────────────────────────────────────────────────────────
  if (!isStudioEnabled(input.studioType)) {
    throw new OrchestratorError(
      `Studio "${input.studioType}" is not currently enabled.`,
      "STUDIO_DISABLED",
    );
  }

  // ── 2. FCS isolation ────────────────────────────────────────────────────────
  if (isFCSModel(input.modelKey) && !options.fcsAccessGranted) {
    throw new OrchestratorError(
      "Access to Future Cinema Studio requires explicit FCS access.",
      "FCS_ACCESS_DENIED",
    );
  }

  // ── 3. Model lookup ─────────────────────────────────────────────────────────
  const modelEntry = getModel(input.modelKey);
  if (!modelEntry) {
    throw new OrchestratorError(
      `Model "${input.modelKey}" is not registered in the model registry.`,
      "MODEL_NOT_FOUND",
    );
  }
  if (!isModelActive(input.modelKey)) {
    throw new OrchestratorError(
      `Model "${input.modelKey}" is not active (status: ${modelEntry.status}).`,
      "MODEL_NOT_ACTIVE",
    );
  }

  // ── 4. Provider lookup ──────────────────────────────────────────────────────
  const provider = getRegisteredProvider(input.modelKey);
  if (!provider) {
    throw new OrchestratorError(
      `No provider adapter registered for model "${input.modelKey}". ` +
      `Make sure the studio index.ts has been imported.`,
      "PROVIDER_NOT_REGISTERED",
    );
  }

  // ── 5. Dry run guard ────────────────────────────────────────────────────────
  if (isDryRun()) {
    throw new OrchestratorError(
      `Dry run mode is active. Provider "${input.modelKey}" will not make live API calls.`,
      "DRY_RUN",
    );
  }

  // ── 6. Input validation ─────────────────────────────────────────────────────
  if (provider.validateInput) {
    const validation = provider.validateInput(input);
    if (!validation.valid) {
      throw new OrchestratorError(
        `Validation failed for model "${input.modelKey}": ${validation.errors.join("; ")}`,
        "VALIDATION_FAILED",
      );
    }
  }

  // ── 7. Credit estimate ──────────────────────────────────────────────────────
  let estimatedCredits = input.estimatedCredits;
  if (!estimatedCredits && options.creditHooks) {
    estimatedCredits = await options.creditHooks.estimate(input);
  }

  // ── 8. Credit reserve ───────────────────────────────────────────────────────
  let job = createJob(input, modelEntry.providerFamily, estimatedCredits);

  if (!options.skipCreditCheck && options.creditHooks && estimatedCredits) {
    const reserved = await options.creditHooks.reserve(
      input.userId,
      job.id,
      estimatedCredits,
    );
    if (!reserved) {
      throw new OrchestratorError(
        "Insufficient credits to reserve for this generation.",
        "CREDIT_RESERVE_FAILED",
      );
    }
    job = { ...job, reservedCredits: estimatedCredits.expected };
  }

  // ── 9. Provider dispatch ────────────────────────────────────────────────────
  try {
    const providerJob = await provider.createJob({ ...input, estimatedCredits });

    // Merge provider job data into our lifecycle job
    job = markPending(job, providerJob.externalJobId);
    job = {
      ...job,
      providerMeta: providerJob.providerMeta,
    };

    // If the provider returned a synchronous result already
    if (providerJob.result && isTerminalStatus(providerJob.status)) {
      job = markSuccess(job, providerJob.result, providerJob.actualCredits);

      if (options.creditHooks) {
        await options.creditHooks.finalize(
          input.userId,
          job.id,
          providerJob.actualCredits ?? estimatedCredits?.expected ?? 0,
        );
      }
    }

    return job;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Provider error";
    job = markError(job, message);

    // Rollback reserved credits on failure
    if (options.creditHooks) {
      await options.creditHooks.rollback(input.userId, job.id);
    }

    throw new OrchestratorError(message, "PROVIDER_ERROR");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS POLLING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll a single status update from the provider.
 * Does not loop — caller is responsible for polling intervals.
 * Returns ZJobStatus. Caller should update their job record accordingly.
 */
export async function pollJobStatus(
  modelKey: string,
  externalJobId: string,
): Promise<ZJobStatus> {
  const provider = getRegisteredProvider(modelKey);
  if (!provider) {
    return {
      jobId:  externalJobId,
      status: "error",
      error:  `No provider registered for model "${modelKey}"`,
    };
  }
  return provider.getJobStatus(externalJobId);
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK HANDLING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route an inbound webhook payload to the correct provider handler.
 * Called from /api/webhooks/{provider}/route.ts
 */
export async function handleWebhook(
  modelKey: string,
  payload: import("./types").WebhookPayload,
): Promise<ZJobStatus> {
  const provider = getRegisteredProvider(modelKey);
  if (!provider) {
    console.error(`[orchestrator] webhook received for unknown model "${modelKey}"`);
    return {
      jobId:  payload.jobId,
      status: "error",
      error:  `No provider registered for model "${modelKey}"`,
    };
  }
  return provider.handleWebhook(payload);
}
