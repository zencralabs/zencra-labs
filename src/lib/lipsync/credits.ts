// ─────────────────────────────────────────────────────────────────────────────
// Lip Sync — Credit Pricing
//
// Standard:
//   3–10 sec  → 18 credits
//   11–20 sec → 28 credits
//   21–30 sec → 38 credits
//
// Pro:
//   3–10 sec  → 38 credits
//   11–20 sec → 58 credits
//   21–30 sec → 78 credits
//
// Debit on create. Refund on provider failure.
// ─────────────────────────────────────────────────────────────────────────────

import type { LipSyncQuality } from "./status";

export function getLipSyncCredits({
  qualityMode,
  durationSeconds,
}: {
  qualityMode: LipSyncQuality;
  durationSeconds: number;
}): number {
  if (qualityMode === "pro") {
    if (durationSeconds <= 10) return 38;
    if (durationSeconds <= 20) return 58;
    return 78;
  }

  // standard
  if (durationSeconds <= 10) return 18;
  if (durationSeconds <= 20) return 28;
  return 38;
}

/** Tier label for display: "3–10s", "11–20s", "21–30s" */
export function getLipSyncDurationTier(durationSeconds: number): string {
  if (durationSeconds <= 10) return "3–10s";
  if (durationSeconds <= 20) return "11–20s";
  return "21–30s";
}
