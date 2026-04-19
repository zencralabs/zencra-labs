/**
 * Zencra Job Lifecycle
 *
 * Utilities for creating, transitioning, and serializing generation jobs.
 * The orchestrator uses these to manage the lifecycle of every provider call.
 *
 * State machine:
 *   queued → pending → processing → success
 *                              └──→ error
 *   * → cancelled  (at any point before success/error)
 */

import type {
  ZJob,
  ZJobStatus,
  ZProviderInput,
  ZProviderResult,
  GenerationJobStatus,
  ProviderFamily,
  CreditEstimate,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// VALID TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<GenerationJobStatus, GenerationJobStatus[]> = {
  queued:     ["pending", "cancelled", "error"],
  pending:    ["processing", "success", "error", "cancelled"],
  processing: ["success", "error", "cancelled"],
  success:    [],
  error:      [],
  cancelled:  [],
};

export function isValidTransition(
  from: GenerationJobStatus,
  to: GenerationJobStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────

let _jobCounter = 0;

/** Generate a unique Zencra job ID. */
export function newJobId(): string {
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  const seq  = (++_jobCounter).toString(36).padStart(3, "0");
  return `zjob_${ts}_${rand}_${seq}`;
}

/** Create a new ZJob in the initial "queued" state. */
export function createJob(
  input: ZProviderInput,
  provider: ProviderFamily,
  estimatedCredits?: CreditEstimate,
): ZJob {
  const now = new Date();
  return {
    id:               newJobId(),
    provider,
    modelKey:         input.modelKey,
    studioType:       input.studioType,
    status:           "queued",
    externalJobId:    undefined,
    createdAt:        now,
    updatedAt:        now,
    completedAt:      undefined,
    result:           undefined,
    error:            undefined,
    estimatedCredits,
    reservedCredits:  undefined,
    actualCredits:    undefined,
    identity:         input.identity,
    providerMeta:     undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Transition a job to a new status, enforcing valid state machine rules. */
export function transitionJob(
  job: ZJob,
  to: GenerationJobStatus,
  updates?: Partial<Omit<ZJob, "id" | "createdAt" | "status">>,
): ZJob {
  if (!isValidTransition(job.status, to)) {
    console.warn(
      `[job-lifecycle] invalid transition ${job.status} → ${to} for job ${job.id}`,
    );
    // Still apply — don't throw, to avoid breaking async flows
  }

  const now = new Date();
  const isTerminal = to === "success" || to === "error" || to === "cancelled";

  return {
    ...job,
    ...updates,
    status:      to,
    updatedAt:   now,
    completedAt: isTerminal ? (job.completedAt ?? now) : job.completedAt,
  };
}

/** Mark job as pending (submitted to provider, awaiting external ID). */
export function markPending(job: ZJob, externalJobId?: string): ZJob {
  return transitionJob(job, "pending", { externalJobId });
}

/** Mark job as processing (provider confirmed it started). */
export function markProcessing(job: ZJob): ZJob {
  return transitionJob(job, "processing");
}

/** Mark job as successful with final result. */
export function markSuccess(job: ZJob, result: ZProviderResult, actualCredits?: number): ZJob {
  return transitionJob(job, "success", { result, actualCredits });
}

/** Mark job as failed with an error message. */
export function markError(job: ZJob, error: string, actualCredits?: number): ZJob {
  return transitionJob(job, "error", { error, actualCredits });
}

/** Mark job as cancelled. */
export function markCancelled(job: ZJob): ZJob {
  return transitionJob(job, "cancelled");
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/** Convert ZJob to a lightweight status object safe for API responses. */
export function jobToStatus(job: ZJob): ZJobStatus {
  return {
    jobId:    job.id,
    status:   job.status,
    url:      job.result?.url,
    urls:     job.result?.urls,
    error:    job.error ?? job.result?.error,
    metadata: {
      provider:  job.provider,
      modelKey:  job.modelKey,
      externalId: job.externalJobId,
      actualCredits: job.actualCredits,
    },
  };
}

/** Returns true if the job has reached a terminal state. */
export function isTerminalStatus(status: GenerationJobStatus): boolean {
  return status === "success" || status === "error" || status === "cancelled";
}

/** Returns true if the job can still be polled. */
export function isPollableStatus(status: GenerationJobStatus): boolean {
  return status === "pending" || status === "processing";
}
