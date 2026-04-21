/**
 * Lean request logger — writes one row to request_logs per studio generation attempt.
 *
 * Captures: user, IP, route, model, studio, status, credits used, provider cost,
 * asset ID, error code, and wall-clock duration.
 *
 * Intentionally does NOT log:
 *   - Prompt text (lives in assets table)
 *   - Request bodies (PII risk, high storage cost)
 *   - Provider-internal payloads
 *
 * Failure is silent — logging must never block or affect generation outcomes.
 *
 * Table: public.request_logs (created in migration 025)
 * Access: service_role only (no client RLS)
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type RequestLogStatus = "success" | "failed" | "rate_limited" | "invalid";

export interface LogRequestInput {
  /** Authenticated user ID — null for unauthenticated requests (shouldn't reach here, but safe) */
  userId:        string | null;
  /** Client IP address */
  ip:            string;
  /** API route path (e.g. "/api/studio/image/generate") */
  route:         string;
  /** Zencra model key (e.g. "nano-banana-2-pro") */
  modelKey?:     string;
  /** Studio type (e.g. "image", "video") */
  studio?:       string;
  /** Outcome of the request */
  status:        RequestLogStatus;
  /** Credits deducted from the user's balance (0 or positive) */
  creditsUsed?:  number;
  /** Actual provider cost in USD (from cost-logger) */
  providerCost?: number;
  /** Asset record ID created during this request */
  assetId?:      string;
  /** Application-level error code (e.g. "RATE_LIMITED", "CREDIT_INSUFFICIENT") */
  errorCode?:    string;
  /** Wall-clock duration of the request in milliseconds */
  durationMs?:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asynchronously write a row to request_logs.
 * Always fire-and-forget — caller should use `void logRequest(...)`.
 * Never throws; logs errors to console only.
 */
export async function logRequest(input: LogRequestInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("request_logs")
      .insert({
        user_id:       input.userId,
        ip:            input.ip,
        route:         input.route,
        model_key:     input.modelKey   ?? null,
        studio:        input.studio     ?? null,
        status:        input.status,
        credits_used:  input.creditsUsed  ?? null,
        provider_cost: input.providerCost ?? null,
        asset_id:      input.assetId    ?? null,
        error_code:    input.errorCode  ?? null,
        duration_ms:   input.durationMs ?? null,
      });

    if (error) {
      console.error("[request-logger] insert error:", error.message);
    }
  } catch (err) {
    console.error("[request-logger] unexpected error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMER UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a wall-clock timer. Call startTimer() before dispatch,
 * then pass the returned function to logRequest as durationMs.
 *
 * Usage:
 *   const elapsed = startTimer();
 *   // ... generation work ...
 *   void logRequest({ ..., durationMs: elapsed() });
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
