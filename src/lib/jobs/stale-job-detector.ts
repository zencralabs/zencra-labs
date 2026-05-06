/**
 * src/lib/jobs/stale-job-detector.ts
 *
 * Periodic background scanner that marks overdue jobs as "stale".
 *
 * ─── Responsibility ───────────────────────────────────────────────────────────
 *
 *   The polling engine (job-polling.ts) enforces MAX_POLL_DURATION_MS per job
 *   and marks a job stale from within the polling loop. The detector here is a
 *   safety net for cases where the polling loop was NOT running when the job
 *   crossed its threshold — specifically:
 *
 *     • Jobs recovered from the server after a refresh (recoverPendingJobs),
 *       which may already be overdue by the time the tab opens.
 *     • Jobs whose polling loop was stopped early (tab hidden, network error)
 *       and the browser never re-focused within the window.
 *     • Jobs registered while the tab was in the background from the start.
 *
 *   The detector runs once every SCAN_INTERVAL_MS and checks ALL active
 *   (non-terminal) jobs in the store against their studio-specific stale
 *   threshold. When a job's age exceeds its threshold, the detector:
 *
 *     1. Calls stopPolling(jobId) to cancel any lingering poll loop.
 *     2. Calls store.failJob(jobId, "stale") to update the UI.
 *     3. Emits a globalToast.info() notification.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { startStaleDetector, stopStaleDetector } from "@/lib/jobs/stale-job-detector";
 *
 *   // Start in root layout (once, after auth session loads):
 *   useEffect(() => {
 *     startStaleDetector();
 *     return () => stopStaleDetector();
 *   }, []);
 *
 * ─── Singleton pattern ───────────────────────────────────────────────────────
 *
 *   Only one scan interval can run at a time. Calling startStaleDetector()
 *   when already running is a no-op (safe to call multiple times).
 *
 * ─── Thread safety ───────────────────────────────────────────────────────────
 *
 *   The scanner reads current store state via getPendingJobStoreState() and
 *   writes back via store.failJob(). Zustand actions are synchronous within
 *   each call, so there is no race condition from a concurrent poll completing
 *   between the read and write — at worst the polling engine wins first and the
 *   detector finds an already-terminal job and skips it.
 */

import { STALE_THRESHOLD_MS, stopPolling } from "./job-polling";
import { getPendingJobStoreState }          from "./pending-job-store";
import { isTerminal }                       from "./job-status-normalizer";
import { globalToast }                      from "./global-toast-store";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How often the detector scans for overdue jobs.
 * 30 seconds is short enough to surface stale jobs quickly without
 * adding meaningful CPU overhead.
 */
const SCAN_INTERVAL_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Singleton state
// ─────────────────────────────────────────────────────────────────────────────

let scanTimer: ReturnType<typeof setInterval> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Core scan
// ─────────────────────────────────────────────────────────────────────────────

function runScan(): void {
  const store = getPendingJobStoreState();
  const now   = Date.now();

  for (const job of Object.values(store.jobs)) {
    // Skip terminal jobs — they are already resolved.
    if (isTerminal(job.status)) continue;

    const createdMs  = new Date(job.createdAt).getTime();
    const ageMs      = now - createdMs;
    const threshold  = STALE_THRESHOLD_MS[job.studio];

    if (ageMs < threshold) continue;

    // Job exceeded its studio threshold — mark stale.
    console.warn(
      `[stale-detector] Job ${job.jobId} (${job.studio}) overdue by ${Math.round((ageMs - threshold) / 1000)}s — marking stale`
    );

    // Stop any lingering poll loop first.
    stopPolling(job.jobId);

    // Update the store — this triggers a UI re-render.
    store.failJob(job.jobId, "stale", "Generation timed out — no response from provider.");

    // Surface a toast so the user is aware without needing to open the drawer.
    const label = job.modelLabel || job.studio;
    globalToast.info(`${label} generation timed out. You can retry from the jobs panel.`, 6000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the stale-job scanner. No-op if already running.
 * Also runs an immediate scan on start to catch recovered overdue jobs.
 */
export function startStaleDetector(): void {
  if (scanTimer !== null) return;

  // Immediate scan — catches jobs that were already overdue before the detector started
  // (e.g., a recovered job from a tab that was closed for an hour).
  runScan();

  scanTimer = setInterval(runScan, SCAN_INTERVAL_MS);
  console.log("[stale-detector] started (interval:", SCAN_INTERVAL_MS, "ms)");
}

/**
 * Stop the stale-job scanner.
 * Call on app unmount / logout to prevent dangling intervals.
 */
export function stopStaleDetector(): void {
  if (scanTimer === null) return;
  clearInterval(scanTimer);
  scanTimer = null;
  console.log("[stale-detector] stopped");
}

/**
 * Returns true if the detector is currently running.
 */
export function isStaleDetectorRunning(): boolean {
  return scanTimer !== null;
}
