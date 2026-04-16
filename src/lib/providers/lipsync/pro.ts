import { fal } from "@/lib/falClient";
import type { LipSyncProviderAdapter } from "./adapter";

/** Map fal.ai raw queue status → normalized adapter status */
function mapFalStatus(
  raw: string
): "queued" | "processing" | "completed" | "failed" {
  if (raw === "IN_QUEUE")    return "queued";
  if (raw === "IN_PROGRESS") return "processing";
  if (raw === "COMPLETED")   return "completed";
  return "failed";
}

export const proAdapter: LipSyncProviderAdapter = {
  key: "lipsync_pro",

  isReady() {
    return Boolean(process.env.FAL_KEY);
  },

  async submitJob(input) {
    const result = await fal.queue.submit("fal-ai/sync-lipsync/v3", {
      input: {
        video_url: input.videoUrl,
        audio_url: input.audioUrl,
        sync_mode: input.syncMode ?? "cut_off",
      },
    });

    return {
      providerTaskId: result.request_id,
      status:         "queued",
      statusUrl:      result.status_url,
      responseUrl:    result.response_url,
      cancelUrl:      result.cancel_url,
    };
  },

  async getJobStatus(providerTaskId: string) {
    const status = await fal.queue.status("fal-ai/sync-lipsync/v3", {
      requestId: providerTaskId,
      logs: true,
    });

    return {
      status:        mapFalStatus(status.status),
      progress:      undefined,
      failureReason: undefined,
    };
  },

  async getResult(providerTaskId: string) {
    const result = await fal.queue.result("fal-ai/sync-lipsync/v3", {
      requestId: providerTaskId,
    });

    const videoUrl = result?.data?.video?.url as string | undefined;

    if (!videoUrl) {
      throw new Error("Fal result video URL missing");
    }

    return {
      videoUrl,
      thumbnailUrl: null,
    };
  },
};
