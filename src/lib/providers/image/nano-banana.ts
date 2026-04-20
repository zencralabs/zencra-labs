/**
 * Image Studio — Nano Banana Provider (new system)
 *
 * Maps Nano Banana Standard / Pro / Nano Banana 2 variants
 * to the ZProvider interface.
 *
 * Full capabilities wired (Phase 1):
 *   Modes:         Text-to-image, Image-to-image (reference mode)
 *   References:    Up to 14 image URLs (imageUrls array)
 *   Aspect ratios: 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4,
 *                  8:1, 9:16, 16:9, 21:9, auto
 *   Output format: JPG, PNG  (providerParams.outputFormat)
 *   Resolution:    1K, 2K, 4K per quality tier (Standard=1K only; Pro=1K/2K/4K)
 *   Grounding:     Google Search toggle (providerParams.useGoogleSearch)
 *
 * Async: polling (task-based)
 * Env: NANO_BANANA_API_KEY, NANO_BANANA_API_BASE_URL
 *
 * API docs: docs.nanobananaapi.ai
 * Type strings (intentional spelling from official docs — do NOT fix):
 *   "TEXTTOIAMGE"   text-to-image
 *   "IMAGETOIAMGE"  image-to-image
 */

import type {
  ZProvider, ZProviderInput, ZJob, ZJobStatus,
  ZProviderResult, CreditEstimate, ValidationResult,
  ProviderCapabilities, WebhookPayload,
} from "../core/types";
import { newJobId } from "../core/job-lifecycle";
import { getNanoBananaEnv } from "../core/env";

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

type NBVariant = "standard" | "pro" | "nb2";

// nb2 endpoint is NOT defined here — it is read from env at runtime so it can
// be overridden via NANO_BANANA_NB2_ENDPOINT without a code deploy.
// The standard and pro paths are stable and don't need overrides.
const NB_ENDPOINTS = {
  standard: "/api/v1/nanobanana/generate",
  pro:      "/api/v1/nanobanana/generate-pro",
  task:     "/api/v1/nanobanana/record-info",
} as const;

/** Exact type strings from official NB API docs — "IAMGE" spelling is intentional. */
const NB_TYPE = {
  text:  "TEXTTOIAMGE",
  image: "IMAGETOIAMGE",
} as const;

const MODEL_KEY_TO_VARIANT: Record<string, NBVariant> = {
  "nano-banana-standard": "standard",
  "nano-banana-pro":      "pro",
  "nano-banana-2":        "nb2",
};

// NB-supported aspect ratio strings (passed verbatim to the API)
const NB_SUPPORTED_ASPECT_RATIOS = new Set([
  "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
  "4:1", "4:3", "4:5", "5:4", "8:1",
  "9:16", "16:9", "21:9",
]);

/**
 * Resolve quality tier to NB resolution string.
 * Standard endpoint only supports 1K. Pro/NB2 support 1K/2K/4K.
 */
function resolveResolution(variant: NBVariant, quality?: string): "1K" | "2K" | "4K" {
  if (variant === "standard") return "1K";       // standard ignores resolution
  if (quality === "4K" || quality === "4k")      return "4K";
  if (quality === "2K" || quality === "2k")      return "2K";
  return "1K";
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FACTORY — builds ZProvider for each NB model key
// ─────────────────────────────────────────────────────────────────────────────

function buildNanoBananaProvider(modelKey: string, displayName: string): ZProvider {
  const variant = MODEL_KEY_TO_VARIANT[modelKey] ?? "standard";

  return {
    providerId:  "nano-banana",
    modelKey,
    studio:      "image",
    displayName,
    status:      "active",

    getCapabilities(): ProviderCapabilities {
      return {
        supportedInputModes:   ["text", "image"],
        supportedAspectRatios: [
          "1:1", "1:4", "1:8", "2:3", "3:2", "3:4",
          "4:1", "4:3", "4:5", "5:4", "8:1",
          "9:16", "16:9", "21:9",
        ],
        capabilities: variant === "standard"
          ? ["text_to_image", "image_to_image", "stylized"]
          : ["text_to_image", "image_to_image", "photoreal"],
        asyncMode:       "polling",
        supportsWebhook: true,
        supportsPolling: true,
      };
    },

    validateInput(input: ZProviderInput): ValidationResult {
      const errors: string[] = [];
      if (!input.prompt || input.prompt.trim().length < 3) {
        errors.push("Prompt must be at least 3 characters.");
      }
      if (variant === "nb2" && process.env.NANO_BANANA_ENABLE_V2 !== "true") {
        errors.push("Nano Banana 2 requires NANO_BANANA_ENABLE_V2=true.");
      }
      // Reference image for I2I — warn but don't block (T2I fallback is valid)
      const refs = resolveReferenceUrls(input);
      if (refs.length > 14) {
        errors.push("Nano Banana supports up to 14 reference images.");
      }
      return { valid: errors.length === 0, errors, warnings: [] };
    },

    estimateCost(input: ZProviderInput): CreditEstimate {
      const quality = (input.providerParams?.quality as string | undefined) ?? "1K";
      const creditMap: Record<NBVariant, Record<string, number>> = {
        standard: { "1K": 2, "2K": 2, "4K": 2 },
        pro:      { "1K": 2, "2K": 4, "4K": 8 },
        nb2:      { "1K": 2, "2K": 4, "4K": 8 },
      };
      const expected = creditMap[variant][quality] ?? 2;
      return { min: 2, max: 8, expected, breakdown: { base: expected } };
    },

    async createJob(input: ZProviderInput): Promise<ZJob> {
      const { apiKey, baseUrl, callbackUrl, nb2Endpoint } = getNanoBananaEnv();
      const jobId = newJobId();

      // ── Collect reference images ────────────────────────────────────────────
      const refs = resolveReferenceUrls(input);
      const isI2I = refs.length > 0;
      const quality = (input.providerParams?.quality as string | undefined) ?? "1K";

      // outputFormat: only NB2 exposes this in UI; Standard/Pro use NB server default.
      const outputFmt = (input.providerParams?.outputFormat as string | undefined);

      // googleSearch: backend-ready, not exposed in Zencra UI yet (Phase 1 lock).
      const useGoogleSearch = Boolean(input.providerParams?.useGoogleSearch);

      // ── Resolve aspect ratio ────────────────────────────────────────────────
      const arParam = input.aspectRatio && NB_SUPPORTED_ASPECT_RATIOS.has(input.aspectRatio)
        ? input.aspectRatio
        : undefined;

      // ── Build endpoint + payload ────────────────────────────────────────────
      let endpoint: string;
      let payload: Record<string, unknown>;

      if (variant === "pro") {
        const resolution = resolveResolution("pro", quality);
        endpoint = NB_ENDPOINTS.pro;
        payload = {
          prompt:      input.prompt,
          resolution,
          callBackUrl: callbackUrl,
          ...(arParam              ? { aspectRatio:   arParam }             : {}),
          ...(refs.length > 0      ? { imageUrls:     refs }                : {}),
          ...(useGoogleSearch      ? { googleSearch:  true }                : {}),
        };
      } else if (variant === "nb2") {
        // ── NB2 endpoint is configurable via NANO_BANANA_NB2_ENDPOINT.
        // Default: /api/v1/nanobanana/generate (same as Standard — proven working).
        // The previous /generate-v2 path returned 404 (Spring Boot "Not Found").
        // If your reseller account has a dedicated NB2 path, set the env var.
        endpoint = nb2Endpoint;
        payload = {
          // type is required by the /generate endpoint; include it for NB2 too.
          type:        isI2I ? NB_TYPE.image : NB_TYPE.text,
          prompt:      input.prompt,
          numImages:   1,
          callBackUrl: callbackUrl,
          // outputFormat is NB2-specific; only sent when explicitly set.
          ...(outputFmt            ? { format:        outputFmt }           : {}),
          ...(arParam              ? { aspectRatio:   arParam }             : {}),
          ...(refs.length > 0      ? { imageUrls:     refs }                : {}),
          ...(useGoogleSearch      ? { googleSearch:  true }                : {}),
        };
        // ── NB2 request diagnostics — log endpoint + full sanitized payload ──
        console.log(
          `[nano-banana][nb2] submitting to ${baseUrl}${endpoint}`,
          "\npayload:", JSON.stringify({
            ...payload,
            // callBackUrl included so we can verify the webhook path is correct
          }, null, 2)
        );
      } else {
        // standard — T2I or I2I depending on reference presence
        endpoint = NB_ENDPOINTS.standard;
        payload = {
          type:        isI2I ? NB_TYPE.image : NB_TYPE.text,
          prompt:      input.prompt,
          numImages:   1,
          callBackUrl: callbackUrl,
          ...(arParam              ? { aspectRatio:   arParam }             : {}),
          ...(refs.length > 0      ? { imageUrls:     refs }                : {}),
          ...(useGoogleSearch      ? { googleSearch:  true }                : {}),
        };
      }

      const fullUrl = `${baseUrl}${endpoint}`;
      console.log(`[nano-banana] variant=${variant} POST ${fullUrl}`);

      const res = await fetch(fullUrl, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
          "Accept":        "application/json",
        },
        body:   JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        let errBody = "(unreadable)";
        try { errBody = await res.text(); } catch { /* ignore */ }
        console.error(
          `[nano-banana] submit HTTP ${res.status} variant=${variant}`,
          `url=${fullUrl}`,
          `responseBody=${errBody.slice(0, 600)}`
        );
        throw new Error(`Nano Banana submit HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const rawText = await res.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        console.error(`[nano-banana] variant=${variant} non-JSON success response: ${rawText.slice(0, 300)}`);
        throw new Error(`Nano Banana returned non-JSON response: ${rawText.slice(0, 100)}`);
      }

      // ── Log full success response (critical for NB2 debugging) ─────────────
      console.log(
        `[nano-banana] variant=${variant} submit success HTTP ${res.status}`,
        `url=${fullUrl}`,
        `responseBody=${JSON.stringify(body).slice(0, 600)}`
      );

      // Body-level error check: NB sometimes returns HTTP 200 with a non-200 code in the body.
      const bodyCode = Number(body.code ?? 200);
      if (bodyCode !== 200 && bodyCode !== 0) {
        const bodyMsg = String(body.msg ?? body.message ?? body.error ?? "Unknown error");
        console.error(`[nano-banana] submit body-level error: code=${bodyCode} msg=${bodyMsg}`);
        throw new Error(`Nano Banana rejected the request: ${bodyMsg}`);
      }

      // data may be an object OR an array — normalise to object
      const rawData = body.data;
      const data: Record<string, unknown> =
        rawData == null             ? {} :
        Array.isArray(rawData)      ? ((rawData as unknown[])[0] ?? {}) as Record<string, unknown> :
        typeof rawData === "object" ? rawData as Record<string, unknown> :
        {};

      // Extract taskId — cover every known NB field name variant
      const taskId = String(
        data.taskId    ??
        data.task_id   ??
        data.recordId  ??
        data.record_id ??
        data.id        ??
        data.task      ??
        body.taskId    ??
        body.task_id   ??
        ""
      );

      if (!taskId || taskId === "undefined" || taskId === "null") {
        console.error(
          "[nano-banana] no task ID in response. Raw body:",
          JSON.stringify(body).slice(0, 500)
        );
        throw new Error("Nano Banana returned no task ID.");
      }

      const now = new Date();
      return {
        id: jobId, provider: "nano-banana", modelKey,
        studioType: "image", status: "pending", externalJobId: taskId,
        createdAt: now, updatedAt: now, identity: input.identity,
        providerMeta: { variant, taskId, isI2I, refCount: refs.length },
        estimatedCredits: input.estimatedCredits,
      };
    },

    async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
      const { apiKey, baseUrl } = getNanoBananaEnv();
      const res = await fetch(
        `${baseUrl}${NB_ENDPOINTS.task}?taskId=${encodeURIComponent(externalJobId)}`,
        {
          headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
          signal:  AbortSignal.timeout(15_000),
        }
      );
      if (!res.ok) {
        console.error(`[nano-banana] poll HTTP ${res.status} for taskId=${externalJobId}`);
        return { jobId: externalJobId, status: "error", error: `HTTP ${res.status}` };
      }

      const body = (await res.json()) as Record<string, unknown>;

      // ── FULL RAW LOG — always log the complete response for traceability ──
      console.log(
        `[nano-banana] poll taskId=${externalJobId} raw body:`,
        JSON.stringify(body)
      );

      // ── body.data is the primary payload ─────────────────────────────────
      const data = (
        body.data != null && typeof body.data === "object" && !Array.isArray(body.data)
          ? body.data
          : body
      ) as Record<string, unknown>;

      // ── CONFIRMED PRODUCTION STRUCTURE (Apr 20 2026, from raw response logs)
      //
      // Nano Banana returns:
      //   body.data.successFlag        = 1           → SUCCESS
      //   body.data.response           = { resultImageUrl: "https://tempfile.aiquickdraw.com/..." }
      //
      // Previous assumptions (taskStatus, status, result_urls) do NOT appear
      // in production responses from the record-info endpoint.

      // ── 1. PRIMARY: successFlag + nested response.resultImageUrl ──────────
      const successFlag = Number((data as Record<string, unknown>).successFlag ?? -1);
      const responseObj = (data as Record<string, unknown>).response;
      const nestedUrl =
        responseObj && typeof responseObj === "object" && !Array.isArray(responseObj)
          ? (responseObj as Record<string, unknown>).resultImageUrl
          : undefined;

      if (successFlag === 1 && typeof nestedUrl === "string" && nestedUrl.trim()) {
        const imageUrl = nestedUrl.trim();
        console.log(`[nano-banana] taskId=${externalJobId} SUCCESS via successFlag+resultImageUrl url=${imageUrl.slice(0, 80)}`);
        return { jobId: externalJobId, status: "success", url: imageUrl };
      }

      // ── 2. FALLBACK: legacy / alternate field names ───────────────────────
      // Keep these so the parser degrades gracefully if NB changes shape again.
      const extractUrl = (src: Record<string, unknown>): string | undefined => {
        // result_urls (array or comma-string)
        if (Array.isArray(src.result_urls)) {
          for (const u of src.result_urls) {
            if (typeof u === "string" && u.trim()) return u.trim();
          }
        }
        if (typeof src.result_urls === "string" && src.result_urls) {
          const first = src.result_urls.split(",")[0].trim();
          if (first) return first;
        }
        // Scalar URL fields
        if (typeof src.imageUrl  === "string" && src.imageUrl)  return src.imageUrl;
        if (typeof src.image_url === "string" && src.image_url) return src.image_url;
        if (typeof src.url       === "string" && src.url)       return src.url;
        if (typeof src.imagUrl   === "string" && src.imagUrl)   return src.imagUrl;
        // Array shorthands
        if (Array.isArray(src.images)    && typeof src.images[0]    === "string") return src.images[0] as string;
        if (Array.isArray(src.imageUrls) && typeof src.imageUrls[0] === "string") return src.imageUrls[0] as string;
        // Nested output / result objects
        if (src.output && typeof src.output === "object") {
          const out = src.output as Record<string, unknown>;
          if (typeof out.image === "string" && out.image) return out.image;
          if (typeof out.url   === "string" && out.url)   return out.url;
        }
        if (src.result && typeof src.result === "object") {
          const r2 = src.result as Record<string, unknown>;
          if (typeof r2.url   === "string" && r2.url)   return r2.url;
          if (typeof r2.image === "string" && r2.image) return r2.image;
        }
        // Nested response.resultImageUrl (catch via fallback as well)
        if (src.response && typeof src.response === "object") {
          const rsp = src.response as Record<string, unknown>;
          if (typeof rsp.resultImageUrl === "string" && rsp.resultImageUrl) return rsp.resultImageUrl;
          if (typeof rsp.imageUrl       === "string" && rsp.imageUrl)       return rsp.imageUrl;
          if (typeof rsp.url            === "string" && rsp.url)            return rsp.url;
        }
        return undefined;
      };

      const fallbackUrl = extractUrl(data) ?? extractUrl(body as Record<string, unknown>);
      if (fallbackUrl) {
        console.log(`[nano-banana] taskId=${externalJobId} SUCCESS via fallback url=${fallbackUrl.slice(0, 80)}`);
        return { jobId: externalJobId, status: "success", url: fallbackUrl };
      }

      // ── 3. Explicit failure codes ─────────────────────────────────────────
      const taskStatusNum = Number(
        (data as Record<string, unknown>).taskStatus ??
        (data as Record<string, unknown>).task_status ?? -1
      );
      const taskStatusStr = String(
        (data as Record<string, unknown>).status ??
        (data as Record<string, unknown>).taskStatusStr ?? ""
      ).toUpperCase();

      const isFailed =
        taskStatusNum === 2 || taskStatusNum === 3 ||
        ["FAILED", "ERROR", "CREATE_TASK_FAILED", "GENERATE_FAILED"].includes(taskStatusStr);

      if (isFailed) {
        const failMsg = String(
          (data as Record<string, unknown>).msg     ??
          (data as Record<string, unknown>).message ??
          (data as Record<string, unknown>).error   ??
          body.msg ?? body.message ?? "Generation failed."
        );
        console.error(`[nano-banana] taskId=${externalJobId} FAILED taskStatus=${taskStatusNum} msg=${failMsg}`);
        return { jobId: externalJobId, status: "error", error: failMsg };
      }

      // ── 4. No URL and no explicit failure → still processing ─────────────
      console.log(
        `[nano-banana] taskId=${externalJobId} pending` +
        ` successFlag=${successFlag} taskStatus=${taskStatusNum} statusStr=${taskStatusStr}`
      );
      return { jobId: externalJobId, status: "pending" };
    },

    async cancelJob(_: string): Promise<void> { /* NB has no cancel endpoint */ },

    normalizeOutput(raw: unknown): ZProviderResult {
      const data = raw as Record<string, unknown>;
      return {
        jobId:    String(data.taskId ?? ""),
        provider: "nano-banana",
        modelKey,
        status:   "success",
        url:      String(data.imageUrl ?? ""),
      };
    },

    async handleWebhook(payload: WebhookPayload): Promise<ZJobStatus> {
      // NB webhooks carry task completion data — delegate to status check
      return this.getJobStatus(payload.externalJobId);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect reference image URLs from ZProviderInput.
 * Priority: providerParams.referenceUrls[] (multi) → imageUrl (single)
 * Capped at 14 per NB API limit.
 */
function resolveReferenceUrls(input: ZProviderInput): string[] {
  // Multi-reference array (passed from UI as providerParams.referenceUrls)
  const multi = input.providerParams?.referenceUrls;
  if (Array.isArray(multi) && multi.length > 0) {
    const cleaned = (multi as unknown[])
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .slice(0, 14);
    if (cleaned.length > 0) return cleaned;
  }

  // Single reference image (legacy imageUrl field)
  if (input.imageUrl && input.imageUrl.trim().length > 0) {
    return [input.imageUrl];
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

export const nanoBananaStandardProvider = buildNanoBananaProvider("nano-banana-standard", "Nano Banana");
export const nanoBananaProProvider      = buildNanoBananaProvider("nano-banana-pro",      "Nano Banana Pro");
export const nanoBanana2Provider        = buildNanoBananaProvider("nano-banana-2",        "Nano Banana 2");
