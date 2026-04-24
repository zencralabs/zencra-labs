/**
 * Zencra Labs — App-Wide Environment Validation
 *
 * Validates ALL required environment variables at startup.
 * Import and call validateEnv() from app/layout.tsx or middleware
 * to catch missing config before any request is served.
 *
 * Rules:
 *   - In production: missing REQUIRED vars throw immediately (hard fail)
 *   - In development: missing REQUIRED vars print a clear warning but only
 *     throw for core Supabase + app keys (everything else is warned)
 *   - NEVER log secret values — only key names and missing status
 *   - Optional vars are noted if missing but never block startup
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface EnvCheckResult {
  key: string;
  present: boolean;
  required: boolean;
  group: string;
}

export interface EnvValidationReport {
  results: EnvCheckResult[];
  missing_required: string[];
  missing_optional: string[];
  ok: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENV MAP
// ─────────────────────────────────────────────────────────────────────────────

interface EnvSpec {
  key: string;
  required: boolean;
  /** "core_always" = must always be present (throws in dev too) */
  tier: "core_always" | "required" | "optional";
  group: string;
}

const ENV_SPECS: EnvSpec[] = [
  // ── Core Supabase (always required — hard fail in all environments) ──────────
  { key: "NEXT_PUBLIC_SUPABASE_URL",    required: true, tier: "core_always", group: "Supabase" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, tier: "core_always", group: "Supabase" },
  { key: "SUPABASE_SERVICE_ROLE_KEY",   required: true, tier: "core_always", group: "Supabase" },

  // ── App URL ──────────────────────────────────────────────────────────────────
  { key: "NEXT_PUBLIC_SITE_URL",        required: true,  tier: "required", group: "App" },
  { key: "NEXT_PUBLIC_APP_URL",         required: false, tier: "optional", group: "App" },

  // ── OpenAI (Image Studio) ────────────────────────────────────────────────────
  { key: "OPENAI_API_KEY",              required: true,  tier: "required", group: "OpenAI" },

  // ── Nano Banana (Image Studio) ──────────────────────────────────────────────
  { key: "NANO_BANANA_API_KEY",         required: true,  tier: "required", group: "Nano Banana" },
  { key: "NANO_BANANA_API_BASE_URL",    required: false, tier: "optional", group: "Nano Banana" },
  { key: "NANO_BANANA_CALLBACK_URL",    required: false, tier: "optional", group: "Nano Banana" },
  { key: "NANO_BANANA_NB2_ENDPOINT",    required: false, tier: "optional", group: "Nano Banana" },
  { key: "NANO_BANANA_ENABLE_V2",       required: false, tier: "optional", group: "Nano Banana" },

  // ── fal.ai (Seedream, Flux, FCS) ─────────────────────────────────────────────
  { key: "FAL_KEY",                     required: true,  tier: "required", group: "fal.ai" },

  // ── Kling AI (Video Studio) ──────────────────────────────────────────────────
  { key: "KLING_API_KEY",               required: true,  tier: "required", group: "Kling AI" },
  { key: "KLING_BASE_URL",              required: false, tier: "optional", group: "Kling AI" },

  // ── BytePlus / Seedance (Video Studio) ──────────────────────────────────────
  { key: "BYTEPLUS_API_KEY",            required: true,  tier: "required", group: "BytePlus / Seedance" },
  { key: "SEEDANCE_BASE_URL",           required: false, tier: "optional", group: "BytePlus / Seedance" },
  { key: "SEEDANCE_MODEL_ID",           required: false, tier: "optional", group: "BytePlus / Seedance" },
  { key: "SEEDANCE_FAST_MODEL_ID",      required: false, tier: "optional", group: "BytePlus / Seedance" },
  { key: "SEEDANCE_15_MODEL_ID",        required: false, tier: "optional", group: "BytePlus / Seedance" },

  // ── ElevenLabs (Audio Studio) ────────────────────────────────────────────────
  { key: "ELEVENLABS_API_KEY",          required: true,  tier: "required", group: "ElevenLabs" },

  // ── Stability AI (Character Studio) ─────────────────────────────────────────
  { key: "STABILITY_API_KEY",           required: true,  tier: "required", group: "Stability AI" },

  // ── UGC Providers ────────────────────────────────────────────────────────────
  { key: "CREATIFY_API_KEY",            required: true,  tier: "required", group: "UGC / Creatify" },
  { key: "CREATIFY_API_ID",             required: true,  tier: "required", group: "UGC / Creatify" },
  { key: "ARCADS_API_KEY",              required: true,  tier: "required", group: "UGC / Arcads" },
  { key: "HEYGEN_API_KEY",              required: true,  tier: "required", group: "UGC / HeyGen" },

  // ── Payments ─────────────────────────────────────────────────────────────────
  { key: "RAZORPAY_KEY_ID",             required: false, tier: "optional", group: "Payments / Razorpay" },
  { key: "RAZORPAY_KEY_SECRET",         required: false, tier: "optional", group: "Payments / Razorpay" },
  { key: "NEXT_PUBLIC_RAZORPAY_KEY_ID", required: false, tier: "optional", group: "Payments / Razorpay" },
  { key: "STRIPE_SECRET_KEY",           required: false, tier: "optional", group: "Payments / Stripe" },
  { key: "STRIPE_WEBHOOK_SECRET",       required: false, tier: "optional", group: "Payments / Stripe" },

  // ── Email / Auth ──────────────────────────────────────────────────────────────
  { key: "RESEND_API_KEY",              required: true,  tier: "required", group: "Email / Resend" },
  { key: "RESEND_FROM_EMAIL",           required: false, tier: "optional", group: "Email / Resend" },
  { key: "TURNSTILE_SECRET_KEY",        required: false, tier: "optional", group: "Auth / Turnstile" },
  { key: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", required: false, tier: "optional", group: "Auth / Turnstile" },

  // ── Creative Director AI ──────────────────────────────────────────────────────
  { key: "CREATIVE_DIRECTOR_TEXT_MODEL", required: false, tier: "optional", group: "Creative Director" },
];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs environment validation.
 *
 * @param strict - If true, all REQUIRED vars throw on failure (production mode).
 *                 If false, only core_always vars throw (development mode).
 * @returns EnvValidationReport
 */
export function validateEnv(strict = process.env.NODE_ENV === "production"): EnvValidationReport {
  const results: EnvCheckResult[] = [];
  const missing_required: string[] = [];
  const missing_optional: string[] = [];
  const errors: string[] = [];

  for (const spec of ENV_SPECS) {
    const value = process.env[spec.key];
    const present = Boolean(value && value.trim().length > 0);

    results.push({
      key: spec.key,
      present,
      required: spec.required,
      group: spec.group,
    });

    if (!present) {
      if (spec.required) {
        missing_required.push(spec.key);
        // core_always: always throw, even in dev (Supabase is non-negotiable)
        // required: throw in strict/prod mode; warn in dev
        if (spec.tier === "core_always" || strict) {
          errors.push(spec.key);
        } else {
          console.warn(
            `[env] ⚠️  Missing required variable: ${spec.key} (group: ${spec.group}). ` +
            `Set it in .env.local before using this feature.`
          );
        }
      } else {
        missing_optional.push(spec.key);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `[zencra-env] Missing required environment variables:\n` +
      errors.map((k) => `  • ${k}`).join("\n") +
      `\n\nSee .env.example for setup instructions.`
    );
  }

  return {
    results,
    missing_required,
    missing_optional,
    ok: missing_required.length === 0,
  };
}

/**
 * Check a single env var and return its value or undefined.
 * Never logs the value — only confirms presence.
 */
export function checkEnvVar(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value : undefined;
}

/**
 * Lightweight startup check — call once in layout.tsx or middleware.
 * Only throws for core Supabase keys (non-negotiable at any environment tier).
 * Everything else is warned in dev, thrown in prod.
 */
export function runStartupEnvCheck(): void {
  try {
    validateEnv();
  } catch (err) {
    // In development, log clearly but allow server to start for other routes
    if (process.env.NODE_ENV !== "production") {
      console.error("\n" + (err instanceof Error ? err.message : String(err)) + "\n");
    } else {
      throw err;
    }
  }
}
