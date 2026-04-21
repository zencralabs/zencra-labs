/**
 * Studio request validator.
 *
 * Validates incoming generation requests before they touch the provider layer.
 * Three checks, in order:
 *
 *   1. Model key — must exist in MODEL_REGISTRY and be active
 *   2. Aspect ratio — if provided, must be in the global AspectRatio allowlist
 *   3. Prompt length — must be between PROMPT_MIN and PROMPT_MAX characters
 *
 * Returns null if valid, or a ready-made 400 Response if invalid.
 *
 * Keep this layer thin and synchronous — no DB calls, no network I/O.
 * Heavy validation (entitlements, credit balance) lives in studio-dispatch.ts.
 */

import { getModel }        from "@/lib/providers/core/registry";
import type { AspectRatio } from "@/lib/providers/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PROMPT_MIN = 3;
const PROMPT_MAX = 2000;

/** Full allowlist of valid aspect ratio strings. Must match types.ts AspectRatio. */
const VALID_ASPECT_RATIOS = new Set<string>([
  "1:1", "16:9", "9:16", "4:5", "21:9",
  "4:3", "3:4", "2:3", "3:2", "5:4",
  "4:1", "1:4", "8:1", "1:8",
]);

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATOR INPUT
// ─────────────────────────────────────────────────────────────────────────────

export interface StudioRequestInput {
  /** Zencra model key — must exist in MODEL_REGISTRY as an active model */
  modelKey:     string;
  /** Raw user prompt (required) */
  prompt:       string;
  /** Aspect ratio string (optional — only validated when provided) */
  aspectRatio?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationResult =
  | { valid: true }
  | { valid: false; response: Response };

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a studio generation request.
 *
 * Returns { valid: true } if all checks pass.
 * Returns { valid: false, response } with a ready-made 400 if any check fails.
 *
 * Call this BEFORE credit checks and provider dispatch.
 */
export function validateStudioRequest(input: StudioRequestInput): ValidationResult {
  const { modelKey, prompt, aspectRatio } = input;

  // ── 1. Model key ────────────────────────────────────────────────────────────
  const model = getModel(modelKey);

  if (!model) {
    return {
      valid:    false,
      response: validationError("INVALID_MODEL", `Unknown model: "${modelKey}"`),
    };
  }

  if (model.status !== "active") {
    return {
      valid:    false,
      response: validationError(
        "MODEL_UNAVAILABLE",
        `Model "${modelKey}" is not available. Status: ${model.status}.`,
      ),
    };
  }

  // ── 2. Aspect ratio ─────────────────────────────────────────────────────────
  if (aspectRatio !== undefined && aspectRatio !== null && aspectRatio !== "") {
    if (!VALID_ASPECT_RATIOS.has(aspectRatio)) {
      return {
        valid:    false,
        response: validationError(
          "INVALID_ASPECT_RATIO",
          `Invalid aspect ratio "${aspectRatio}". Valid values: ${[...VALID_ASPECT_RATIOS].join(", ")}.`,
        ),
      };
    }
  }

  // ── 3. Prompt length ────────────────────────────────────────────────────────
  if (!prompt || typeof prompt !== "string") {
    return {
      valid:    false,
      response: validationError("INVALID_PROMPT", "Prompt is required."),
    };
  }

  const len = prompt.trim().length;

  if (len < PROMPT_MIN) {
    return {
      valid:    false,
      response: validationError(
        "PROMPT_TOO_SHORT",
        `Prompt is too short (${len} chars). Minimum is ${PROMPT_MIN} characters.`,
      ),
    };
  }

  if (len > PROMPT_MAX) {
    return {
      valid:    false,
      response: validationError(
        "PROMPT_TOO_LONG",
        `Prompt is too long (${len} chars). Maximum is ${PROMPT_MAX} characters.`,
      ),
    };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

function validationError(code: string, message: string): Response {
  return Response.json(
    { success: false, code, error: message },
    { status: 400 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORT for convenience
// ─────────────────────────────────────────────────────────────────────────────

export type { AspectRatio };
