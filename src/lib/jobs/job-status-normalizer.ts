/**
 * src/lib/jobs/job-status-normalizer.ts
 *
 * Single source of truth for client-side generation status.
 *
 * Provider APIs, the universal status route, the LipSync status route, and
 * the assets table all use different status vocabularies.  Everything that
 * enters the pending-job store is first mapped through this module so the
 * rest of the UI only ever sees one of the 8 canonical GenerationStatus
 * values.
 *
 * ─── Status graph ────────────────────────────────────────────────────────────
 *
 *   queued ──► starting ──► processing ──► completed
 *                │                │
 *                └──► failed ──► refunded
 *
 *   Any non-terminal state can also transition to:
 *     cancelled  (user action)
 *     stale      (no update within studio-specific threshold)
 *
 * ─── Sources mapped here ─────────────────────────────────────────────────────
 *
 *  1. GET /api/studio/jobs/[jobId]/status  (universal status route)
 *  2. GET /api/lipsync/[id]/status         (LipSync-specific route)
 *  3. assets.status column                 (DB terminal state — early-return path)
 *  4. ZJobStatus.status                    (provider adapter output)
 *
 * ─── Rules ───────────────────────────────────────────────────────────────────
 *
 *  • Never let a provider-specific string reach the UI or store.
 *  • Unknown / unexpected strings always normalise to "processing" (safe default).
 *  • "stale" is never returned by a server — it is set client-side only by
 *    stale-job-detector.ts when a job exceeds its studio-specific threshold.
 *  • "refunded" is client-side enrichment: set when status === "failed" AND
 *    the server response includes a credit refund acknowledgement.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Canonical client-side status type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The only status values the pending-job store, UI components, and
 * stale-job-detector are allowed to work with.
 *
 * "stale" and "refunded" are client-side only — they are never returned by any
 * server endpoint and are computed in the store / detector layer.
 */
export type GenerationStatus =
  | "queued"      // submitted to provider, waiting in queue
  | "starting"    // accepted by provider, about to begin processing
  | "processing"  // actively generating
  | "completed"   // finished successfully, asset URL available
  | "failed"      // provider returned a failure (credits may be refunded)
  | "cancelled"   // cancelled by user or platform before completion
  | "refunded"    // failed AND credits have been returned to the user
  | "stale";      // no status update within the studio-specific stale threshold

// ─────────────────────────────────────────────────────────────────────────────
// Predicates
// ─────────────────────────────────────────────────────────────────────────────

/** Terminal states — polling should stop immediately. */
const TERMINAL: ReadonlySet<GenerationStatus> = new Set([
  "completed", "failed", "cancelled", "refunded", "stale",
]);

/** Active states — job is in flight and polling should continue. */
const ACTIVE: ReadonlySet<GenerationStatus> = new Set([
  "queued", "starting", "processing",
]);

export function isTerminal(status: GenerationStatus): boolean {
  return TERMINAL.has(status);
}

export function isActive(status: GenerationStatus): boolean {
  return ACTIVE.has(status);
}

/** Whether the polling engine should keep requesting status updates. */
export function needsPolling(status: GenerationStatus): boolean {
  return ACTIVE.has(status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 1 — Universal status route
// GET /api/studio/jobs/[jobId]/status
//
// Returns: { status: "pending" | "success" | "error" | "failed" | "deleted" }
// Note: the route collapses DB "ready" → "success" and surfaces "error"
//       for provider failures.  "pending" covers both queued + processing
//       because the server has no sub-state visibility.
// ─────────────────────────────────────────────────────────────────────────────

type UniversalRouteStatus = "pending" | "success" | "error" | "failed" | "deleted";

/**
 * Normalise the status returned by GET /api/studio/jobs/[jobId]/status.
 *
 * @param rawStatus   The `status` field from the route response.
 * @param ageMs       Milliseconds since the job was created. Used to
 *                    disambiguate "pending" → queued vs processing
 *                    (≤ 30 s → queued; > 30 s → processing).
 * @param hasRefund   Pass `true` when the server response confirms credits
 *                    were refunded (e.g. timeout refund message present).
 */
export function normalizeUniversalRouteStatus(
  rawStatus: string,
  ageMs: number = 0,
  hasRefund: boolean = false,
): GenerationStatus {
  const s = rawStatus as UniversalRouteStatus;

  switch (s) {
    case "success":
      return "completed";

    case "error":
    case "failed":
      return hasRefund ? "refunded" : "failed";

    case "deleted":
      return "cancelled";

    case "pending":
      // The server cannot distinguish queued-at-provider vs actively-generating.
      // We use job age as a proxy: under 30 s almost certainly still queued.
      return ageMs <= 30_000 ? "queued" : "processing";

    default:
      // Unknown string — assume still in-flight.
      return "processing";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 2 — LipSync status route
// GET /api/lipsync/[id]/status
//
// Returns: { status: "queued" | "processing" | "completed" | "failed" | "cancelled" }
// These map 1:1 to GenerationStatus except "completed" → "completed".
// ─────────────────────────────────────────────────────────────────────────────

type LipSyncRouteStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

/**
 * Normalise the status returned by GET /api/lipsync/[id]/status.
 */
export function normalizeLipSyncRouteStatus(
  rawStatus: string,
): GenerationStatus {
  const s = rawStatus as LipSyncRouteStatus;

  switch (s) {
    case "queued":     return "queued";
    case "processing": return "processing";
    case "completed":  return "completed";
    case "failed":     return "failed";
    case "cancelled":  return "cancelled";
    default:           return "processing";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 3 — assets table status column
// Used when the store hydrates from the recovery endpoint
// (GET /api/jobs/pending) or when a job is already terminal at poll time.
//
// DB values: "pending" | "ready" | "failed" | "deleted"
// ─────────────────────────────────────────────────────────────────────────────

type AssetDbStatus = "pending" | "ready" | "failed" | "deleted";

/**
 * Normalise the `status` column value from the `assets` table.
 *
 * @param rawStatus   The `assets.status` string from Supabase.
 * @param ageMs       Used for the same "pending" disambiguation as source 1.
 */
export function normalizeAssetDbStatus(
  rawStatus: string,
  ageMs: number = 0,
): GenerationStatus {
  const s = rawStatus as AssetDbStatus;

  switch (s) {
    case "ready":   return "completed";
    case "failed":  return "failed";
    case "deleted": return "cancelled";
    case "pending":
      return ageMs <= 30_000 ? "queued" : "processing";
    default:
      return "processing";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 4 — ZJobStatus.status  (provider adapter output)
// Used if the store ever receives a direct ZJobStatus (internal dispatch).
//
// Values: "queued" | "pending" | "processing" | "success" | "error" | "cancelled"
// ─────────────────────────────────────────────────────────────────────────────

type ZJobStatusStatus = "queued" | "pending" | "processing" | "success" | "error" | "cancelled";

/**
 * Normalise a `ZJobStatus.status` value from the provider adapter layer.
 */
export function normalizeZJobStatus(
  rawStatus: string,
  ageMs: number = 0,
): GenerationStatus {
  const s = rawStatus as ZJobStatusStatus;

  switch (s) {
    case "success":    return "completed";
    case "error":      return "failed";
    case "cancelled":  return "cancelled";
    case "processing": return "processing";
    case "queued":     return "queued";
    case "pending":
      return ageMs <= 30_000 ? "queued" : "processing";
    default:
      return "processing";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience — Provider raw status strings
// These are the strings the external APIs actually return before our adapters
// normalise them.  Exposed here so the polling engine can log them cleanly.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kling raw task_status values.
 * Kling Singapore uses the same set across text-to-video, image-to-video,
 * Omni, and Multi-Elements.
 */
export type KlingRawStatus =
  | "submitted"   // just accepted
  | "processing"  // generating
  | "succeed"     // Kling's non-standard spelling
  | "completed"   // returned on some endpoints
  | "failed";     // generation error

/**
 * Seedance raw task_status values (BytePlus ModelArk).
 */
export type SeedanceRawStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "succeeded"
  | "success"
  | "SUCCEEDED"
  | "failed"
  | "FAILED";

/**
 * fal.ai queue status values (LipSync via Sync Labs v3).
 */
export type FalRawStatus =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

/**
 * Normalise Kling raw status → GenerationStatus.
 * Only used for logging / debugging; production normalisation goes via
 * normalizeUniversalRouteStatus() once the server has already translated it.
 */
export function normalizeKlingRaw(rawStatus: string): GenerationStatus {
  switch (rawStatus as KlingRawStatus) {
    case "submitted":  return "queued";
    case "processing": return "processing";
    case "succeed":
    case "completed":  return "completed";
    case "failed":     return "failed";
    default:           return "processing";
  }
}

/**
 * Normalise Seedance raw status → GenerationStatus.
 */
export function normalizeSeedanceRaw(rawStatus: string): GenerationStatus {
  switch (rawStatus as SeedanceRawStatus) {
    case "PENDING":
    case "QUEUED":    return "queued";
    case "RUNNING":   return "processing";
    case "succeeded":
    case "success":
    case "SUCCEEDED": return "completed";
    case "failed":
    case "FAILED":    return "failed";
    default:          return "processing";
  }
}

/**
 * Normalise fal.ai queue status → GenerationStatus.
 */
export function normalizeFalRaw(rawStatus: string): GenerationStatus {
  switch (rawStatus as FalRawStatus) {
    case "IN_QUEUE":    return "queued";
    case "IN_PROGRESS": return "processing";
    case "COMPLETED":   return "completed";
    case "FAILED":      return "failed";
    default:            return "processing";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable label for each status — used in PendingJobsDrawer + toasts. */
export const STATUS_LABEL: Record<GenerationStatus, string> = {
  queued:     "Queued",
  starting:   "Starting",
  processing: "Generating",
  completed:  "Complete",
  failed:     "Failed",
  cancelled:  "Cancelled",
  refunded:   "Refunded",
  stale:      "Stale",
};

/** Tailwind/inline color tokens for each status — used in badge + toast styling. */
export const STATUS_COLOR: Record<GenerationStatus, { text: string; bg: string; border: string }> = {
  queued:     { text: "#94A3B8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.20)" },
  starting:   { text: "#60A5FA", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.20)"  },
  processing: { text: "#A78BFA", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.20)" },
  completed:  { text: "#34D399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.20)"  },
  failed:     { text: "#FCA5A5", bg: "rgba(252,165,165,0.08)", border: "rgba(252,165,165,0.20)" },
  cancelled:  { text: "#64748B", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.20)" },
  refunded:   { text: "#FCD34D", bg: "rgba(252,211,77,0.08)",  border: "rgba(252,211,77,0.20)"  },
  stale:      { text: "#FB923C", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.20)"  },
};
