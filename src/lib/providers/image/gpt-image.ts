/**
 * Image Studio — GPT Image Provider (gpt-image-1 + gpt-image-2)
 *
 * Both generations use the same OpenAI images API. The model string sent
 * to the API is driven by env vars:
 *   GPT_IMAGE_MODEL_ID   → gpt-image-1 (default: "gpt-image-1")
 *   GPT_IMAGE_2_MODEL_ID → gpt-image-2 (default: "gpt-image-2")
 *
 * A shared factory (makeGptImageProvider) avoids duplication while keeping
 * each provider's modelKey and upload path distinct.
 *
 * Provider: api.openai.com/v1/images
 * Env: OPENAI_API_KEY, GPT_IMAGE_MODEL_ID, GPT_IMAGE_2_MODEL_ID
 * Async: sync (OpenAI images API responds inline)
 */

import { createClient } from "@supabase/supabase-js";
import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getOpenAIEnv, getSupabaseEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORTED SIZES
// ─────────────────────────────────────────────────────────────────────────────

// gpt-image-1 supported sizes — NOT the same as DALL-E 3.
// DALL-E 3 sizes (1792x1024, 1024x1792, 1024x1280) are rejected with HTTP 400.
const ASPECT_TO_SIZE: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5":  "1024x1536",  // no native 4:5 — portrait 1024x1536 is closest
};

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * makeGptImageProvider — Creates a ZProvider for a given GPT Image generation.
 *
 * @param key         Zencra model key ("gpt-image-1" | "gpt-image-2")
 * @param resolveModel  Returns the exact API model string to send to OpenAI.
 *                     Called at dispatch time so env overrides are honoured.
 * @param displayName   Human-readable name for admin/logging surfaces.
 */
function makeGptImageProvider(
  key: "gpt-image-1" | "gpt-image-2",
  resolveModel: () => string,
  displayName: string,
): ZProvider {
  const storageFolder = key; // "gpt-image-1" or "gpt-image-2" in Supabase Storage

  return {
    providerId:  "openai",
    modelKey:    key,
    studio:      "image",
    displayName,
    status:      "active",

    getCapabilities(): ProviderCapabilities {
      return {
        supportedInputModes:   ["text", "image"],
        supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
        capabilities:          ["text_to_image", "image_to_image", "edit", "photoreal"],
        asyncMode:             "sync",
        supportsWebhook:       false,
        supportsPolling:       false,
      };
    },

    validateInput(input: ZProviderInput): ValidationResult {
      const errors: string[] = [];
      if (!input.prompt || input.prompt.trim().length < 3) {
        errors.push("Prompt must be at least 3 characters.");
      }
      return { valid: errors.length === 0, errors, warnings: [] };
    },

    estimateCost(input: ZProviderInput): CreditEstimate {
      const isEdit    = !!input.imageUrl;
      // gpt-image quality tiers: "low" | "medium" | "high" | "auto"
      const isHigh    = input.providerParams?.quality === "high";
      const base      = isEdit ? 6 : 4;
      const highExtra = isHigh ? 2 : 0;
      const total     = base + highExtra;
      return {
        min:       4,
        max:       10,
        expected:  total,
        breakdown: { base, high_extra: highExtra },
      };
    },

    async createJob(input: ZProviderInput): Promise<ZJob> {
      const { apiKey } = getOpenAIEnv();
      const model      = resolveModel();
      // Safe diagnostic: logs the resolved OpenAI model string without exposing credentials.
      // In Vercel runtime logs, confirm this reads "gpt-image-1.5" (or your GPT_IMAGE_MODEL_ID value).
      console.info(`[gpt-image] resolved model=${model} zencra-key=${key}`);
      const jobId      = newJobId();
      const isEdit     = !!input.imageUrl;
      const size       = ASPECT_TO_SIZE[input.aspectRatio ?? "1:1"] ?? "1024x1024";
      // Quality tiers: "low" | "medium" | "high" | "auto"  (NOT "standard"/"hd" — those are DALL-E 3)
      const quality    = (input.providerParams?.quality as string | undefined) ?? "auto";

      let url:  string | undefined;
      const urls: undefined = undefined; // Phase B (native n= batching) deferred

      if (isEdit && input.imageUrl) {
        // Image editing endpoint — requires source image as blob
        const form = new FormData();
        form.append("model",   model);
        form.append("prompt",  input.prompt);
        form.append("size",    size);
        form.append("n",       "1");

        const imgRes = await fetch(input.imageUrl, { signal: AbortSignal.timeout(20_000) });
        if (!imgRes.ok) throw new Error("Failed to fetch source image for GPT Image edit.");
        form.append("image", await imgRes.blob(), "image.png");

        const res = await fetch("https://api.openai.com/v1/images/edits", {
          method:  "POST",
          headers: { "Authorization": `Bearer ${apiKey}` },
          body:    form,
          signal:  AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(await sanitizeOpenAIError(res));
        const editData = (await res.json()) as { data: Array<{ url?: string; b64_json?: string }> };
        const editRaw  = editData.data[0];
        if (editRaw?.url) {
          url = editRaw.url;
        } else if (editRaw?.b64_json) {
          url = await uploadGeneratedImage(editRaw.b64_json, jobId, storageFolder);
        }

      } else {
        // Standard generation endpoint — always n=1 per dispatch call.
        // Multi-image batching uses the loop strategy in page.tsx (one call per image).
        // Native n= batching (Phase B) is deferred until frontend can consume urls[].
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method:  "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ model, prompt: input.prompt, size, quality, n: 1 }),
          signal:  AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(await sanitizeOpenAIError(res));
        const data = (await res.json()) as { data: Array<{ url?: string; b64_json?: string }> };

        const raw = data.data[0];
        if (raw?.url) {
          url = raw.url;
        } else if (raw?.b64_json) {
          url = await uploadGeneratedImage(raw.b64_json, jobId, storageFolder);
        }

        if (!url) throw new Error(`${displayName} returned no image URL.`);
      }

      if (!url) throw new Error(`${displayName} returned no image URL.`);

      const now: Date = new Date();
      const result: ZProviderResult = {
        jobId, provider: "openai", modelKey: key,
        status: "success", url, urls,
        metadata: { size, quality, mode: isEdit ? "edit" : "generate" },
      };

      return {
        id: jobId, provider: "openai", modelKey: key,
        studioType: "image", status: "success",
        externalJobId: jobId, createdAt: now, updatedAt: now, completedAt: now,
        result, identity: input.identity, estimatedCredits: input.estimatedCredits,
      };
    },

    async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
      // Sync provider — always complete
      return { jobId: externalJobId, status: "success" };
    },

    async cancelJob(_: string): Promise<void> { /* sync — no-op */ },

    normalizeOutput(raw: unknown): ZProviderResult {
      const data = raw as Record<string, unknown>;
      return {
        jobId: String(data.jobId ?? ""), provider: "openai", modelKey: key,
        status: "success", url: String(data.url ?? ""),
      };
    },

    async handleWebhook(_: WebhookPayload): Promise<ZJobStatus> {
      return { jobId: _.jobId, status: "success" };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

/** GPT Image 1.5 — current production model (gpt-image-1). */
export const gptImageProvider = makeGptImageProvider(
  "gpt-image-1",
  () => getOpenAIEnv().model,
  "GPT Image 1.5",
);

/** GPT Image 2 — next-generation model (gpt-image-2).
 *  Set GPT_IMAGE_2_MODEL_ID env var once OpenAI confirms the exact API string. */
export const gptImage2Provider = makeGptImageProvider(
  "gpt-image-2",
  () => getOpenAIEnv().model2,
  "GPT Image 2",
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a base64-encoded PNG from OpenAI to Supabase Storage.
 * Returns the public CDN URL. Throws on upload failure.
 *
 * gpt-image models always return b64_json — they do not support response_format.
 * Storing b64 directly as a URL is not viable (multi-KB string in the DB).
 * Uploading here gives the asset a real, stable, shareable URL.
 *
 * @param folder   Storage folder prefix — "gpt-image-1" or "gpt-image-2"
 */
async function uploadGeneratedImage(b64: string, jobId: string, folder: string): Promise<string> {
  const { url: supabaseUrl, serviceRoleKey } = getSupabaseEnv();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const buffer = Buffer.from(b64, "base64");
  const path   = `${folder}/${jobId}.png`;

  const { error } = await supabase.storage
    .from("generations")
    .upload(path, buffer, {
      contentType:  "image/png",
      cacheControl: "public, max-age=31536000, immutable",
      upsert:       false,
    });

  if (error) {
    throw new Error(`[${folder}] Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from("generations").getPublicUrl(path);
  return data.publicUrl;
}

async function sanitizeOpenAIError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  // Always log the raw OpenAI response — never swallow 400s silently.
  console.error(`[gpt-image] OpenAI error HTTP ${res.status}:`, body.slice(0, 1000));
  if (res.status === 401) return "OpenAI authentication error — check OPENAI_API_KEY.";
  if (res.status === 429) return "OpenAI rate limit — please wait a moment.";
  if (body.toLowerCase().includes("content_policy")) return "Generation blocked by content policy.";
  if (res.status >= 500) return "OpenAI service unavailable. Please try again.";
  // For 400s: extract OpenAI's error.message so the caller sees the real reason.
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) return `Image generation failed: ${parsed.error.message}`;
  } catch { /* body wasn't JSON */ }
  return `Image generation failed (HTTP ${res.status}).`;
}
