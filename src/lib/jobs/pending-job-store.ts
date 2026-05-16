/**
 * src/lib/jobs/pending-job-store.ts
 *
 * Global Zustand store for all pending and recently-resolved generation jobs.
 *
 * Persists to localStorage under key "zencra_jobs_v1" so jobs survive:
 *   • Page refresh
 *   • Tab close + reopen (same browser session)
 *   • Navigation between studio pages
 *
 * ─── Job lifecycle in the store ──────────────────────────────────────────────
 *
 *   registerJob()   — called immediately after dispatch succeeds (jobId known)
 *   updateJob()     — called by the polling engine on every status response
 *   completeJob()   — called by polling engine on "completed"
 *   failJob()       — called by polling engine on "failed" | "refunded" | "stale"
 *   cancelJob()     — called by user action (cancel button)
 *   retryJob()      — called by retry flow; clones the job with new jobId
 *   removeJob()     — removes a job from the store entirely
 *   clearTerminal() — removes all terminal jobs older than MAX_TERMINAL_AGE_MS
 *
 * ─── FCS compatibility ───────────────────────────────────────────────────────
 *
 *   The PendingJob type includes parent_job_id and child_job_ids fields.
 *   These are schema hooks only — FCS orchestration is NOT implemented here.
 *   When FCS ships multi-pass jobs, this store already has the slots.
 *
 * ─── Persistence schema versioning ──────────────────────────────────────────
 *
 *   localStorage key: "zencra_jobs_v1"
 *   If the schema changes, increment the version in persistConfig.version.
 *   The migrate() function handles upgrading stored data across versions.
 *
 * ─── Audio Studio note ───────────────────────────────────────────────────────
 *
 *   ElevenLabs is synchronous — audio jobs complete in the generate call.
 *   registerJob() should still be called for audio so the job appears in the
 *   drawer (briefly), but the polling engine will not be started for audio jobs
 *   since the initial status will already be "completed".
 */

"use client";

import { create }      from "zustand";
import { persist }     from "zustand/middleware";
import { useShallow }  from "zustand/react/shallow";
import type { StudioType } from "@/lib/providers/core/types";
import type { GenerationStatus } from "./job-status-normalizer";
import { isTerminal } from "./job-status-normalizer";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingJob {
  /** Zencra internal job ID — stored as assets.job_id in DB. */
  jobId:      string;
  /** Supabase assets.id (UUID) — available after dispatch, needed for recovery. */
  assetId?:   string;
  /**
   * Authenticated Supabase user ID of the user who submitted this job.
   * Required on all new jobs (registerJob must pass user.id).
   * Jobs without a userId are legacy records from before v2 and must be
   * purged during migration — they must never be shown to any user.
   */
  userId?:    string;
  studio:     StudioType;
  modelKey:   string;
  /** Short display label — e.g. "Kling 3.0", "Nano Banana Pro" */
  modelLabel: string;
  /** The user's prompt, truncated to 120 chars for display. */
  prompt:     string;
  status:     GenerationStatus;
  /** Output URL — populated on "completed". */
  url?:       string;
  /** Provider error message — populated on "failed" | "refunded". */
  error?:     string;
  /** Whether audio was detected in the output (video studio). */
  audioDetected?: boolean | null;
  /** Credit cost of the generation — used for refund display. */
  creditCost?: number;
  /** ISO timestamp of when the job was submitted. */
  createdAt:  string;
  /** ISO timestamp of last status update from polling engine. */
  updatedAt:  string;
  /** ISO timestamp of when the job reached a terminal state. */
  completedAt?: string;

  // ── FCS schema hooks (not yet wired — orchestration deferred) ────────────
  /** Parent job ID for multi-pass FCS orchestration. null for standard jobs. */
  parentJobId?: string | null;
  /** Child job IDs for FCS audio/video sub-jobs. Empty for standard jobs. */
  childJobIds?: string[];
}

export interface PendingJobStore {
  /** All jobs currently tracked by the store. */
  jobs: Record<string, PendingJob>;

  // ── Write actions ─────────────────────────────────────────────────────────

  /**
   * Register a new job immediately after dispatch succeeds.
   * Called before the polling engine starts.
   */
  registerJob: (job: Omit<PendingJob, "status" | "updatedAt"> & { status?: GenerationStatus }) => void;

  /**
   * Apply a status update from the polling engine.
   * Non-terminal — does NOT set completedAt.
   */
  updateJob: (jobId: string, update: Partial<Pick<PendingJob, "status" | "url" | "error" | "audioDetected">>) => void;

  /**
   * Mark a job as completed ("completed" status + url + completedAt).
   */
  completeJob: (jobId: string, url: string, audioDetected?: boolean | null) => void;

  /**
   * Mark a job as failed / refunded / stale / cancelled.
   */
  failJob: (jobId: string, status: Extract<GenerationStatus, "failed" | "refunded" | "stale" | "cancelled">, error?: string) => void;

  /**
   * Cancel a job (user-initiated).
   */
  cancelJob: (jobId: string) => void;

  /**
   * Clone a job for retry with a new jobId.
   * The new job is registered at "queued" status.
   * Returns the new jobId.
   */
  retryJob: (originalJobId: string, newJobId: string) => string | null;

  /**
   * Atomically replace a temporary optimistic job entry with the real server job.
   *
   * Used by Image Studio (and future studios) to reconcile the pre-registration
   * card (created before the POST fires) with the real jobId/assetId the server
   * returns. The temp entry is removed and the real entry inherits all preserved
   * fields (userId, createdAt, modelKey, modelLabel, prompt) from the temp job.
   * Only fields in `updates` are overridden (status, assetId, creditCost, etc.).
   *
   * No-op if `tempId` is not found in the store — handles race conditions and
   * cases where the user is not authenticated (tempId was never registered).
   */
  replaceJob: (
    tempId:    string,
    realJobId: string,
    updates?:  Partial<Omit<PendingJob, "jobId" | "updatedAt">>,
  ) => void;

  /**
   * Remove a single job from the store.
   */
  removeJob: (jobId: string) => void;

  /**
   * Remove all terminal jobs older than MAX_TERMINAL_AGE_MS.
   * Called on store hydration and periodically by the cleanup effect.
   */
  clearTerminal: () => void;

  /**
   * Remove all jobs (called on logout).
   */
  clearAll: () => void;

  // ── Read helpers ──────────────────────────────────────────────────────────

  /** Returns all jobs in creation order (newest first). */
  getAllJobs: () => PendingJob[];

  /** Returns only active (non-terminal) jobs. */
  getActiveJobs: () => PendingJob[];

  /** Returns jobs filtered by studio. */
  getJobsByStudio: (studio: StudioType) => PendingJob[];

  /** Returns a single job by jobId. */
  getJob: (jobId: string) => PendingJob | undefined;

  /** Count of active (polling) jobs. */
  activeJobCount: () => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Terminal jobs older than this are pruned by clearTerminal().
 * 24 hours — long enough to review recently-completed jobs in the drawer,
 * short enough that localStorage does not accumulate indefinitely.
 */
const MAX_TERMINAL_AGE_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const usePendingJobStore = create<PendingJobStore>()(
  persist(
    (set, get) => ({
      jobs: {},

      // ── registerJob ────────────────────────────────────────────────────────
      registerJob: (job) => {
        const now = new Date().toISOString();
        const newJob: PendingJob = {
          status:    "queued",
          updatedAt: now,
          ...job,
          createdAt: job.createdAt ?? now,
        };
        set((s) => ({
          jobs: { ...s.jobs, [newJob.jobId]: newJob },
        }));
      },

      // ── updateJob ──────────────────────────────────────────────────────────
      updateJob: (jobId, update) => {
        const job = get().jobs[jobId];
        if (!job) return;
        // Never retrograde a terminal state
        if (isTerminal(job.status)) return;
        set((s) => ({
          jobs: {
            ...s.jobs,
            [jobId]: {
              ...s.jobs[jobId]!,
              ...update,
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },

      // ── completeJob ────────────────────────────────────────────────────────
      completeJob: (jobId, url, audioDetected) => {
        const now = new Date().toISOString();
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: {
                ...job,
                status:      "completed",
                url,
                audioDetected: audioDetected ?? job.audioDetected,
                updatedAt:   now,
                completedAt: now,
              },
            },
          };
        });
      },

      // ── failJob ────────────────────────────────────────────────────────────
      failJob: (jobId, status, error) => {
        const now = new Date().toISOString();
        set((s) => {
          const job = s.jobs[jobId];
          if (!job) return s;
          return {
            jobs: {
              ...s.jobs,
              [jobId]: {
                ...job,
                status,
                error:       error ?? job.error,
                updatedAt:   now,
                completedAt: now,
              },
            },
          };
        });
      },

      // ── cancelJob ─────────────────────────────────────────────────────────
      cancelJob: (jobId) => {
        get().failJob(jobId, "cancelled", "Cancelled by user.");
      },

      // ── replaceJob ────────────────────────────────────────────────────────
      replaceJob: (tempId, realJobId, updates) => {
        set((s) => {
          const temp = s.jobs[tempId];
          if (!temp) return s; // temp not found — no-op (unauthenticated or already replaced)
          const { [tempId]: _removed, ...rest } = s.jobs;
          const now = new Date().toISOString();
          return {
            jobs: {
              ...rest,
              [realJobId]: {
                ...temp,            // preserve userId, createdAt, modelKey, modelLabel, prompt
                ...(updates ?? {}), // override status, assetId, creditCost, etc.
                jobId:     realJobId,
                updatedAt: now,
              },
            },
          };
        });
      },

      // ── retryJob ──────────────────────────────────────────────────────────
      retryJob: (originalJobId, newJobId) => {
        const original = get().jobs[originalJobId];
        if (!original) return null;
        const now = new Date().toISOString();
        const retryJob: PendingJob = {
          ...original,
          jobId:     newJobId,
          status:    "queued",
          url:       undefined,
          error:     undefined,
          createdAt: now,
          updatedAt: now,
          completedAt: undefined,
          parentJobId:  null,
          childJobIds:  [],
        };
        set((s) => ({
          jobs: { ...s.jobs, [newJobId]: retryJob },
        }));
        return newJobId;
      },

      // ── removeJob ─────────────────────────────────────────────────────────
      removeJob: (jobId) => {
        set((s) => {
          const { [jobId]: _removed, ...rest } = s.jobs;
          return { jobs: rest };
        });
      },

      // ── clearTerminal ─────────────────────────────────────────────────────
      clearTerminal: () => {
        const cutoff = Date.now() - MAX_TERMINAL_AGE_MS;
        set((s) => {
          const jobs: Record<string, PendingJob> = {};
          for (const [id, job] of Object.entries(s.jobs)) {
            const age = job.completedAt
              ? new Date(job.completedAt).getTime()
              : new Date(job.createdAt).getTime();
            const keep = !isTerminal(job.status) || age > cutoff;
            if (keep) jobs[id] = job;
          }
          return { jobs };
        });
      },

      // ── clearAll ──────────────────────────────────────────────────────────
      clearAll: () => set({ jobs: {} }),

      // ── Read helpers ───────────────────────────────────────────────────────
      getAllJobs: () => {
        return Object.values(get().jobs).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      getActiveJobs: () => {
        return Object.values(get().jobs).filter((j) => !isTerminal(j.status));
      },

      getJobsByStudio: (studio) => {
        return Object.values(get().jobs).filter((j) => j.studio === studio);
      },

      getJob: (jobId) => get().jobs[jobId],

      activeJobCount: () => {
        return Object.values(get().jobs).filter((j) => !isTerminal(j.status)).length;
      },
    }),

    // ── Persist config ─────────────────────────────────────────────────────
    {
      name:    "zencra_jobs_v1",
      version: 2,

      // Only persist the jobs map — actions are recreated on store init.
      partialize: (state) => ({ jobs: state.jobs }),

      // Schema migration — increment version and add upgrade logic as needed.
      migrate: (persistedState, fromVersion) => {
        const base = (persistedState ?? {}) as { jobs?: Record<string, PendingJob> };
        const raw  = base.jobs ?? {};

        if (fromVersion < 2) {
          // v1 → v2: purge ALL jobs that have no userId.
          // These are unattributed legacy records that cannot be confidently
          // tied to any authenticated user. Privacy requires they be dropped —
          // never shown as a "safe fallback" to whichever user happens to log
          // in next. Active generations survive server-side; only the drawer
          // entry is lost.
          const scoped: Record<string, PendingJob> = {};
          for (const [id, job] of Object.entries(raw)) {
            if (job.userId) scoped[id] = job;
          }
          return { jobs: scoped };
        }

        return { jobs: raw };
      },

      // On hydration, prune stale terminal jobs so localStorage stays bounded.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.clearTerminal();
        }
      },
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// Convenience selector hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Returns count of non-terminal jobs — used for the drawer badge. */
export function useActiveJobCount(): number {
  return usePendingJobStore((s) => s.activeJobCount());
}

/**
 * Returns all non-terminal jobs sorted newest-first — used by PendingJobsDrawer.
 *
 * Uses useShallow so React 18's useSyncExternalStore receives a stable reference
 * when the jobs map hasn't changed — prevents the "Maximum update depth exceeded"
 * infinite re-render cycle (React Error #185) that occurs when a new array is
 * returned on every selector call regardless of state changes.
 */
export function useActiveJobs(): PendingJob[] {
  return usePendingJobStore(
    useShallow((s) =>
      Object.values(s.jobs)
        .filter((j) => !isTerminal(j.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    )
  );
}

/**
 * Returns all jobs sorted newest-first — used by the full job history.
 *
 * Uses useShallow for stable reference equality — same fix as useActiveJobs above.
 */
export function useAllJobs(): PendingJob[] {
  return usePendingJobStore(
    useShallow((s) =>
      Object.values(s.jobs).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    )
  );
}

/** Returns a single job by ID. */
export function useJob(jobId: string): PendingJob | undefined {
  return usePendingJobStore((s) => s.jobs[jobId]);
}

/** Get store state outside React (for callbacks, polling engine). */
export const getPendingJobStoreState = () => usePendingJobStore.getState();
