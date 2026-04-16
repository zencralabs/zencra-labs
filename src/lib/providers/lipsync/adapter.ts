// ─────────────────────────────────────────────────────────────────────────────
// Lip Sync — Provider Adapter Interface
//
// All lip sync providers must implement this interface.
// User-facing labels: "Standard" / "Pro" — never the actual engine name.
// Internal keys: lipsync_standard | lipsync_pro
//
// IMPORTANT: The input now uses `videoUrl` (not `faceUrl`).
// The portrait image is pre-processed into a source MP4 before reaching here.
// See: /lib/lipsync/prepare-source-video.ts
// ─────────────────────────────────────────────────────────────────────────────

export type SyncMode = "cut_off" | "loop" | "bounce" | "silence" | "remap";

export interface LipSyncJobInput {
  generationId:    string;
  videoUrl:        string;      // URL to source video (portrait encoded as MP4)
  audioUrl:        string;      // URL to the uploaded audio file
  aspectRatio:     "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  syncMode?:       SyncMode;    // how to handle audio/video duration mismatch
}

export interface LipSyncJobSubmitResult {
  providerTaskId:  string;      // fal request_id / provider job ID
  status:          "queued" | "processing";
  // Optional provider-specific metadata — stored in generation parameters
  statusUrl?:      string;
  responseUrl?:    string;
  cancelUrl?:      string;
}

export interface LipSyncJobStatusResult {
  status:          "queued" | "processing" | "completed" | "failed";
  progress?:       number;          // 0–100
  stage?:          string;          // provider-specific stage label
  outputUrl?:      string;          // final video URL (present when completed)
  thumbnailUrl?:   string;          // optional thumbnail URL
  failureReason?:  string;          // human-readable error when failed
}

export interface LipSyncProviderAdapter {
  /** Internal key for this adapter (e.g. "lipsync_pro") */
  key: string;

  /**
   * Returns true if this adapter is ready to accept jobs.
   * Checks whether the required env vars (API key, etc.) are set.
   * When false, the UI shows "Coming Soon".
   */
  isReady(): boolean;

  /**
   * Submit a new lip sync job to the upstream provider.
   * Receives signed URLs to the source video and audio.
   * Returns the provider task ID and optional metadata URLs.
   */
  submitJob(input: LipSyncJobInput): Promise<LipSyncJobSubmitResult>;

  /**
   * Poll the upstream provider for the current status of a submitted job.
   * Called periodically by the status route until a terminal state is reached.
   * When status is "completed", outputUrl must be populated.
   */
  getJobStatus(providerTaskId: string): Promise<LipSyncJobStatusResult>;

  /**
   * Fetch the final output once the provider has completed the job.
   * Optional — adapters that embed the output URL in getJobStatus can omit this.
   * When present, the result route will call this instead of relying solely on getJobStatus.
   */
  getResult?(providerTaskId: string): Promise<{
    videoUrl:     string;
    thumbnailUrl: string | null;
  }>;

  /**
   * Cancel an in-progress job (best-effort — may be unsupported by some providers).
   * Optional; if not implemented, throws PROVIDER_NOT_IMPLEMENTED.
   */
  cancelJob?(providerTaskId: string): Promise<{ success: boolean }>;
}
