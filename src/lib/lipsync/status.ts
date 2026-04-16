// ─────────────────────────────────────────────────────────────────────────────
// Lip Sync — Status & Stage Types
// ─────────────────────────────────────────────────────────────────────────────

export type LipSyncStatus =
  | "draft"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type LipSyncStage =
  | "validating"
  | "uploading_assets"
  | "submitting"
  | "syncing_audio"
  | "rendering"
  | "finalizing";

export type LipSyncQuality = "standard" | "pro";

/** Human-readable label for a status value */
export function getLipSyncStatusLabel(status: LipSyncStatus): string {
  switch (status) {
    case "draft":      return "Draft";
    case "queued":     return "Queued";
    case "processing": return "Processing";
    case "completed":  return "Done";
    case "failed":     return "Failed";
    case "cancelled":  return "Cancelled";
  }
}

/** Whether the generation is still in-flight (should be polled) */
export function isActiveLipSyncStatus(status: LipSyncStatus): boolean {
  return status === "queued" || status === "processing";
}

/** Whether the generation reached a terminal state */
export function isTerminalLipSyncStatus(status: LipSyncStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
