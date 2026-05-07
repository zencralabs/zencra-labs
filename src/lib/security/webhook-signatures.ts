/**
 * src/lib/security/webhook-signatures.ts
 *
 * Zencra Shield — Webhook Signature Verification.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  WHY WEBHOOK VERIFICATION?                                               │
 * │                                                                          │
 * │  Without signature verification, any actor who knows the webhook URL     │
 * │  can inject fake job-completion events:                                  │
 * │    • Mark a failed job as succeeded — user gets output without paying    │
 * │    • Mark a succeeded job as failed — trigger a refund + re-run         │
 * │    • Inject a URL pointing to malicious content                          │
 * │    • Replay a valid completion event from an earlier request             │
 * │                                                                          │
 * │  Provider HMAC signatures bind the payload to a shared secret.          │
 * │  Replay timestamps bind the event to a time window.                     │
 * │  Together they ensure only the real provider can trigger our jobs.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Design:
 *   - Provider-agnostic public API: one function, one result type
 *   - Per-provider private verifiers handle header names + payload formats
 *   - All outcomes emit SecurityEvents (invalid/missing/replay → alerts)
 *   - Mode-aware: permissive (observe/dry-run) always proceeds; enforce blocks
 *   - Replay protection: configurable timestamp window per provider
 *   - Never throws — returns "unsupported" outcome on internal error
 *
 * Outcomes:
 *   valid          — HMAC matched, timestamp within window (if present)
 *   invalid        — HMAC present but mismatch (spoofing attempt or misconfiguration)
 *   missing        — No signature header when a secret is configured
 *   replay         — Timestamp outside acceptable replay window
 *   missing_secret — Secret not configured; cannot verify (no alert, info log)
 *   unsupported    — Provider has no documented signature scheme
 *
 * Mode gate (WEBHOOK_ENFORCEMENT_MODE env var):
 *   dry-run  — log only; always proceed (safe default)
 *   observe  — Discord alert; always proceed (permissive)
 *   enforce  — Discord alert; block on invalid/missing/replay (return false)
 *
 * Providers and their signature schemes:
 *   fal          — HMAC-SHA256, header: x-fal-signature, format: "sha256=<hex>"
 *   kling        — HMAC-SHA256, header: x-kling-signature, format: raw hex
 *   byteplus     — HMAC-SHA256, header: x-byteplus-signature, format: raw hex
 *   runway       — HMAC-SHA256, header: x-runway-signature, format: raw hex
 *   heygen-ugc   — HMAC-SHA256, header: x-heygen-signature, format: raw hex
 *   creatify     — HMAC-SHA256, header: x-creatify-signature, format: raw hex
 *   arcads       — HMAC-SHA256, header: x-arcads-signature, format: raw hex
 *   nano-banana  — No documented signature scheme → missing_secret
 *   openai       — HMAC-SHA256, header: webhook-id + webhook-timestamp + webhook-signature
 *
 * Replay window:
 *   Default: 300 seconds (5 minutes)
 *   Env: WEBHOOK_REPLAY_WINDOW_SECONDS
 *   Applies only to providers that include a timestamp in their headers.
 *   Providers without timestamp headers skip the replay check.
 */

import { emitSecurityEvent, resolveShieldMode } from "@/lib/security/events";
import { logger } from "@/lib/logger";
import type { WebhookEvent, SecurityActionTaken, ShieldMode } from "@/lib/security/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_REPLAY_WINDOW_SECONDS = 300; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WebhookVerificationOutcome =
  | "valid"           // HMAC matched, timestamp within window (if present)
  | "invalid"         // HMAC present but mismatch — spoofing or misconfiguration
  | "missing"         // No signature header when secret is configured
  | "replay"          // Timestamp outside acceptable replay window
  | "missing_secret"  // Secret not configured — cannot verify (no alert; info log only)
  | "unsupported";    // Provider has no documented signature scheme

export interface WebhookVerificationResult {
  /** What the verifier concluded */
  outcome:           WebhookVerificationOutcome;
  /** The provider key (echoed for caller convenience) */
  providerKey:       string;
  /** Provider-supplied event/request ID, if extractable from headers */
  webhookEventId?:   string;
  /** How old this webhook payload is in milliseconds (from provider timestamp header) */
  timestampDeltaMs?: number;
  /**
   * Whether the calling route should continue processing this webhook.
   *
   * permissive (dry-run/observe): always true — log and alert, never block
   * enforce: true only for "valid" and "missing_secret" outcomes
   *
   * Routes MUST check this before processing the payload:
   *   const result = await verifyWebhookSignature(provider, rawBody, req);
   *   if (!result.shouldProceed) return new Response("Unauthorized", { status: 401 });
   */
  shouldProceed:     boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal verifier contract
// ─────────────────────────────────────────────────────────────────────────────

interface VerifierInput {
  rawBody:  string;
  headers:  Headers;
  secret?:  string;
}

interface VerifierResult {
  outcome:           WebhookVerificationOutcome;
  webhookEventId?:   string;
  timestampDeltaMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config helpers
// ─────────────────────────────────────────────────────────────────────────────

function getReplayWindowMs(): number {
  const raw = parseInt(
    process.env.WEBHOOK_REPLAY_WINDOW_SECONDS ?? String(DEFAULT_REPLAY_WINDOW_SECONDS),
    10,
  );
  return (isNaN(raw) || raw < 0 ? DEFAULT_REPLAY_WINDOW_SECONDS : raw) * 1000;
}

function resolveWebhookMode(): ShieldMode {
  const global = resolveShieldMode();
  const raw    = process.env.WEBHOOK_ENFORCEMENT_MODE?.trim().toLowerCase();
  if (raw === "dry-run" || raw === "observe" || raw === "enforce") return raw;
  return global;
}

function actionForOutcome(
  outcome: WebhookVerificationOutcome,
  mode:    ShieldMode,
): SecurityActionTaken {
  if (outcome === "valid" || outcome === "missing_secret" || outcome === "unsupported") {
    return mode !== "dry-run" ? "alerted" : "logged_only";
  }
  return mode === "enforce" ? "access_denied" : mode === "observe" ? "alerted" : "logged_only";
}

function shouldProceedForOutcome(
  outcome: WebhookVerificationOutcome,
  mode:    ShieldMode,
): boolean {
  // These outcomes never block, regardless of mode
  if (outcome === "valid" || outcome === "missing_secret" || outcome === "unsupported") {
    return true;
  }
  // invalid / missing / replay — block only in enforce mode
  return mode !== "enforce";
}

// ─────────────────────────────────────────────────────────────────────────────
// HMAC core — used by all standard HMAC-SHA256 providers
// ─────────────────────────────────────────────────────────────────────────────

function hexToBuffer(hex: string): ArrayBuffer {
  const normalized = hex.startsWith("sha256=") ? hex.slice(7) : hex;
  const arr = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    arr[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return arr.buffer;
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const arr    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr.buffer;
}

function isHex(s: string): boolean {
  return /^(sha256=)?[0-9a-fA-F]+$/.test(s);
}

async function verifyHmacSha256(
  body:      string,
  sigHeader: string,
  secret:    string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBuf = isHex(sigHeader) ? hexToBuffer(sigHeader) : base64ToBuffer(sigHeader);
    return await crypto.subtle.verify("HMAC", key, sigBuf, enc.encode(body));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp replay check helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks a Unix-seconds or Unix-milliseconds timestamp from a header.
 * Returns the delta in ms, or null if the header is absent/unparseable.
 */
function checkTimestampHeader(
  headers:    Headers,
  headerName: string,
): { deltaMs: number } | null {
  const raw = headers.get(headerName);
  if (!raw) return null;

  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return null;

  // Normalise to milliseconds (Unix seconds values are < 1e11)
  const tsMs  = parsed < 1e11 ? parsed * 1000 : parsed;
  const delta = Date.now() - tsMs;
  return { deltaMs: delta };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-provider verifiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard HMAC verifier shared by most providers.
 * Checks the specified header name, then applies optional replay check.
 */
async function verifyStandardHmac(
  input:        VerifierInput,
  sigHeaderName: string,
  tsHeaderName?: string,    // Optional timestamp header for replay check
  eventIdHeader?: string,   // Optional event ID header
): Promise<VerifierResult> {
  const { rawBody, headers, secret } = input;

  if (!secret) {
    return {
      outcome:          "missing_secret",
      webhookEventId:   eventIdHeader ? (headers.get(eventIdHeader) ?? undefined) : undefined,
    };
  }

  const sigHeader   = headers.get(sigHeaderName) ?? "";
  const webhookEventId = eventIdHeader ? (headers.get(eventIdHeader) ?? undefined) : undefined;

  if (!sigHeader) {
    return { outcome: "missing", webhookEventId };
  }

  // ── Timestamp replay check (before HMAC) ──────────────────────────────────
  let timestampDeltaMs: number | undefined;
  if (tsHeaderName) {
    const tsResult = checkTimestampHeader(headers, tsHeaderName);
    if (tsResult !== null) {
      timestampDeltaMs = tsResult.deltaMs;
      if (tsResult.deltaMs > getReplayWindowMs()) {
        return { outcome: "replay", webhookEventId, timestampDeltaMs };
      }
    }
  }

  // ── HMAC verification ─────────────────────────────────────────────────────
  const valid = await verifyHmacSha256(rawBody, sigHeader, secret);
  return {
    outcome:          valid ? "valid" : "invalid",
    webhookEventId,
    timestampDeltaMs,
  };
}

/**
 * fal.ai: HMAC-SHA256
 * Signature header: x-fal-signature — format: "sha256=<hex>"
 * Timestamp header: x-fal-timestamp (Unix seconds)
 * Event ID: x-fal-request-id
 */
async function verifyFal(input: VerifierInput): Promise<VerifierResult> {
  return verifyStandardHmac(
    input,
    "x-fal-signature",
    "x-fal-timestamp",
    "x-fal-request-id",
  );
}

/**
 * Kling AI: HMAC-SHA256
 * Signature header: x-kling-signature — format: raw hex
 * Event ID: x-kling-request-id
 */
async function verifyKling(input: VerifierInput): Promise<VerifierResult> {
  return verifyStandardHmac(
    input,
    "x-kling-signature",
    undefined,            // Kling does not send a timestamp header
    "x-kling-request-id",
  );
}

/**
 * BytePlus / Seedance: HMAC-SHA256
 * Signature header: x-byteplus-signature — format: raw hex
 */
async function verifyByteplus(input: VerifierInput): Promise<VerifierResult> {
  return verifyStandardHmac(input, "x-byteplus-signature");
}

/**
 * Runway: HMAC-SHA256
 * Signature header: x-runway-signature — format: raw hex
 * Event ID: x-runway-event-id
 */
async function verifyRunway(input: VerifierInput): Promise<VerifierResult> {
  return verifyStandardHmac(
    input,
    "x-runway-signature",
    undefined,
    "x-runway-event-id",
  );
}

/**
 * HeyGen UGC: HMAC-SHA256
 * Signature header: x-heygen-signature — format: raw hex
 */
async function verifyHeygenUgc(input: VerifierInput): Promise<VerifierResult> {
  return verifyStandardHmac(input, "x-heygen-signature");
}

/**
 * Creatify: HMAC-SHA256
 * Signature header: x-creatify-signature — format: raw hex
 */
async function verifyCreatify(input: VerifierInput): Promise<VerifierResult> {
  return verifyStandardHmac(input, "x-creatify-signature");
}

/**
 * Arcads: HMAC-SHA256
 * Signature header: x-arcads-signature — format: raw hex
 */
async function verifyArcads(input: VerifierInput): Promise<VerifierResult> {
  return verifyStandardHmac(input, "x-arcads-signature");
}

/**
 * OpenAI: Webhook standard (svix-compatible)
 * Headers: webhook-id, webhook-timestamp, webhook-signature
 * Scheme: HMAC-SHA256 of "{webhook-id}.{webhook-timestamp}.{rawBody}"
 * Signatures may be comma-separated (multiple signing keys).
 */
async function verifyOpenAI(input: VerifierInput): Promise<VerifierResult> {
  const { rawBody, headers, secret } = input;

  if (!secret) return { outcome: "missing_secret" };

  const msgId  = headers.get("webhook-id")        ?? "";
  const msgTs  = headers.get("webhook-timestamp") ?? "";
  const msgSig = headers.get("webhook-signature") ?? "";

  const webhookEventId = msgId || undefined;

  if (!msgSig) return { outcome: "missing", webhookEventId };

  // Replay check using webhook-timestamp
  if (msgTs) {
    const parsed = parseInt(msgTs, 10);
    if (!isNaN(parsed)) {
      const tsMs   = parsed < 1e11 ? parsed * 1000 : parsed;
      const deltaMs = Date.now() - tsMs;
      if (deltaMs > getReplayWindowMs()) {
        return { outcome: "replay", webhookEventId, timestampDeltaMs: deltaMs };
      }
    }
  }

  // OpenAI signs the concatenated string: "{webhook-id}.{webhook-timestamp}.{rawBody}"
  const signedContent = `${msgId}.${msgTs}.${rawBody}`;

  // Signatures can be a comma-separated list "v1,<b64> v1,<b64>" or just "v1,<b64>"
  // Try all provided signatures — any match is valid (key rotation support)
  const sigs = msgSig.split(" ").map((s) => s.replace(/^v\d+,/, ""));
  for (const sig of sigs) {
    if (!sig) continue;
    const valid = await verifyHmacSha256(signedContent, sig, secret);
    if (valid) return { outcome: "valid", webhookEventId };
  }

  return { outcome: "invalid", webhookEventId };
}

/**
 * Nano Banana: No documented signature scheme.
 * NB does not sign webhooks at this time.
 * We log at info level but never alert — this is known and expected.
 */
function verifyNanoBanana(_input: VerifierInput): VerifierResult {
  return { outcome: "unsupported" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider dispatch map
// ─────────────────────────────────────────────────────────────────────────────

type VerifierFn = (input: VerifierInput) => Promise<VerifierResult> | VerifierResult;

const VERIFIERS: Record<string, VerifierFn> = {
  "fal":          verifyFal,
  "kling":        verifyKling,
  "byteplus":     verifyByteplus,
  "runway":       verifyRunway,
  "heygen-ugc":   verifyHeygenUgc,
  "creatify":     verifyCreatify,
  "arcads":       verifyArcads,
  "openai":       verifyOpenAI,
  "nano-banana":  verifyNanoBanana,
};

// ─────────────────────────────────────────────────────────────────────────────
// SecurityEvent emitter
// ─────────────────────────────────────────────────────────────────────────────

async function emitWebhookEvent(
  outcome:          WebhookVerificationOutcome,
  providerKey:      string,
  mode:             ShieldMode,
  webhookEventId?:  string,
  timestampDeltaMs?: number,
): Promise<void> {
  // "valid", "missing_secret", "unsupported" do not generate SecurityEvents
  // They are logged at the caller level only
  if (outcome === "valid" || outcome === "missing_secret" || outcome === "unsupported") return;

  const rule: WebhookEvent["rule"] =
    outcome === "replay"   ? "webhook.replay.detected"   :
    outcome === "missing"  ? "webhook.signature.missing" :
    "webhook.signature.invalid";  // invalid

  const replayWindowSec = getReplayWindowMs() / 1000;
  const ageSec = timestampDeltaMs != null ? timestampDeltaMs / 1000 : 0;

  const event: WebhookEvent = {
    rule,
    severity:      rule === "webhook.signature.invalid" || rule === "webhook.replay.detected"
                     ? "critical" : "warning",
    threshold: {
      metric:          rule === "webhook.replay.detected" ? "webhook_age_seconds" : "signature_valid",
      configuredValue: rule === "webhook.replay.detected" ? replayWindowSec : 1,
      observedValue:   rule === "webhook.replay.detected" ? ageSec          : 0,
      unit:            rule === "webhook.replay.detected" ? "seconds"        : "bool",
    },
    actionTaken:   actionForOutcome(outcome, mode),
    actionReason:  outcome === "replay"
      ? `${providerKey} webhook timestamp ${ageSec.toFixed(0)}s old — outside replay window (${replayWindowSec}s). Possible replay attack.`
      : outcome === "missing"
        ? `${providerKey} webhook received with no signature header — secret is configured, signature is expected.`
        : `${providerKey} webhook HMAC signature mismatch — payload may have been tampered with or secret is misconfigured.`,
    mode,
    providerKey,
    webhookEventId,
    timestampDeltaMs,
  };

  void emitSecurityEvent(event).catch((err) => {
    logger.warn("shield/webhook", "emitSecurityEvent failed", { error: String(err) });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WEBHOOK_SECRETS — the canonical secret map for all providers.
 * Exported so the webhook route can remove its own copy and import this instead.
 *
 * All values are read at call time (not module init) to support env injection
 * without server restarts during development.
 */
export function getWebhookSecret(provider: string): string | undefined {
  const secrets: Record<string, string | undefined> = {
    "fal":           process.env.FAL_WEBHOOK_SECRET,
    "kling":         process.env.KLING_WEBHOOK_SECRET,
    "byteplus":      process.env.BYTEPLUS_WEBHOOK_SECRET,
    "runway":        process.env.RUNWAY_WEBHOOK_SECRET,
    "heygen-ugc":    process.env.HEYGEN_WEBHOOK_SECRET,
    "creatify":      process.env.CREATIFY_WEBHOOK_SECRET,
    "arcads":        process.env.ARCADS_WEBHOOK_SECRET,
    "openai":        process.env.OPENAI_WEBHOOK_SECRET,
    "nano-banana":   process.env.NANO_BANANA_WEBHOOK_SECRET, // optional — NB doesn't sign
  };
  return secrets[provider];
}

/**
 * verifyWebhookSignature
 *
 * The single public entry point for all webhook signature verification.
 *
 * Dispatches to the correct per-provider verifier, emits SecurityEvents for
 * invalid/missing/replay outcomes, and returns a mode-aware `shouldProceed`
 * flag that the calling route uses to gate the rest of webhook processing.
 *
 * Call this IMMEDIATELY after reading the raw body, BEFORE JSON parsing:
 *
 *   const rawBody = await req.text();
 *   const result  = await verifyWebhookSignature(provider, rawBody, req.headers);
 *   if (!result.shouldProceed) {
 *     return new Response("Unauthorized", { status: 401 });
 *   }
 *   const raw = JSON.parse(rawBody);
 *   // ... continue processing
 *
 * Never throws — returns { outcome: "unsupported", shouldProceed: true } on error.
 *
 * @param providerKey  The [provider] path segment from the webhook URL
 * @param rawBody      Raw request body string (from req.text())
 * @param headers      Request headers (req.headers in Next.js)
 */
export async function verifyWebhookSignature(
  providerKey: string,
  rawBody:     string,
  headers:     Headers,
): Promise<WebhookVerificationResult> {
  const mode = resolveWebhookMode();

  try {
    const secret   = getWebhookSecret(providerKey);
    const verifier = VERIFIERS[providerKey];

    // Unknown provider — no verifier registered
    if (!verifier) {
      logger.info("shield/webhook", "No verifier registered for provider", {
        providerKey,
        mode,
      });
      return {
        outcome:       "unsupported",
        providerKey,
        shouldProceed: true,
      };
    }

    const result = await verifier({ rawBody, headers, secret });

    // ── Structured log for every outcome ──────────────────────────────────────
    const logData = {
      providerKey,
      outcome:          result.outcome,
      mode,
      webhookEventId:   result.webhookEventId,
      timestampDeltaMs: result.timestampDeltaMs,
    };

    if (result.outcome === "valid") {
      logger.info("shield/webhook", "Webhook signature verified", logData);
    } else if (result.outcome === "missing_secret" || result.outcome === "unsupported") {
      logger.info("shield/webhook", `Webhook verification skipped (${result.outcome})`, logData);
    } else {
      // invalid / missing / replay — warn level, SecurityEvent will follow
      logger.warn("shield/webhook", `Webhook signature ${result.outcome}`, logData);
    }

    // ── Emit SecurityEvent for adverse outcomes ──────────────────────────────
    // Fire-and-forget — signature check result must not be delayed by event bus
    void emitWebhookEvent(
      result.outcome,
      providerKey,
      mode,
      result.webhookEventId,
      result.timestampDeltaMs,
    );

    const proceed = shouldProceedForOutcome(result.outcome, mode);

    return {
      outcome:          result.outcome,
      providerKey,
      webhookEventId:   result.webhookEventId,
      timestampDeltaMs: result.timestampDeltaMs,
      shouldProceed:    proceed,
    };

  } catch (err) {
    // Internal error in verifier — fail open (never block webhooks on our own bug)
    logger.warn("shield/webhook", "verifyWebhookSignature threw unexpectedly", {
      error:       String(err),
      providerKey,
      mode,
    });
    return {
      outcome:       "unsupported",
      providerKey,
      shouldProceed: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getWebhookVerificationConfig — diagnostic only
 *
 * Returns which providers have secrets configured (without exposing the secrets).
 * Use for admin Shield Center in Phase B.
 */
export function getWebhookVerificationConfig(): Array<{
  provider:    string;
  hasSecret:   boolean;
  hasVerifier: boolean;
}> {
  return Object.keys(VERIFIERS).map((provider) => ({
    provider,
    hasSecret:   Boolean(getWebhookSecret(provider)),
    hasVerifier: provider in VERIFIERS,
  }));
}
