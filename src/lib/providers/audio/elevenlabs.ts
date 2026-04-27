/**
 * Audio Studio — ElevenLabs Provider (Phase 1 Active)
 *
 * Text-to-speech generation with:
 *   - Voice selection from Zencra voice roster
 *   - Standard (turbo v2) and Studio (multilingual v2) quality modes
 *   - Future: character voice mapping via soul_id
 *   - Future: multi-provider routing (Kits AI Phase 2)
 *
 * Sync provider — generation is inline (no polling).
 * Output stored to Supabase Storage (audio bucket).
 * Env: ELEVENLABS_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getElevenLabsEnv, getSupabaseEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// ELEVENLABS VOICE MODEL MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/** Quality → ElevenLabs model ID */
const QUALITY_TO_MODEL: Record<string, string> = {
  standard: "eleven_turbo_v2",
  studio:   "eleven_multilingual_v2",
};

/** Default voice (Sarah) if no voiceId provided */
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/** Character voice mapping — populated when soul_id resolves to an ElevenLabs voice */
async function resolveVoiceId(input: ZProviderInput): Promise<string> {
  // Future: lookup soul_id → ElevenLabs voice ID from Supabase
  // For now: use provided voiceId or default
  return input.voiceId ?? DEFAULT_VOICE_ID;
}

// ─────────────────────────────────────────────────────────────────────────────
// ELEVENLABS PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const elevenLabsProvider: ZProvider = {
  providerId:  "elevenlabs",
  modelKey:    "elevenlabs",
  studio:      "audio",
  displayName: "ElevenLabs",
  status:      "active",

  getCapabilities(): ProviderCapabilities {
    return {
      supportedInputModes:   ["text", "audio"],
      supportedAspectRatios: [],
      capabilities:          ["text_to_speech", "voice_clone", "narration", "dubbing"],
      asyncMode:             "sync",
      supportsWebhook:       false,
      supportsPolling:       false,
    };
  },

  validateInput(input: ZProviderInput): ValidationResult {
    const errors: string[] = [];
    if (!input.prompt || input.prompt.trim().length === 0) {
      errors.push("Script text (prompt) is required for audio generation.");
    }
    if (input.prompt && input.prompt.length > 5000) {
      errors.push("Script exceeds 5,000 character limit. Please split into shorter segments.");
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  },

  estimateCost(input: ZProviderInput): CreditEstimate {
    const charCount = input.prompt?.length ?? 0;
    const isStudio  = (input.providerParams?.quality as string) === "studio";
    const base      = 3;
    const longExtra = charCount > 1000 ? Math.ceil((charCount - 1000) / 500) : 0;
    const studioExtra = isStudio ? 2 : 0;
    const expected  = base + longExtra + studioExtra;
    return {
      min:       3,
      max:       8,
      expected,
      breakdown: { base, long_text: longExtra, studio_quality: studioExtra },
    };
  },

  async createJob(input: ZProviderInput): Promise<ZJob> {
    const { apiKey }  = getElevenLabsEnv();
    const supaEnv     = getSupabaseEnv();
    const jobId       = newJobId();
    const voiceId     = await resolveVoiceId(input);
    const quality     = (input.providerParams?.quality as string | undefined) ?? "standard";
    const modelId     = QUALITY_TO_MODEL[quality] ?? QUALITY_TO_MODEL.standard;

    // ── Generate audio ───────────────────────────────────────────────────────
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method:  "POST",
      headers: {
        "xi-api-key":    apiKey,
        "Content-Type":  "application/json",
        "Accept":        "audio/mpeg",
      },
      body: JSON.stringify({
        text:           input.prompt,
        model_id:       modelId,
        voice_settings: {
          stability:        0.5,
          similarity_boost: 0.75,
          style:            0,
          use_speaker_boost: false,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("ElevenLabs authentication error. Check ELEVENLABS_API_KEY.");
      if (res.status === 429) throw new Error("ElevenLabs rate limit — please wait a moment.");
      // Capture the actual ElevenLabs error body for debugging invalid voiceId,
      // quota exhaustion, and other provider-side failures.
      const errBody = await res.text().catch(() => "");
      const detail  = errBody.slice(0, 200);
      console.error(`[elevenlabs] HTTP ${res.status} — raw:`, detail);
      throw new Error(`Audio generation failed (HTTP ${res.status})${detail ? `: ${detail}` : ". Please try again."}`);
    }

    // ── Upload to Supabase Storage ───────────────────────────────────────────
    const audioBuffer = await res.arrayBuffer();
    const supabase    = createClient(supaEnv.url, supaEnv.serviceRoleKey);
    const path        = `${Date.now()}-${voiceId}-${Math.random().toString(36).slice(2)}.mp3`;

    // Ensure bucket exists
    await supabase.storage.createBucket("audio", { public: true, fileSizeLimit: 50_000_000 }).catch(() => {});

    const { error: uploadError, data: uploadData } = await supabase.storage
      .from("audio")
      .upload(path, audioBuffer, { contentType: "audio/mpeg", upsert: false });

    if (uploadError) throw new Error("Failed to store audio output. Please try again.");

    const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const now = new Date();
    const result: ZProviderResult = {
      jobId,
      provider:   "elevenlabs",
      modelKey:   "elevenlabs",
      status:     "success",
      url:        publicUrl,
      durationMs: undefined,  // ElevenLabs doesn't return duration inline
      metadata:   { voiceId, modelId, storagePath: path, quality },
    };

    return {
      id: jobId, provider: "elevenlabs", modelKey: "elevenlabs",
      studioType: "audio", status: "success",
      externalJobId: jobId, createdAt: now, updatedAt: now, completedAt: now,
      result, identity: input.identity, estimatedCredits: input.estimatedCredits,
      providerMeta: { voiceId, modelId, quality, storagePath: path },
    };
  },

  async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
    return { jobId: externalJobId, status: "success" };
  },

  async cancelJob(_: string): Promise<void> { /* sync — no-op */ },

  normalizeOutput(raw: unknown): ZProviderResult {
    const data = raw as Record<string, unknown>;
    return {
      jobId:    String(data.jobId ?? ""),
      provider: "elevenlabs",
      modelKey: "elevenlabs",
      status:   "success",
      url:      String(data.url ?? ""),
      metadata: { voiceId: data.voiceId, modelId: data.modelId },
    };
  },

  async handleWebhook(_: WebhookPayload): Promise<ZJobStatus> {
    return { jobId: _.jobId, status: "success" };
  },
};
