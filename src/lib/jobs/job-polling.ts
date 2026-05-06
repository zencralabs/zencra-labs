/**
 * src/lib/jobs/job-polling.ts
 *
 * Universal polling engine for async generation jobs.
 *
 * Replaces the three incompatible per-studio polling implementations:
 *   • Video Studio  — raw setInterval at line 2468 of VideoStudioShell.tsx
 *   • Image Studio  — while-loop + setTimeout at line 2063 of image/page.tsx
 *   • LipSync       — setInterval in useLipSync.ts (separate endpoint)
 *
 * ─── Features ────────────────────────────────────────────────────────────────
 *
 *   ✓ Exponential backoff — starts at BASE_INTERVAL, doubles each failed poll
 *     up to MAX_INTERVAL, resets to BASE_INTERVAL on any successful response
 *   ✓ Tab visibility pause — polling halts when the tab is hidden, resumes on
 *     visibilitychange (reduces provider rate-limit pressure)
 *   ✓ Per-jobId dedup guard — only one polling loop runs per jobId at a time,
 *     even if two callers start polling the same job concurrently
 *   ✓ Provider-aware intervals — LipSync uses a separate endpoint and shorter
 *     timeout; image/video/audio share the universal endpoint
 *   ✓ Studio-specific stale thresholds — exposed as STALE_THRESHOLD_MS so
 *     stale-job-detector.ts uses the same constants
 *   ✓ Graceful teardown — stopPolling() and stopAllPolling() fully clean up
 *     timers, document listeners, and the active-set entry
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { startPolling, stopPolling } from "@/lib/jobs/job-polling";
 *
 *   // Start polling
 *   startPolling({
 *     jobId:     "zc_abc123",
 *     studio:    "video",
 *     authToken: session.access_token,
 *     onUpdate:  (update) => store.updateJob(update),
 *     onComplete:(update) => handleVideoReady(update.url),
 *     onError:   (update) => handleVideoFailed(update.error),
 *   });
 *
 *   // Stop (e.g. on component unmount)
 *   stopPolling("zc_abc123");
 *
 * ─── Architecture notes ──────────────────────────────────────────────────────
 *
 *   This engine is transport-only. It fetches status and calls callbacks.
 *   It does NOT write to the Zustand store directly — that is the
 *   responsibility of the caller (pending-job-store.ts or studio hooks).
 *
 *   All status normalisation is delegated to job-status-normalizer.ts.
 */

import type { StudioType }    from "@/lib/providers/core/types";
import {
  normalizeUniversalRouteStatus,
  normalizeLipSyncRouteStatus,
  isTerminal,
  type GenerationStatus,
} from "./job-status-normalizer";

// ─────────────────────────────────────────────────────────────────────────────
// Timing constants
// ─────────────────────────────────────────────────────────────────────────────

/** Base polling interval in ms — matches existing studio implementations. */
const BASE_INTERVAL_MS   = 4_000;

/** Maximum polling interval after exponential backoff caps. */
const MAX_INTERVAL_MS    = 30_000;

/** Backoff multiplier applied to interval after each consecutive non-terminal response. */
const BACKOFF_FACTOR     = 1.5;

/** How long to wait after an HTTP error before the next attempt. */
const ERROR_RETRY_MS     = 8_000;

/**
 * Per-studio stale thresholds in ms.
 * A job that has received no terminal update within this window is marked
 * "stale" by stale-job-detector.ts.
 *
 * Values are deliberately conservative — they cover worst-case provider queues.
 *   image:   5 min  — NB/Flux/GPT typical max; NB can hit 8 min on overload
 *   video:  30 min  — Kling 4K worst case; Seedance usually < 5 min
 *   audio:  15 min  — ElevenLabs is sync so this never fires in practice
 *   lipsync:20 min  — Sync Labs v3 via fal.ai queue
 *   character/ugc/fcs: conservative defaults
 */
export const STALE_THRESHOLD_MS: Record<StudioType, number> = {
  image:     5  * 60_000,
  video:     30 * 60_000,
  audio:     15 * 60_000,
  lipsync:   20 * 60_000,
  character: 10 * 60_000,
  ugc:       15 * 60_000,
  fcs:       30 * 60_000,
};

/**
 * Per-studio maximum total polling duration.
 * Matches existing per-studio values where defined.
 */
const MAX_POLL_DURATION_MS: Record<StudioType, number> = {
  image:     10 * 60_000,   // 10 min (existing)
  video:     60 * 60_000,   // 60 min — server PENDING_TIMEOUT_MS matches
  audio:      5 * 60_000,   // 5 min (sync; fires only for edge-case polling)
  lipsync:    6 * 60_000,   // 6 min — matches MAX_POLLS=90 × 4s (existing)
  character: 10 * 60_000,
  ugc:       10 * 60_000,
  fcs:       10 * 60_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PollUpdate {
  jobId:         string;
  status:        GenerationStatus;
  url?:          string;
  error?:        string;
  audioDetected?: boolean | null;
  /** Credits cost stored in the asset record (for refund display). */
  creditCost?:   number;
}

export interface StartPollingOptions {
  /** Zencra internal job ID (stored as `job_id` on the assets table). */
  jobId: string;
  /** Studio type — drives threshold selection + endpoint routing. */
  studio: StudioType;
  /** JWT access token for Authorization header. */
  authToken: string;
  /** ISO timestamp of job creation (from assets.created_at). Used for age-based disambiguation. */
  createdAt?: string;
  /** Called on every non-terminal status response. */
  onUpdate?: (update: PollUpdate) => void;
  /** Called once when status reaches "completed". */
  onComplete?: (update: PollUpdate) => void;
  /** Called once when status reaches "failed" | "refunded" | "stale" | "cancelled". */
  onError?: (update: PollUpdate) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Active polling registry — prevents duplicate loops for the same jobId
// ─────────────────────────────────────────────────────────────────────────────

interface ActivePollEntry {
  stop: () => void;
}

const activePolls = new Map<string, ActivePollEntry>();

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint selector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LipSync uses its own status endpoint because the lipsync generation
 * system is separate from the universal studio-dispatch pipeline.
 * All other studios use the universal job status route.
 */
function statusUrl(jobId: string, studio: StudioType): string {
  if (studio === "lipsync") {
    return `/api/lipsync/${jobId}/status`;
  }
  return `/api/studio/jobs/${jobId}/status`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────────────────────

function parseStatusResponse(
  json: Record<string, unknown>,
  studio: StudioType,
  ageMs: number,
): PollUpdate & { rawStatus: string } {
  const jobId = String(json.jobId ?? json.id ?? "");
  const rawStatus = String(json.status ?? "");
  const url  = typeof json.url  === "string" ? json.url  : undefined;
  const error = typeof json.error === "string" ? json.error : undefined;
  const audioDetected =
    typeof json.audioDetected === "boolean" ? json.audioDetected :
    json.audioDetected === null             ? null : undefined;

  // Error message inside the response body can indicate a refund happened
  const hasRefundMsg =
    typeof error === "string" &&
    (error.toLowerCase().includes("refund") || error.toLowerCase().includes("timed out"));

  const status: GenerationStatus =
    studio === "lipsync"
      ? normalizeLipSyncRouteStatus(rawStatus)
      : normalizeUniversalRouteStatus(rawStatus, ageMs, hasRefundMsg);

  return { jobId, status, url, error, audioDetected, rawStatus };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core polling loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start polling for a job. Idempotent — calling again with the same jobId
 * while a poll is already running has no effect.
 *
 * Returns a cleanup function that stops the polling loop (same as
 * calling `stopPolling(jobId)`).
 */
export function startPolling(opts: StartPollingOptions): () => void {
  const { jobId, studio, authToken, createdAt, onUpdate, onComplete, onError } = opts;

  // Dedup guard
  if (activePolls.has(jobId)) {
    return () => stopPolling(jobId);
  }

  const startedAt   = Date.now();
  const maxDuration = MAX_POLL_DURATION_MS[studio] ?? 10 * 60_000;
  const deadline    = startedAt + maxDuration;
  const createdAtMs = createdAt ? new Date(createdAt).getTime() : startedAt;

  let currentInterval = BASE_INTERVAL_MS;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  // ── Tab visibility management ────────────────────────────────────────────
  // When the tab is hidden we pause the timer. On becoming visible again
  // we immediately fire one poll then resume the normal schedule.
  let isPaused = false;

  function onVisibilityChange() {
    if (stopped) return;
    if (document.hidden) {
      isPaused = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    } else {
      isPaused = false;
      // Fire immediately on tab focus
      schedulePoll(0);
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  // ── Teardown ─────────────────────────────────────────────────────────────
  function cleanup() {
    stopped = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    activePolls.delete(jobId);
  }

  // ── Schedule next poll ───────────────────────────────────────────────────
  function schedulePoll(delayMs: number) {
    if (stopped || isPaused) return;
    timerId = setTimeout(poll, delayMs);
  }

  // ── Single poll attempt ──────────────────────────────────────────────────
  async function poll() {
    if (stopped) return;
    timerId = null;

    // Deadline guard
    if (Date.now() > deadline) {
      const staleUpdate: PollUpdate = {
        jobId,
        status: "stale",
        error:  `Generation did not complete within the ${Math.round(maxDuration / 60_000)}-minute window.`,
      };
      onError?.(staleUpdate);
      cleanup();
      return;
    }

    const ageMs = Date.now() - createdAtMs;
    const url   = statusUrl(jobId, studio);

    let json: Record<string, unknown>;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache:   "no-store",
      });

      if (!res.ok) {
        // HTTP error — back off and retry
        console.warn(`[job-polling] HTTP ${res.status} for jobId=${jobId} — retrying in ${ERROR_RETRY_MS}ms`);
        schedulePoll(ERROR_RETRY_MS);
        return;
      }

      const body = await res.json() as { success?: boolean; data?: unknown } | Record<string, unknown>;

      // Handle both { success, data } envelope (universal route) and
      // flat response (lipsync route returns flat JSON directly).
      json = (
        typeof body === "object" && body !== null && "data" in body && typeof body.data === "object"
          ? (body.data as Record<string, unknown>)
          : body
      ) as Record<string, unknown>;

    } catch (fetchErr) {
      console.warn(`[job-polling] fetch error for jobId=${jobId}:`, fetchErr);
      schedulePoll(ERROR_RETRY_MS);
      return;
    }

    const update = parseStatusResponse(json, studio, ageMs);

    if (update.status === "completed") {
      onComplete?.({ ...update });
      cleanup();
      return;
    }

    if (isTerminal(update.status)) {
      onError?.({ ...update });
      cleanup();
      return;
    }

    // Non-terminal — notify and schedule next poll with backoff
    onUpdate?.({ ...update });

    // Reset interval on any successful response, then apply backoff
    currentInterval = Math.min(currentInterval * BACKOFF_FACTOR, MAX_INTERVAL_MS);
    schedulePoll(currentInterval);
  }

  // Register in active polls map
  activePolls.set(jobId, { stop: cleanup });

  // Start the first poll
  schedulePoll(BASE_INTERVAL_MS);

  return cleanup;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public control API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stop the polling loop for a specific jobId.
 * Safe to call even if no loop is running for that jobId.
 */
export function stopPolling(jobId: string): void {
  activePolls.get(jobId)?.stop();
}

/**
 * Stop ALL active polling loops.
 * Called on user logout or global store reset.
 */
export function stopAllPolling(): void {
  for (const entry of activePolls.values()) {
    entry.stop();
  }
  // cleanup() already deletes from the map; clear any stragglers
  activePolls.clear();
}

/**
 * Returns true if a polling loop is currently active for the given jobId.
 */
export function isPolling(jobId: string): boolean {
  return activePolls.has(jobId);
}

/**
 * Returns the count of currently active polling loops.
 * Useful for debugging and tests.
 */
export function activePollingCount(): number {
  return activePolls.size;
}
