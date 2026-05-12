/**
 * API Route Utilities
 *
 * Shared response builders and error codes for all Zencra API routes.
 * Keeps every route's success/error shape consistent.
 *
 * All responses follow the shape:
 *   { success: boolean, data?: unknown, error?: string, code?: ApiErrorCode }
 */

import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "MODEL_NOT_FOUND"
  | "MODEL_NOT_ACTIVE"
  | "FEATURE_DISABLED"
  | "INSUFFICIENT_CREDITS"
  /**
   * Provider account balance exhausted — platform-operational failure, not user's fault.
   * Returns 503 (not 402) so the client shows "try again" rather than a payment prompt.
   * User-facing message is always the sanitized generic string.
   */
  | "PROVIDER_CREDIT_EXHAUSTED"
  | "PROVIDER_ERROR"
  | "JOB_NOT_FOUND"
  | "NOT_OWNER"
  | "WEBHOOK_INVALID"
  | "SERVER_ERROR"
  | "TOO_MANY_REFERENCE_IMAGES";

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/** 200 OK with data payload */
export function ok(data: unknown): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 200 });
}

/** 202 Accepted — job dispatched, pending async completion */
export function accepted(data: unknown): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 202 });
}

/** Error response with typed code and HTTP status */
export function apiErr(
  code: ApiErrorCode,
  message: string,
  status: number = 500
): NextResponse {
  return NextResponse.json(
    { success: false, error: message, code },
    { status }
  );
}

// ── Typed error shortcuts ──────────────────────────────────────────────────

export const unauthorized = (msg = "Unauthorized") =>
  apiErr("UNAUTHORIZED", msg, 401);

export const forbidden = (msg = "Forbidden") =>
  apiErr("FORBIDDEN", msg, 403);

export const invalidInput = (msg: string) =>
  apiErr("INVALID_INPUT", msg, 400);

export const modelNotFound = (modelKey: string) =>
  apiErr("MODEL_NOT_FOUND", `Model "${modelKey}" not found or not active.`, 404);

export const featureDisabled = (feature: string) =>
  apiErr("FEATURE_DISABLED", `"${feature}" is not currently available.`, 403);

export const insufficientCredits = (needed?: number) =>
  apiErr(
    "INSUFFICIENT_CREDITS",
    needed
      ? `Insufficient credits. This generation requires approximately ${needed} credits.`
      : "Insufficient credits to complete this generation.",
    402
  );

export const jobNotFound = (jobId: string) =>
  apiErr("JOB_NOT_FOUND", `Job "${jobId}" not found.`, 404);

export const notOwner = () =>
  apiErr("NOT_OWNER", "You do not have access to this resource.", 403);

export const providerErr = (msg: string) =>
  apiErr("PROVIDER_ERROR", msg, 502);

export const serverErr = (msg = "Internal server error") =>
  apiErr("SERVER_ERROR", msg, 500);

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely parse a JSON request body.
 * Returns { body, parseError } — check parseError before using body.
 */
export async function parseBody<T = Record<string, unknown>>(
  req: Request
): Promise<{ body: T; parseError: null } | { body: null; parseError: NextResponse }> {
  try {
    const text = await req.text();
    if (!text || text.trim() === "") {
      return { body: null, parseError: invalidInput("Request body is required.") };
    }
    const body = JSON.parse(text) as T;
    return { body, parseError: null };
  } catch {
    return { body: null, parseError: invalidInput("Invalid JSON in request body.") };
  }
}

/**
 * Assert a required string field is present and non-empty.
 * Returns the trimmed value or null if missing/empty.
 */
export function requireString(
  body: Record<string, unknown>,
  field: string
): string | null {
  const val = body[field];
  if (typeof val !== "string" || val.trim() === "") return null;
  return val.trim();
}

/**
 * Assert a required string field — returns error response if missing.
 */
export function requireField(
  body: Record<string, unknown>,
  field: string
): { value: string; fieldError: null } | { value: null; fieldError: NextResponse } {
  const val = requireString(body, field);
  if (val === null) {
    return {
      value: null,
      fieldError: invalidInput(`"${field}" is required and must be a non-empty string.`),
    };
  }
  return { value: val, fieldError: null };
}

// DEV HELPERS section removed.
// All routes require real authentication — even in development.
// Use a real account JWT from your Supabase dashboard for local testing.
