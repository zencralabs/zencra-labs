#!/usr/bin/env node
/**
 * Zencra Labs — Environment Check Script
 *
 * Run: npx tsx scripts/check-env.ts
 * Or via npm: npm run check:env
 *
 * Validates all required and optional environment variables.
 * Prints a clear pass/fail report per provider group.
 * Exits with code 1 if any required variables are missing.
 *
 * Usage:
 *   npm run check:env              # validate current .env.local
 *   NODE_ENV=production npm run check:env  # simulate production rules
 *
 * Note: Uses only Node.js built-ins — no dotenv dependency required.
 */

import * as path from "path";
import * as fs from "fs";

// ── Load .env.local if not already in process.env ────────────────────────────
// In CI/production, env vars are injected by the platform; skip .env.local loading.
function parseEnvFile(filePath: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const content = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) entries[key] = value;
  }
  return entries;
}

if (process.env.NODE_ENV !== "production") {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const parsed = parseEnvFile(envPath);
    // Only inject vars not already set in process.env
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value;
    }
    console.log(`\nLoaded: .env.local\n`);
  } else {
    console.warn(`⚠️  .env.local not found — using process.env as-is\n`);
  }
}

// ── Env spec (mirrors validateEnv.ts) ────────────────────────────────────────

interface EnvSpec {
  key: string;
  required: boolean;
  group: string;
}

const ENV_SPECS: EnvSpec[] = [
  // Core
  { key: "NEXT_PUBLIC_SUPABASE_URL",        required: true,  group: "🗄️  Supabase" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",   required: true,  group: "🗄️  Supabase" },
  { key: "SUPABASE_SERVICE_ROLE_KEY",        required: true,  group: "🗄️  Supabase" },
  // App
  { key: "NEXT_PUBLIC_SITE_URL",             required: true,  group: "🌐 App" },
  { key: "NEXT_PUBLIC_APP_URL",              required: false, group: "🌐 App" },
  // OpenAI
  { key: "OPENAI_API_KEY",                   required: true,  group: "🤖 OpenAI" },
  // Nano Banana
  { key: "NANO_BANANA_API_KEY",              required: true,  group: "🍌 Nano Banana" },
  { key: "NANO_BANANA_API_BASE_URL",         required: false, group: "🍌 Nano Banana" },
  { key: "NANO_BANANA_CALLBACK_URL",         required: false, group: "🍌 Nano Banana" },
  { key: "NANO_BANANA_NB2_ENDPOINT",         required: false, group: "🍌 Nano Banana" },
  { key: "NANO_BANANA_ENABLE_V2",            required: false, group: "🍌 Nano Banana" },
  // fal.ai
  { key: "FAL_KEY",                          required: true,  group: "⚡ fal.ai" },
  // Kling AI
  { key: "KLING_API_KEY",                    required: true,  group: "🎬 Kling AI" },
  { key: "KLING_BASE_URL",                   required: false, group: "🎬 Kling AI" },
  // BytePlus / Seedance
  { key: "BYTEPLUS_API_KEY",                 required: true,  group: "🌊 BytePlus / Seedance" },
  { key: "SEEDANCE_BASE_URL",                required: false, group: "🌊 BytePlus / Seedance" },
  { key: "SEEDANCE_MODEL_ID",                required: false, group: "🌊 BytePlus / Seedance" },
  { key: "SEEDANCE_FAST_MODEL_ID",           required: false, group: "🌊 BytePlus / Seedance" },
  { key: "SEEDANCE_15_MODEL_ID",             required: false, group: "🌊 BytePlus / Seedance" },
  // ElevenLabs
  { key: "ELEVENLABS_API_KEY",               required: true,  group: "🎙️  ElevenLabs" },
  // Stability AI
  { key: "STABILITY_API_KEY",                required: true,  group: "🎨 Stability AI" },
  // UGC Providers
  { key: "CREATIFY_API_KEY",                 required: true,  group: "📢 UGC / Creatify" },
  { key: "CREATIFY_API_ID",                  required: true,  group: "📢 UGC / Creatify" },
  { key: "ARCADS_API_KEY",                   required: true,  group: "📢 UGC / Arcads" },
  { key: "HEYGEN_API_KEY",                   required: true,  group: "📢 UGC / HeyGen" },
  // Payments
  { key: "RAZORPAY_KEY_ID",                  required: false, group: "💳 Payments" },
  { key: "RAZORPAY_KEY_SECRET",              required: false, group: "💳 Payments" },
  { key: "STRIPE_SECRET_KEY",                required: false, group: "💳 Payments" },
  { key: "STRIPE_WEBHOOK_SECRET",            required: false, group: "💳 Payments" },
  // Email / Auth
  { key: "RESEND_API_KEY",                   required: true,  group: "📧 Email / Resend" },
  { key: "RESEND_FROM_EMAIL",                required: false, group: "📧 Email / Resend" },
  { key: "TURNSTILE_SECRET_KEY",             required: false, group: "🛡️  Auth / Turnstile" },
  { key: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",   required: false, group: "🛡️  Auth / Turnstile" },
];

// ── Run checks ────────────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";
console.log(`Environment: ${isProd ? "production" : "development"}\n`);

const groups = new Map<string, { spec: EnvSpec; present: boolean }[]>();

for (const spec of ENV_SPECS) {
  const value = process.env[spec.key];
  const present = Boolean(value && value.trim().length > 0);
  if (!groups.has(spec.group)) groups.set(spec.group, []);
  groups.get(spec.group)!.push({ spec, present });
}

let missingRequired = 0;
let missingOptional = 0;

for (const [group, items] of groups.entries()) {
  const allOk = items.every((i) => i.present || !i.spec.required);
  console.log(`${allOk ? "✅" : "❌"} ${group}`);

  for (const { spec, present } of items) {
    if (!present) {
      if (spec.required) {
        console.log(`      ⛔ MISSING (required): ${spec.key}`);
        missingRequired++;
      } else {
        console.log(`      ⚠️  missing (optional): ${spec.key}`);
        missingOptional++;
      }
    }
  }
}

console.log(`\n──────────────────────────────────────────`);
console.log(`Missing required : ${missingRequired}`);
console.log(`Missing optional : ${missingOptional}`);
console.log(`──────────────────────────────────────────`);

if (missingRequired > 0) {
  console.error(
    `\n🚫 ${missingRequired} required variable(s) missing. ` +
    `Copy .env.example to .env.local and fill in the missing values.\n`
  );
  process.exit(1);
} else {
  console.log(`\n✅ All required environment variables are present.\n`);
  process.exit(0);
}
