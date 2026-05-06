/**
 * src/lib/jobs/job-recovery.ts
 *
 * Cross-refresh job recovery — re-registers in-flight jobs into the
 * pending-job store on page load, tab reopen, and post-login.
 *
 * ─── How recovery works ───────────────────────────────────────────────────────
 *
 *   1. On app mount (or after login), call recoverPendingJobs(authToken).
 *   2. This calls GET /api/jobs/pending to fetch all active jobs from the DB.
 *   3. For each returned job:
 *      a. registerJob() into the Zustand store (idempotent — skips if already present).
 *      b. Call startPolling() from job-polling.ts to re-attach the polling loop.
 *   4. The polling engine's onComplete / onError callbacks update the store.
 *
 * ─── Sources queried by GET /api/jobs/pending ────────────────────────────────
 *
 *   assets table        — status = "pending"  (image, video, audio, character, ugc, fcs)
 *   generations table   — status ∈ {queued, processing}  (lipsync only)
 *
 *   Both are scoped to the authenticated user. Service-role is used server-side.
 *   The endpoint returns a normalized PendingJobDescriptor[] array.
 *
 * ─── Recovery edge cases ─────────────────────────────────────────────────────
 *
 *   • Jobs already in the store: skip (don't double-register, don't reset status)
 *   • Jobs that are already terminal server-side: the first poll resolves them
 *     immediately (server returns terminal status → polling engine closes loop)
 *   • Jobs older than the studio stale threshold: marked "stale" by
 *     stale-job-detector.ts on next cleanup tick (not during recovery)
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { recoverPendingJobs } from "@/lib/jobs/job-recovery";
 *
 *   // In root layout client component, after auth session loads:
 *   useEffect(() => {
 *     if (session?.access_token) {
 *       recoverPendingJobs(session.access_token);
 *     }
 *   }, [session?.access_token]);
 */

import { startPolling }                    from "./job-polling";
import { getPendingJobStoreState }         from "./pending-job-store";
import { isTerminal }                      from "./job-status-normalizer";
import type { GenerationStatus }           from "./job-status-normalizer";
import type { StudioType }                 from "@/lib/providers/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized job descriptor returned by GET /api/jobs/pending.
 * Minimal surface — only what the recovery engine needs.
 *
 * `url` is populated for already-completed jobs (status = "completed") so the
 * recovery engine can reconcile them immediately without polling.
 */
export interface PendingJobDescriptor {
  jobId:       string;
  assetId:     string;
  studio:      StudioType;
  modelKey:    string;
  modelLabel:  string;
  prompt:      string;
  status:      GenerationStatus;
  creditCost?: number;
  createdAt:   string;
  /** Output URL — populated when status is "completed" (job already done server-side). */
  url?:        string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Studio completion event
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatches a DOM CustomEvent so studio shells (VideoStudioShell, etc.) can
 * update their local video/canvas state when a recovered job completes.
 *
 * Event name: "zencra:job:complete"
 * Detail:     { jobId, assetId, studio, url, audioDetected }
 *
 * This is intentionally a thin DOM event — it crosses the gap between the
 * global recovery engine (mounted in AppBootstrap outside any studio) and the
 * studio-local React state (inside VideoStudioShell, etc.).
 */
function dispatchJobCompleteEvent(
  descriptor: PendingJobDescriptor,
  url: string,
  audioDetected: boolean | null,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("zencra:job:complete", {
      detail: {
        jobId:         descriptor.jobId,
        assetId:       descriptor.assetId,
        studio:        descriptor.studio,
        url,
        audioDetected,
      },
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch active jobs from the server and re-attach polling.
 *
 * Safe to call multiple times — the dedup guard in startPolling() prevents
 * duplicate polling loops, and registerJob() skips jobs already in the store.
 *
 * @param authToken   JWT access token for Authorization header.
 */
export async function recoverPendingJobs(getToken: () => string | null): Promise<void> {
  // Snapshot the token once for the initial HTTP fetch.
  // Subsequent per-job polling loops receive `getToken` so they always
  // read the live token on every request.
  const authToken = getToken();
  if (!authToken) {
    console.warn("[job-recovery] No auth token — skipping recovery");
    return;
  }

  let jobs: PendingJobDescriptor[];

  try {
    const res = await fetch("/api/jobs/pending", {
      headers: { Authorization: `Bearer ${authToken}` },
      cache:   "no-store",
    });

    if (!res.ok) {
      console.warn("[job-recovery] GET /api/jobs/pending returned", res.status);
      return;
    }

    const body = await res.json() as { success: boolean; data?: PendingJobDescriptor[] };
    jobs = body.data ?? [];
  } catch (err) {
    console.warn("[job-recovery] fetch error:", err);
    return;
  }

  if (jobs.length === 0) return;

  const store = getPendingJobStoreState();

  let recovered = 0;
  let reconciled = 0;

  for (const descriptor of jobs) {
    const existingJob = store.jobs[descriptor.jobId];

    // ── Case A: Server says the job is already completed ─────────────────────
    // The pending route returns recently-completed assets (status "ready" in DB,
    // mapped to "completed" here) so the client can reconcile them immediately
    // without starting a polling loop.
    if (descriptor.status === "completed" && descriptor.url) {
      if (!existingJob || !isTerminal(existingJob.status)) {
        // Bring store up to date (register if missing, complete in either case)
        if (!existingJob) {
          store.registerJob({
            jobId:      descriptor.jobId,
            assetId:    descriptor.assetId,
            studio:     descriptor.studio,
            modelKey:   descriptor.modelKey,
            modelLabel: descriptor.modelLabel,
            prompt:     descriptor.prompt,
            status:     "completed",
            creditCost: descriptor.creditCost,
            createdAt:  descriptor.createdAt,
          });
        }
        store.completeJob(descriptor.jobId, descriptor.url, null);
        dispatchJobCompleteEvent(descriptor, descriptor.url, null);
        reconciled++;
      }
      continue; // Never start polling for a job we already know is complete
    }

    // ── Case B: Job is actively pending ──────────────────────────────────────
    // Skip only if the local store already has this job in a terminal state
    // (completed, failed, stale, etc.) — we don't want to re-open terminal jobs.
    if (existingJob && isTerminal(existingJob.status)) continue;

    // Register in the store if this is the first time we're seeing it.
    // If the job is already in the store as non-terminal (e.g. orphaned
    // "processing" entry from a previous session) we skip re-registration to
    // preserve any existing state, but we DO restart the polling loop below.
    if (!existingJob) {
      store.registerJob({
        jobId:      descriptor.jobId,
        assetId:    descriptor.assetId,
        studio:     descriptor.studio,
        modelKey:   descriptor.modelKey,
        modelLabel: descriptor.modelLabel,
        prompt:     descriptor.prompt,
        status:     descriptor.status,
        creditCost: descriptor.creditCost,
        createdAt:  descriptor.createdAt,
      });
    }

    // Re-attach the polling engine.
    // startPolling() has its own activePolls dedup guard — safe to call even if
    // a loop is already running for this jobId in the same browser session.
    startPolling({
      jobId:     descriptor.jobId,
      studio:    descriptor.studio,
      getToken,
      createdAt: descriptor.createdAt,

      onUpdate: (update) => {
        store.updateJob(descriptor.jobId, {
          status:        update.status,
          url:           update.url,
          error:         update.error,
          audioDetected: update.audioDetected,
        });
      },

      onComplete: (update) => {
        store.completeJob(descriptor.jobId, update.url ?? "", update.audioDetected);
        // Notify studio shells so they can update canvas + gallery state
        dispatchJobCompleteEvent(descriptor, update.url ?? "", update.audioDetected ?? null);
      },

      onError: (update) => {
        const terminalStatus =
          update.status === "refunded"  ? "refunded"  :
          update.status === "cancelled" ? "cancelled" :
          update.status === "stale"     ? "stale"     :
          "failed";
        store.failJob(descriptor.jobId, terminalStatus, update.error);
      },
    });

    recovered++;
  }

  const total = recovered + reconciled;
  if (total > 0) {
    console.log(
      `[job-recovery] ${recovered} job(s) re-attached to polling, ${reconciled} already-complete job(s) reconciled`,
    );
  }
}
