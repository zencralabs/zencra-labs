/**
 * FCS Studio — LTX-2.3 Provider via fal.ai
 *
 * Technology: LTX-2.3 (Lightricks), routed through fal.ai's synchronous run endpoint.
 * API: POST https://fal.run/{model-id} — blocks and returns video URL in response.
 * Credentials: FAL_KEY (shared with Seedream / Flux Kontext — no separate key needed).
 *
 * NAMING RULES (HARD — never violate):
 *   - User-facing labels = CINEMATIC NAMES ONLY ("Cine Director", "Cine Pro")
 *   - Model keys         = internal routing ("fcs_ltx23_director", "fcs_ltx23_pro")
 *   - Never expose "LTX", "Lightricks", or any version number to the UI layer
 *
 * Presets (locked — not user-configurable):
 *   Cine Director → fal-ai/ltx-video-2.3            — 1080p, 8 s, 24 fps, 60 credits
 *   Cine Pro      → fal-ai/ltx-video-2.3/lightning  — 720p,  6 s, 24 fps, 45 credits
 *
 * Error handling:
 *   - All endpoint failures throw a controlled FCSError ("PROVIDER_ERROR")
 *   - Never crash the route — errors are caught and re-thrown as structured values
 *   - Timeout: 5 minutes (generation can take up to ~3 min for 1080p / 8 s clips)
 *
 * Sync mode: asyncMode = "sync" — no polling or webhook needed.
 * Phase 1 only. Async queue support can be added in Phase 2 if generation times increase.
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId }       from "../core/job-lifecycle";
import { getFalEnv, FCS_FAL_MODEL_IDS } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// PRESET CONFIG
// ─────────────────────────────────────────────────────────────────────────────

interface FCSPreset {
  /** DB model key — matches credit_model_costs.model_key */
  modelKey:     string;
  /** fal.ai endpoint path — never shown to users */
  falModelId:   string;
  /** Fixed resolution (locked per preset) */
  width:        number;
  height:       number;
  /** Fixed duration in seconds (locked per preset) */
  durationSeconds: number;
  /** Fixed FPS (locked per preset) */
  fps:          number;
  /** Credit cost — must match credit_model_costs.base_credits seed */
  credits:      number;
}

const FCS_PRESETS: FCSPreset[] = [
  {
    modelKey:        "fcs_ltx23_director",
    falModelId:      FCS_FAL_MODEL_IDS.director,
    width:           1920,
    height:          1080,
    durationSeconds: 8,
    fps:             24,
    credits:         60,
  },
  {
    modelKey:        "fcs_ltx23_pro",
    falModelId:      FCS_FAL_MODEL_IDS.pro,
    width:           1280,
    height:          720,
    durationSeconds: 6,
    fps:             24,
    credits:         45,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FAL.AI RESPONSE SHAPE
// ─────────────────────────────────────────────────────────────────────────────

interface FalVideoResponse {
  video?: { url?: string; content_type?: string };
  // Some fal.ai models return the URL at the top level
  url?:   string;
  seed?:  number;
  // Error shape when status is not 200
  detail?: string | { msg?: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER FACTORY
// ─────────────────────────────────────────────────────────────────────────────

function buildFCSProvider(preset: FCSPreset): ZProvider {
  return {
    providerId:  "fal-fcs",
    modelKey:    preset.modelKey,
    studio:      "fcs",
    // displayName is INTERNAL — route handlers / logs only. Never send to UI.
    displayName: `FCS/${preset.modelKey}`,
    status:      "active",

    getCapabilities(): ProviderCapabilities {
      return {
        supportedInputModes:   ["text", "image"],
        // FCS presets have fixed aspect ratios derived from their resolution
        supportedAspectRatios: ["16:9"],
        // FCS duration is fixed per preset — not user-configurable
        supportedDurations:    [preset.durationSeconds],
        maxDuration:           preset.durationSeconds,
        capabilities:          ["text_to_video", "image_to_video", "cinematic_studio"],
        asyncMode:             "sync",
        supportsWebhook:       false,
        supportsPolling:       false,
      };
    },

    validateInput(input: ZProviderInput): ValidationResult {
      const errors: string[] = [];
      if (!input.prompt && !input.imageUrl) {
        errors.push("A text prompt or reference image (imageUrl) is required.");
      }
      if (input.prompt && input.prompt.length > 2000) {
        errors.push("Prompt must be 2000 characters or fewer.");
      }
      return { valid: errors.length === 0, errors, warnings: [] };
    },

    estimateCost(_input: ZProviderInput): CreditEstimate {
      return {
        min:       preset.credits,
        max:       preset.credits,
        expected:  preset.credits,
        breakdown: {
          base:     preset.credits,
          width:    preset.width,
          height:   preset.height,
          duration: preset.durationSeconds,
          fps:      preset.fps,
        },
      };
    },

    // ── CREATE JOB ────────────────────────────────────────────────────────────
    async createJob(input: ZProviderInput): Promise<ZJob> {
      const { apiKey } = getFalEnv();
      const jobId = newJobId();
      const now   = new Date();

      const payload: Record<string, unknown> = {
        prompt:            input.prompt ?? "",
        width:             preset.width,
        height:            preset.height,
        num_frames:        Math.round(preset.durationSeconds * preset.fps),
        fps:               preset.fps,
        num_inference_steps: 40,
      };

      if (input.imageUrl) {
        payload.image_url = input.imageUrl;
      }

      if (input.seed != null) {
        payload.seed = input.seed;
      }

      // Pass through any caller-supplied provider overrides
      if (input.providerParams) {
        const { width: _w, height: _h, num_frames: _nf, fps: _fps, ...rest } =
          input.providerParams as Record<string, unknown>;
        // Silently drop resolution / frame-count overrides — preset is locked.
        void _w; void _h; void _nf; void _fps;
        Object.assign(payload, rest);
      }

      const falUrl = `https://fal.run/${preset.falModelId}`;

      let res: Response;
      try {
        res = await fetch(falUrl, {
          method:  "POST",
          headers: {
            "Authorization": `Key ${apiKey}`,
            "Content-Type":  "application/json",
          },
          body:   JSON.stringify(payload),
          signal: AbortSignal.timeout(300_000), // 5-minute ceiling
        });
      } catch (fetchErr) {
        // Network / timeout errors — controlled, never crash the route
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        throw new Error(`FCS network error: ${msg.slice(0, 160)}`);
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        // Surface a clean error message — no provider branding in user-visible messages
        if (res.status === 401 || res.status === 403) {
          throw new Error("FCS authentication error. Check FAL_KEY configuration.");
        }
        if (res.status === 422) {
          throw new Error(`FCS validation error: ${errText.slice(0, 200)}`);
        }
        if (res.status >= 500) {
          throw new Error(`FCS generation service is temporarily unavailable. Please try again.`);
        }
        throw new Error(`FCS error ${res.status}: ${errText.slice(0, 120)}`);
      }

      let body: FalVideoResponse;
      try {
        body = (await res.json()) as FalVideoResponse;
      } catch {
        throw new Error("FCS returned an unreadable response. Please try again.");
      }

      // Extract video URL from fal.ai response shape
      const videoUrl =
        body.video?.url ??
        body.url        ??
        "";

      if (!videoUrl) {
        throw new Error("FCS generation completed but returned no video URL.");
      }

      const result: ZProviderResult = {
        jobId,
        provider: "fal-fcs",
        modelKey: preset.modelKey,
        status:   "success",
        url:      videoUrl,
        metadata: {
          falModelId:  preset.falModelId,
          width:       preset.width,
          height:      preset.height,
          duration:    preset.durationSeconds,
          fps:         preset.fps,
          seed:        body.seed,
        },
      };

      return {
        id:            jobId,
        provider:      "fal-fcs",
        modelKey:      preset.modelKey,
        studioType:    "fcs",
        status:        "success",
        externalJobId: jobId,
        createdAt:     now,
        updatedAt:     now,
        completedAt:   now,
        result,
        identity:      input.identity,
        providerMeta: {
          falModelId: preset.falModelId,
          width:      preset.width,
          height:     preset.height,
          duration:   preset.durationSeconds,
          fps:        preset.fps,
          videoUrl,
          seed:       body.seed,
        },
        estimatedCredits:  input.estimatedCredits,
        reservedCredits:   preset.credits,
        actualCredits:     preset.credits,
      };
    },

    // ── POLL — sync provider, always complete by the time createJob returns ───
    async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
      return { jobId: externalJobId, status: "success" };
    },

    async cancelJob(_: string): Promise<void> {
      // Sync provider — no in-flight job to cancel
    },

    normalizeOutput(raw: unknown): ZProviderResult {
      const data = raw as FalVideoResponse;
      return {
        jobId:    "",
        provider: "fal-fcs",
        modelKey: preset.modelKey,
        status:   "success",
        url:      data.video?.url ?? data.url ?? "",
        metadata: { falModelId: preset.falModelId },
      };
    },

    async handleWebhook(payload: WebhookPayload): Promise<ZJobStatus> {
      // Sync provider — no webhooks
      return { jobId: payload.jobId, status: "success" };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED PROVIDER INSTANCES
// ─────────────────────────────────────────────────────────────────────────────

/** Cine Director — 1080p, 8 s, 24 fps, 60 credits */
export const fcsCineDirectorProvider: ZProvider = buildFCSProvider(FCS_PRESETS[0]);

/** Cine Pro — 720p, 6 s, 24 fps, 45 credits */
export const fcsCineProProvider: ZProvider = buildFCSProvider(FCS_PRESETS[1]);
