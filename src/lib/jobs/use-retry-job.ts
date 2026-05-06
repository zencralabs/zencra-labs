/**
 * src/lib/jobs/use-retry-job.ts
 *
 * React hook for retrying a failed, refunded, stale, or cancelled generation job.
 *
 * ─── What "retry" means ───────────────────────────────────────────────────────
 *
 *   A retry is a fresh dispatch with the same parameters (modelKey, prompt,
 *   studio) as the original job. The server assigns a new jobId, the client
 *   registers a new PendingJob in the store, and the polling engine is
 *   re-attached. The original failed job is left in the store so the user can
 *   see both (the failed one and the new attempt) in the drawer history.
 *
 * ─── Studio routing ──────────────────────────────────────────────────────────
 *
 *   Each studio has its own POST route:
 *     image:     /api/studio/image/generate      — body: { modelKey, prompt }
 *     video:     /api/studio/video/generate      — body: { modelKey, prompt }
 *     audio:     /api/studio/audio/generate      — body: { modelKey, prompt }
 *     character: /api/studio/character/generate  — body: { modelKey, prompt }
 *     ugc:       /api/studio/ugc/generate        — body: { modelKey, prompt }
 *     fcs:       /api/studio/fcs/generate        — body: { modelKey, prompt }
 *     lipsync:   /api/lipsync/generate           — separate endpoint; lipsync
 *                                                  requires video/audio URLs,
 *                                                  not just a text prompt.
 *                                                  Retry is blocked for lipsync.
 *
 *   All routes accept at minimum { modelKey, prompt } — optional fields (aspect
 *   ratio, reference images, etc.) default server-side. A retry intentionally
 *   omits optional extras to avoid referencing stale assets from the first
 *   attempt. The user can tune the next generation in the studio directly.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   const retry = useRetryJob(session?.access_token ?? null);
 *   <button onClick={() => retry(job)}>Retry</button>
 *
 *   The returned function is stable (useCallback) so it can be passed to memoised
 *   child components without causing unnecessary re-renders.
 *
 * ─── Error handling ──────────────────────────────────────────────────────────
 *
 *   On dispatch failure the function shows an error toast and does NOT register
 *   a new job. No side-effects are left dangling on failure.
 *
 * ─── Idempotency ─────────────────────────────────────────────────────────────
 *
 *   The `isRetrying` ref inside the hook prevents double-clicks from firing two
 *   concurrent retries for the same job. The server-side idempotency layer
 *   (idempotency.ts) provides a second guard.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PendingJob }          from "./pending-job-store";
import { getPendingJobStoreState }  from "./pending-job-store";
import { startPolling }             from "./job-polling";
import { globalToast }              from "./global-toast-store";
import type { StudioType }          from "@/lib/providers/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// Route map
// ─────────────────────────────────────────────────────────────────────────────

const RETRY_ROUTES: Partial<Record<StudioType, string>> = {
  image:     "/api/studio/image/generate",
  video:     "/api/studio/video/generate",
  audio:     "/api/studio/audio/generate",
  character: "/api/studio/character/generate",
  ugc:       "/api/studio/ugc/generate",
  fcs:       "/api/studio/fcs/generate",
  // lipsync: intentionally omitted — requires video + audio URL inputs
  //           that are not stored in PendingJob; retried manually in Lip Sync studio.
};

// ─────────────────────────────────────────────────────────────────────────────
// Response shape expected from generate routes
// ─────────────────────────────────────────────────────────────────────────────

interface GenerateSuccessResponse {
  success: true;
  data: {
    jobId:   string;
    assetId: string;
    status:  string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an async function that retries the given PendingJob.
 *
 * @param authToken  JWT from the current session. If null, retry is disabled.
 */
export function useRetryJob(
  authToken: string | null
): (job: PendingJob) => Promise<void> {
  // Per-jobId guard — prevents double-clicks from firing concurrent retries.
  const inFlight  = useRef<Set<string>>(new Set());
  // Ref mirrors authToken so the polling closure always reads the live token
  // without needing to re-create the callback on every JWT rotation.
  const tokenRef  = useRef(authToken);
  useEffect(() => { tokenRef.current = authToken; }, [authToken]);

  return useCallback(
    async (job: PendingJob) => {
      // ── Guard: no auth ────────────────────────────────────────────────────
      if (!tokenRef.current) {
        globalToast.error("Please sign in to retry this generation.");
        return;
      }

      // ── Guard: unsupported studio ─────────────────────────────────────────
      const route = RETRY_ROUTES[job.studio];
      if (!route) {
        globalToast.info(
          `Retrying ${job.modelLabel} requires reopening the ${job.studio} studio.`
        );
        return;
      }

      // ── Guard: no prompt (shouldn't happen for non-lipsync, but be safe) ──
      if (!job.prompt) {
        globalToast.error("Cannot retry — original prompt not found.");
        return;
      }

      // ── Guard: concurrent retry for same job ──────────────────────────────
      if (inFlight.current.has(job.jobId)) return;
      inFlight.current.add(job.jobId);

      try {
        globalToast.info(`Retrying ${job.modelLabel}…`, 2000);

        // ── Dispatch ────────────────────────────────────────────────────────
        const res = await fetch(route, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${tokenRef.current ?? ""}`,
          },
          body: JSON.stringify({
            modelKey: job.modelKey,
            prompt:   job.prompt,
            // Optional fields intentionally omitted for retry.
            // Aspect ratio, reference images, etc. are not guaranteed to be
            // re-attachable (signed URLs may have expired). The user can
            // adjust these in the studio if needed.
          }),
        });

        if (!res.ok) {
          let errorMsg = `Retry failed (${res.status}).`;
          try {
            const errBody = (await res.json()) as { error?: string };
            if (errBody.error) errorMsg = errBody.error;
          } catch {
            // ignore JSON parse failure
          }
          globalToast.error(errorMsg, 6000);
          return;
        }

        const body = (await res.json()) as GenerateSuccessResponse;
        if (!body.success || !body.data?.jobId) {
          globalToast.error("Retry dispatch succeeded but no job ID was returned.");
          return;
        }

        const { jobId: newJobId, assetId } = body.data;
        const store = getPendingJobStoreState();

        // ── Register new job in store ─────────────────────────────────────
        store.registerJob({
          jobId:      newJobId,
          assetId,
          studio:     job.studio,
          modelKey:   job.modelKey,
          modelLabel: job.modelLabel,
          prompt:     job.prompt,
          status:     "queued",
          creditCost: job.creditCost,
          createdAt:  new Date().toISOString(),
          // FCS hooks — not applicable for retries
          parentJobId: null,
          childJobIds: [],
        });

        // ── Attach polling engine ─────────────────────────────────────────
        startPolling({
          jobId:     newJobId,
          studio:    job.studio,
          getToken:  () => tokenRef.current,
          createdAt: new Date().toISOString(),

          onUpdate: (update) => {
            store.updateJob(newJobId, {
              status:        update.status,
              url:           update.url,
              error:         update.error,
              audioDetected: update.audioDetected,
            });
          },

          onComplete: (update) => {
            store.completeJob(newJobId, update.url ?? "", update.audioDetected);
            globalToast.success(`${job.modelLabel} generation complete!`);
          },

          onError: (update) => {
            const terminalStatus =
              update.status === "refunded"  ? "refunded"  :
              update.status === "cancelled" ? "cancelled" :
              update.status === "stale"     ? "stale"     :
              "failed";
            store.failJob(newJobId, terminalStatus, update.error);
            globalToast.error(
              `${job.modelLabel} retry failed${update.error ? `: ${update.error}` : "."}`
            );
          },
        });

        globalToast.success(`${job.modelLabel} retry queued — check the jobs panel.`, 4000);

      } catch (err) {
        console.error("[use-retry-job] unexpected error:", err);
        globalToast.error("Unexpected error while retrying. Please try again.");
      } finally {
        inFlight.current.delete(job.jobId);
      }
    },
    [authToken]
  );
}
