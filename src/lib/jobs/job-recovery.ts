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

import { startPolling }           from "./job-polling";
import { getPendingJobStoreState } from "./pending-job-store";
import type { GenerationStatus }  from "./job-status-normalizer";
import type { StudioType }        from "@/lib/providers/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized job descriptor returned by GET /api/jobs/pending.
 * Minimal surface — only what the recovery engine needs.
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
export async function recoverPendingJobs(authToken: string): Promise<void> {
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
  const existingIds = new Set(Object.keys(store.jobs));

  for (const descriptor of jobs) {
    // Skip jobs already tracked (e.g. from a prior recovery call in the same session)
    if (existingIds.has(descriptor.jobId)) continue;

    // Register in the store at recovered status
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

    // Re-attach the polling engine
    startPolling({
      jobId:     descriptor.jobId,
      studio:    descriptor.studio,
      authToken,
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
      },

      onError: (update) => {
        const terminalStatus =
          update.status === "refunded" ? "refunded" :
          update.status === "cancelled" ? "cancelled" :
          update.status === "stale" ? "stale" :
          "failed";
        store.failJob(descriptor.jobId, terminalStatus, update.error);
      },
    });
  }

  console.log(`[job-recovery] recovered ${jobs.length} pending job(s)`);
}
