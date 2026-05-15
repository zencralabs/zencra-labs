"use client";

/**
 * src/components/system/AppBootstrap.tsx
 *
 * Root-level runtime infrastructure bootstrap.
 * Mounted ONCE inside <AuthProvider> in src/app/layout.tsx.
 * Renders nothing — pure infrastructure side-effects.
 *
 * ─── Responsibilities ────────────────────────────────────────────────────────
 *
 *   1. STALE DETECTOR
 *      Starts startStaleDetector() on mount, stops it on unmount.
 *      The detector scans the job store every 30 s and marks overdue
 *      jobs as "stale" so the user can retry instead of waiting forever.
 *
 *   2. JOB RECOVERY
 *      When a session token is available, calls recoverPendingJobs() once
 *      per unique token. Re-registers any assets still pending in the DB
 *      into the local Zustand store and re-attaches polling.
 *      Guards against double-calls on session refreshes (token rotation
 *      produces a new access_token string — recoveredTokenRef dedupes).
 *
 *   3. LOGOUT CLEANUP
 *      When session becomes null (logout / token expiry), stops all
 *      running poll loops immediately.
 *
 *   4. TRANSITION TOASTS
 *      Subscribes to the Zustand job store and emits a global toast ONLY
 *      when a job transitions to a terminal state (completed / failed /
 *      refunded). Never fires on every poll tick, never fires for jobs
 *      that were already known when the component mounted.
 *
 *      | Transition           | Toast type | Copy                           |
 *      | ─────────────────── | ─────────── | ────────────────────────────── |
 *      | any → completed      | success    | "{label} ready!"               |
 *      | any → failed         | error      | "{label} failed — check panel" |
 *      | any → refunded       | error      | "{label} failed — cr refunded" |
 *      | any → stale          | (skipped)  | stale-detector fires its own   |
 *      | any → cancelled      | (skipped)  | user-initiated, no surprise    |
 *      | any → queued/…active | (skipped)  | progress = drawer's job, not toast |
 *
 *   5. TAB VISIBILITY
 *      job-polling.ts already pauses all poll loops when document.hidden.
 *      No additional logic required here.
 *
 * ─── Future bootstrap hooks (add here, nowhere else) ─────────────────────────
 *
 *   • WebSocket connection init
 *   • Workspace sync on mount
 *   • Push notification subscription
 *   • Feature-flag fetch on session change
 *
 * ─── Safety guarantees ───────────────────────────────────────────────────────
 *
 *   • Singleton: stale-job-detector and polling engine both have no-op
 *     guards against being started twice.
 *   • No memory leaks: all intervals and subscriptions are cleaned up
 *     in useEffect returns.
 *   • Multiple tabs: each tab runs its own instance of this component.
 *     The Zustand store with localStorage persistence is shared across
 *     tabs only on initial load — each tab maintains its own polling
 *     loops, and the stale detector runs independently per tab.
 *   • Logout safety: stopAllPolling() cancels every interval before the
 *     user's session is invalidated, preventing 401 spam.
 */

import { useEffect, useRef }           from "react";
import { useAuth }                     from "@/components/auth/AuthContext";
import { recoverPendingJobs }          from "@/lib/jobs/job-recovery";
import { startStaleDetector,
         stopStaleDetector }           from "@/lib/jobs/stale-job-detector";
import { stopAllPolling }              from "@/lib/jobs/job-polling";
import { usePendingJobStore }          from "@/lib/jobs/pending-job-store";
import { globalToast }                 from "@/lib/jobs/global-toast-store";
import type { GenerationStatus }       from "@/lib/jobs/job-status-normalizer";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AppBootstrap() {
  const { session, user } = useAuth();
  const recoveredRef     = useRef<string | null>(null);
  // Live session ref — keeps a mutable pointer to the current session so the
  // polling engine's getToken callback always reads the freshest JWT.
  const sessionRef       = useRef(session);
  // Track previous authenticated user ID to detect logout and account switches.
  const prevUserIdRef    = useRef<string | null>(null);

  // ── 0. Keep sessionRef in sync with React session state ───────────────────
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ── 1. Stale detector ─────────────────────────────────────────────────────
  useEffect(() => {
    startStaleDetector();
    return () => {
      stopStaleDetector();
      stopAllPolling();
    };
  }, []);

  // ── 2. Job recovery on session ready ──────────────────────────────────────
  useEffect(() => {
    const token = session?.access_token;
    if (!token)                       return;  // no session
    if (recoveredRef.current === token) return; // already recovered this token

    recoveredRef.current = token;
    // Pass a live token getter — the polling engine calls this on every request
    // so Supabase JWT rotations are transparent and never cause 401 loops.
    void recoverPendingJobs(() => sessionRef.current?.access_token ?? null);
  }, [session?.access_token]);

  // ── 3. Stop polling on logout ──────────────────────────────────────────────
  useEffect(() => {
    if (!session) stopAllPolling();
  }, [session]);

  // ── 3b. Privacy: clear local jobs on logout or account switch ─────────────
  // Prevents User B from seeing User A's activity center jobs after
  // a logout or same-browser account switch.  Uses a ref to track the
  // previous user ID so we fire ONLY on a real identity change — not on
  // every render.
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const prevUserId    = prevUserIdRef.current;

    if (prevUserId !== null && prevUserId !== currentUserId) {
      // Identity changed (logout or account switch) — wipe the job store.
      // Job recovery runs in effect 2 and will re-hydrate the new user's
      // own jobs from the server once their session token is available.
      usePendingJobStore.getState().clearAll();
    }

    prevUserIdRef.current = currentUserId;
  }, [user?.id]);

  // ── 4. Transition-based job toasts ────────────────────────────────────────
  // Subscribe to the store. Fire a global toast only when a job moves to a
  // terminal state — never on every poll response, never for jobs that were
  // already known when this component mounted.
  useEffect(() => {
    // Map of jobId → last seen status.
    // Pre-populate with current store state so we don't toast for already
    // tracked jobs (e.g. jobs rehydrated from localStorage on first render).
    const prevStatus = new Map<string, GenerationStatus>();

    const initial = usePendingJobStore.getState();
    for (const [jobId, job] of Object.entries(initial.jobs)) {
      prevStatus.set(jobId, job.status);
    }

    const unsubscribe = usePendingJobStore.subscribe((state) => {
      for (const [jobId, job] of Object.entries(state.jobs)) {
        const prev = prevStatus.get(jobId);
        const curr = job.status;

        // New job just registered — track it, no toast on initial queued state.
        if (prev === undefined) {
          prevStatus.set(jobId, curr);
          continue;
        }

        // No change — skip.
        if (prev === curr) continue;

        // Status changed — record new status first so re-entrant updates
        // don't fire duplicate toasts.
        prevStatus.set(jobId, curr);

        const label = job.modelLabel || "Generation";

        switch (curr) {
          case "completed":
            globalToast.success(`${label} ready!`, 5000);
            break;

          case "failed":
            globalToast.error(
              `${label} failed — check the jobs panel.`, 6000
            );
            break;

          case "refunded":
            globalToast.error(
              `${label} failed — credits have been refunded.`, 6000
            );
            break;

          // "stale" — stale-job-detector.ts fires its own globalToast.info().
          // Duplicating it here would show two toasts for the same event.
          case "stale":
            break;

          // "cancelled" — user-initiated; no surprise toast needed.
          case "cancelled":
            break;

          // Active transitions (queued → starting → processing) are silent.
          // Progress is visible in PendingJobsDrawer.
          default:
            break;
        }
      }

      // Clean up tracking for jobs that were removed from the store.
      for (const jobId of prevStatus.keys()) {
        if (!state.jobs[jobId]) prevStatus.delete(jobId);
      }
    });

    return unsubscribe;
  }, []);

  // ── Renders nothing ───────────────────────────────────────────────────────
  return null;
}
