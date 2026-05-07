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
// STRUCTURED PROVIDER ERROR
// ─────────────────────────────────────────────────────────────────────────────

export type NBErrorCode =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_CONFIG_ERROR"
  | "PROVIDER_BAD_REQUEST"
  | "PROVIDER_UNKNOWN";

export class NanoBananaError extends Error {
  readonly code: NBErrorCode;
  readonly provider = "nano-banana" as const;
  readonly model: string;
  readonly retryable: boolean;
  readonly suggestion?: string;

  constructor(
    message: string,
    code: NBErrorCode,
    model: string,
    retryable: boolean,
    suggestion?: string
  ) {
    super(message);
    this.name = "NanoBananaError";
    this.code      = code;
    this.model     = model;
    this.retryable = retryable;
    if (suggestion) this.suggestion = suggestion;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HTTP status codes that are safe to retry (transient failures).
 * Do NOT retry on 400, 401, 403, 422 — those are permanent failures.
 */
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

interface RetryOptions {
  maxRetries?: number;        // default 2
  baseDelayMs?: number;       // default 1000 ms
  label?: string;             // for logging
}

/**
 * Wraps a fetch-style async function with exponential-backoff retry.
 * Retries only on network errors and RETRYABLE_HTTP_STATUS codes.
 * Never retries on AbortError (timeout) on the final attempt —
 * callers receive a NanoBananaError with code PROVIDER_TIMEOUT.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean,
  opts: RetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelay  = opts.baseDelayMs ?? 1000;
  const label      = opts.label ?? "nano-banana";

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const retry = attempt < maxRetries && isRetryable(err);
      if (!retry) break;

      const delay = baseDelay * Math.pow(2, attempt); // 1s, 2s
      console.warn(
        `[${label}] attempt ${attempt + 1}/${maxRetries + 1} failed — ` +
        `retrying in ${delay}ms. Error: ${err instanceof Error ? err.message : String(err)}`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * Classify whether an error from a fetch call is retryable.
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    // AbortError = timeout — retryable (provider may have been slow)
    if (err.name === "AbortError" || err.name === "TimeoutError") return true;
    // Network-level errors (ECONNRESET, ENOTFOUND, etc.)
    if (err.message.includes("fetch failed") ||
        err.message.includes("network") ||
        err.message.includes("ECONNRESET")) return true;
    // HTTP errors embedded in message (our throw pattern)
    const statusMatch = err.message.match(/HTTP (\d+)/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return RETRYABLE_HTTP_STATUS.has(status);
    }
  }
  return false;
}

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

// NB Standard + Pro — 10 supported AR options.
// Pro additionally allows "Auto" (= no aspectRatio sent), handled UI-side.
// Keep in sync with NB_STANDARD_AR / NB_PRO_AR in image/page.tsx.
const NB_SUPPORTED_ASPECT_RATIOS = new Set([
  "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "21:9",
]);

// NB2 — 6 dimension-map entries (Auto → undefined → NB2 default).
// Keep in sync with NB2_AR list in image/page.tsx.
const NB2_SUPPORTED_ASPECT_RATIOS = new Set([
  "1:1", "4:5", "5:4", "9:16", "16:9", "8:1",
]);

/**
 * Internal safety rule: any AR that slips through UI hard-lock for NB2
 * gets forced to 1:1 rather than silently generating a wrong-ratio image.
 * Keep this in sync with NB2_AR_FALLBACK_UI in image/page.tsx.
 */
const NB2_AR_FALLBACK: Record<string, string> = {
  "2:3":  "1:1",
  "3:2":  "1:1",
  "3:4":  "1:1",
  "4:3":  "1:1",
  "21:9": "1:1",
  "1:4":  "1:1",
  "1:8":  "1:1",
  "4:1":  "1:1",
};

/**
 * NB2 dimension map — the /generate endpoint ignores `aspectRatio`.
 * Explicit width + height must be sent instead.
 * Dimensions are chosen to be multiples of 64 and within typical NB limits.
 */
const NB2_DIMENSION_MAP: Record<string, { width: number; height: number }> = {
  "1:1":  { width: 1024, height: 1024 },
  "16:9": { width: 1792, height: 1024 },
  "9:16": { width: 1024, height: 1792 },
  "4:3":  { width: 1365, height: 1024 },
  "3:4":  { width: 1024, height: 1365 },
  "3:2":  { width: 1536, height: 1024 },
  "2:3":  { width: 1024, height: 1536 },
  "4:5":  { width: 1024, height: 1280 },
  "5:4":  { width: 1280, height: 1024 },
  "4:1":  { width: 2048, height:  512 },
  "1:4":  { width:  512, height: 2048 },
  "8:1":  { width: 2048, height:  256 },
  "1:8":  { width:  256, height: 2048 },
};

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

    estimateCost(_input: ZProviderInput): CreditEstimate {
      // ── STUBBED — do not perform credit math here ─────────────────────────────
      // Per the Zencra sacred rule: no provider adapter may calculate credit costs.
      // All billing flows through calculateCreditCost() in src/lib/credits/engine.ts,
      // called by hooks.ts estimate() which reads from credit_model_costs (DB).
      //
      // This method is NOT called in the billing path. It exists to satisfy the
      // ZProvider interface. If you see this logged in production, a caller is
      // incorrectly setting input.estimatedCredits from this method — investigate.
      console.error(
        `[nano-banana] estimateCost() called on model=${variant} — ` +
        `this is a stub; all billing must go through engine.ts + hooks.ts`
      );
      return { min: 0, max: 0, expected: 0, breakdown: {} };
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
      // NB2 has a narrower supported set than Standard/Pro.
      // If the requested AR isn't supported, substitute the closest alternative
      // and log it so server traces show exactly what was swapped.
      let arParam: string | undefined;
      let arFallbackUsed: string | undefined; // original AR before substitution

      if (variant === "nb2") {
        const requested = input.aspectRatio ?? "";
        if (!requested) {
          // Empty/undefined → let NB2 use its server default (typically 1:1).
          // "Auto" is converted to undefined by mapArForNB in page.tsx before dispatch.
          arParam = undefined;
        } else if (NB2_SUPPORTED_ASPECT_RATIOS.has(requested)) {
          arParam = requested;
        } else {
          // INTERNAL SAFETY RULE: any AR not in the supported set → force 1:1.
          // This is the server-side guard; the UI hard-lock is the first line of defence.
          arFallbackUsed = requested;
          arParam = NB2_AR_FALLBACK[requested] ?? "1:1";
          console.log(
            `[nano-banana][nb2] AR safety fallback: "${requested}" not in NB2 supported set → forcing "${arParam}"`
          );
        }
      } else {
        arParam = input.aspectRatio && NB_SUPPORTED_ASPECT_RATIOS.has(input.aspectRatio)
          ? input.aspectRatio
          : undefined;
      }

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

        // ── NB2 dimension fix ─────────────────────────────────────────────────
        // The /generate endpoint IGNORES the `aspectRatio` field entirely and
        // always defaults to 1:1 if no dimensions are supplied.
        // Fix: look up explicit width + height from the dimension map instead.
        const nb2Dims = arParam ? (NB2_DIMENSION_MAP[arParam] ?? null) : null;
        console.log(
          `[nano-banana-2] requested_ar: "${input.aspectRatio ?? "Auto"}" resolved_ar: "${arParam ?? "Auto"}"` +
          ` width: ${nb2Dims?.width ?? "default"} height: ${nb2Dims?.height ?? "default"}`
        );

        payload = {
          // type is required by the /generate endpoint; include it for NB2 too.
          type:        isI2I ? NB_TYPE.image : NB_TYPE.text,
          prompt:      input.prompt,
          numImages:   1,
          callBackUrl: callbackUrl,
          // outputFormat is NB2-specific; only sent when explicitly set.
          ...(outputFmt            ? { format:        outputFmt }           : {}),
          // Send explicit width/height instead of aspectRatio — NB2 API requires it.
          ...(nb2Dims              ? { width: nb2Dims.width, height: nb2Dims.height } : {}),
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

      // ── Submit with retry (exponential backoff, max 2 retries) ────────────────
      const res = await withRetry(
        () => fetch(fullUrl, {
          method:  "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type":  "application/json",
            "Accept":        "application/json",
          },
          body:   JSON.stringify(payload),
          signal: AbortSignal.timeout(90_000), // 90s provider timeout (Phase 1 standard)
        }),
        isRetryableError,
        { label: `nano-banana[${variant}] submit`, maxRetries: 2, baseDelayMs: 1000 }
      ).catch((err) => {
        // Classify the final error into a structured NanoBananaError
        const isTimeout  = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
        const httpMatch  = err instanceof Error ? err.message.match(/HTTP (\d+)/) : null;
        const httpStatus = httpMatch ? parseInt(httpMatch[1], 10) : 0;

        if (isTimeout) {
          throw new NanoBananaError(
            `Nano Banana timed out after 90s. Try again or switch to GPT Image.`,
            "PROVIDER_TIMEOUT", modelKey, true,
            "Nano Banana is slow to respond. GPT Image may be faster right now."
          );
        }
        if (httpStatus === 429) {
          throw new NanoBananaError(
            `Nano Banana rate limit reached. Please wait a moment and try again.`,
            "PROVIDER_RATE_LIMIT", modelKey, true
          );
        }
        if (httpStatus === 401 || httpStatus === 403) {
          throw new NanoBananaError(
            `Nano Banana API key is invalid or expired.`,
            "PROVIDER_CONFIG_ERROR", modelKey, false
          );
        }
        if (httpStatus === 400 || httpStatus === 422) {
          throw new NanoBananaError(
            `Nano Banana rejected the request payload.`,
            "PROVIDER_BAD_REQUEST", modelKey, false
          );
        }
        throw new NanoBananaError(
          `Nano Banana submit failed. ${err instanceof Error ? err.message : String(err)}`,
          "PROVIDER_UNKNOWN", modelKey, false,
          "Nano Banana is unavailable. Try GPT Image instead."
        );
      });

      if (!res.ok) {
        let errBody = "(unreadable)";
        try { errBody = await res.text(); } catch { /* ignore */ }
        console.error(
          `[nano-banana] submit HTTP ${res.status} variant=${variant}`,
          `url=${fullUrl}`,
          `responseBody=${errBody.slice(0, 600)}`
        );
        // Classify permanent vs retryable HTTP errors
        const isPermanent = res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422;
        throw new NanoBananaError(
          `Nano Banana submit HTTP ${res.status}: ${errBody.slice(0, 200)}`,
          isPermanent ? "PROVIDER_BAD_REQUEST" : "PROVIDER_UNKNOWN",
          modelKey,
          !isPermanent,
          isPermanent ? undefined : "Nano Banana is unavailable. Try GPT Image instead."
        );
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
        providerMeta: { variant, taskId, isI2I, refCount: refs.length, arFallback: arFallbackUsed },
        estimatedCredits: input.estimatedCredits,
      };
    },

    async getJobStatus(externalJobId: string): Promise<ZJobStatus> {
      const { apiKey, baseUrl } = getNanoBananaEnv();
      let res: Response;
      try {
        res = await withRetry(
          () => fetch(
            `${baseUrl}${NB_ENDPOINTS.task}?taskId=${encodeURIComponent(externalJobId)}`,
            {
              headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
              signal:  AbortSignal.timeout(15_000),
            }
          ),
          isRetryableError,
          { label: `nano-banana poll[${externalJobId}]`, maxRetries: 2, baseDelayMs: 1000 }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[nano-banana] poll failed for taskId=${externalJobId}:`, msg);
        return { jobId: externalJobId, status: "error", error: `Poll failed: ${msg}` };
      }
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
