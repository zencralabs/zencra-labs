/**
 * routing-check.mjs
 *
 * Dry verification of Creative Director model routing — zero API calls, zero credits.
 * Reads source files directly and validates registry, router, and env var presence.
 *
 * Run: node scripts/routing-check.mjs
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;   // green
const R = (s) => `\x1b[31m${s}\x1b[0m`;   // red
const Y = (s) => `\x1b[33m${s}\x1b[0m`;   // yellow
const B = (s) => `\x1b[1m${s}\x1b[0m`;    // bold
const D = (s) => `\x1b[90m${s}\x1b[0m`;   // dim

let passed = 0;
let failed = 0;
let warned = 0;

function ok(label)   { console.log(`  ${G("✅")} ${label}`); passed++; }
function fail(label) { console.log(`  ${R("❌")} ${label}`); failed++; }
function warn(label) { console.log(`  ${Y("⚠️")} ${label}`); warned++; }
function head(label) { console.log(`\n${B(label)}`); }
function dim(label)  { console.log(D(`     ${label}`)); }

// ─── SOURCE FILE HELPERS ──────────────────────────────────────────────────────

function readSrc(rel) {
  return readFileSync(resolve(ROOT, "src", rel), "utf8");
}

function hasKey(src, key) {
  // Look for key: "value" or key: 'value' patterns
  return src.includes(`"${key}"`) || src.includes(`'${key}'`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MODEL REGISTRY — status per model key
// ─────────────────────────────────────────────────────────────────────────────
head("1. MODEL REGISTRY — active vs coming-soon");

const registry = readSrc("lib/providers/core/registry.ts");

const EXPECTED_IMAGE_MODELS = [
  // [modelKey, expectedStatus, phase]
  ["gpt-image-1",          "active",       1],
  ["gpt-image-2",          "active",       1],
  ["nano-banana-standard", "active",       1],
  ["nano-banana-pro",      "active",       1],
  ["nano-banana-2",        "active",       1],
  ["seedream-v5",          "active",       1],
  ["seedream-4-5",         "active",       1],
  ["flux-kontext",         "active",       1],
  ["flux-2-image",         "coming-soon",  2],
  ["flux-2-max",           "coming-soon",  2],
];

for (const [key, expectedStatus] of EXPECTED_IMAGE_MODELS) {
  const keyPresent   = hasKey(registry, key);
  const activePresent = registry.includes(`key:            "${key}"`) || registry.includes(`key: "${key}"`);

  // Find the block for this key and check status
  const keyIdx = registry.indexOf(`"${key}"`);
  if (keyIdx === -1) {
    fail(`${key} — NOT FOUND in registry`);
    continue;
  }

  // Get the next 400 chars after the key to find status
  const block = registry.slice(keyIdx, keyIdx + 600);
  const isActive    = block.includes(`status:         "active"`)    || block.includes(`status: "active"`);
  const isComingSoon = block.includes(`status:         "coming-soon"`) || block.includes(`status: "coming-soon"`);

  if (expectedStatus === "active" && isActive) {
    ok(`${key} — active ✓`);
  } else if (expectedStatus === "coming-soon" && isComingSoon) {
    warn(`${key} — coming-soon (expected, not callable yet)`);
  } else if (expectedStatus === "active" && !isActive) {
    fail(`${key} — expected active but NOT active`);
  } else if (expectedStatus === "coming-soon" && !isComingSoon) {
    fail(`${key} — expected coming-soon but status unclear`);
  } else {
    fail(`${key} — status mismatch`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROVIDER ROUTER — model key → provider resolution
// ─────────────────────────────────────────────────────────────────────────────
head("2. PROVIDER ROUTER — Priority 0 model key passthrough");

const router = readSrc("lib/creative-director/provider-router.ts");

// Check Priority 0 exists
if (router.includes("Priority 0") && router.includes("resolveProviderForModelKey")) {
  ok("Priority 0 passthrough block present");
} else {
  fail("Priority 0 passthrough block MISSING");
}

// Check resolveProviderForModelKey contains all CD model keys
const ROUTER_MODEL_MAP = [
  ["gpt-image-1",          "openai"],
  ["gpt-image-2",          "openai"],
  ["nano-banana-standard", "nano-banana"],
  ["nano-banana-pro",      "nano-banana"],
  ["nano-banana-2",        "nano-banana"],
  ["seedream-v5",          "seedream"],
  ["seedream-4-5",         "seedream"],
  ["flux-kontext",         "flux"],
  ["flux-2-image",         "flux"],
  ["flux-2-max",           "flux"],
];

for (const [modelKey, provider] of ROUTER_MODEL_MAP) {
  if (router.includes(`"${modelKey}":`) && router.includes(`"${provider}"`)) {
    ok(`${modelKey} → "${provider}"`);
  } else {
    fail(`${modelKey} → "${provider}" — mapping MISSING from resolveProviderForModelKey`);
  }
}

// Check default fallback still uses gpt-image-1
if (router.includes('"gpt-image-1"') && router.includes("Default provider")) {
  ok("Default fallback still → gpt-image-1 (unchanged)");
} else {
  warn("Default fallback may have changed — verify manually");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PROVIDER ADAPTERS — registered in image/index.ts
// ─────────────────────────────────────────────────────────────────────────────
head("3. PROVIDER ADAPTERS — registered in image/index.ts");

const imageIndex = readSrc("lib/providers/image/index.ts");

const EXPECTED_REGISTRATIONS = [
  "gptImageProvider",
  "gptImage2Provider",
  "nanoBananaStandardProvider",
  "nanoBananaProProvider",
  "nanoBanana2Provider",
  "seedreamV5Provider",
  "seedream45Provider",
  "fluxKontextProvider",
  "flux2Provider",
];

for (const providerName of EXPECTED_REGISTRATIONS) {
  if (imageIndex.includes(`registerProvider(${providerName})`)) {
    ok(`registerProvider(${providerName}) ✓`);
  } else {
    fail(`registerProvider(${providerName}) — NOT registered`);
  }
}

// Verify gptImage2Provider is exported from gpt-image.ts
const gptImageSrc = readSrc("lib/providers/image/gpt-image.ts");
if (gptImageSrc.includes("export const gptImage2Provider")) {
  ok("gptImage2Provider exported from gpt-image.ts ✓");
} else {
  fail("gptImage2Provider NOT exported from gpt-image.ts");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GPT IMAGE ADAPTER — correct model IDs
// ─────────────────────────────────────────────────────────────────────────────
head("4. GPT IMAGE ADAPTER — model key wiring");

if (gptImageSrc.includes(`makeGptImageProvider`)) {
  ok("Factory pattern (makeGptImageProvider) in use ✓");
} else {
  fail("Factory pattern NOT found — gpt-image.ts may be stale");
}

if (gptImageSrc.includes(`"gpt-image-1"`) && gptImageSrc.includes(`getOpenAIEnv().model`)) {
  ok("gpt-image-1 adapter uses getOpenAIEnv().model (GPT_IMAGE_MODEL_ID) ✓");
} else {
  fail("gpt-image-1 model string wiring unclear");
}

if (gptImageSrc.includes(`"gpt-image-2"`) && gptImageSrc.includes(`getOpenAIEnv().model2`)) {
  ok("gpt-image-2 adapter uses getOpenAIEnv().model2 (GPT_IMAGE_2_MODEL_ID) ✓");
} else {
  fail("gpt-image-2 model string wiring unclear");
}

// Storage folders
if (gptImageSrc.includes("`${folder}/${jobId}.png`") || gptImageSrc.includes("folder}/${jobId}.png")) {
  ok("Separate Supabase storage folders per model ✓");
} else {
  warn("Storage folder separation — verify manually in gpt-image.ts");
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ENV — required vars for active models
// ─────────────────────────────────────────────────────────────────────────────
head("5. ENV VARS — required vars checklist (set in Vercel / .env.local)");
console.log(D("     Note: MISSING here is expected in sandbox — check Vercel dashboard."));

const ENV_CHECKS = [
  // [varName, required-for, required(true) or optional(false)]
  ["OPENAI_API_KEY",           "GPT Image 1.5 + 2",           true],
  ["GPT_IMAGE_MODEL_ID",       "gpt-image-1 model string",    false],
  ["GPT_IMAGE_2_MODEL_ID",     "gpt-image-2 model string",    false],
  ["NANO_BANANA_API_KEY",      "Nano Banana all tiers",        true],
  ["FAL_KEY",                  "Seedream + Flux (fal.ai)",     true],
  ["NEXT_PUBLIC_SUPABASE_URL", "image upload (all providers)", true],
  ["SUPABASE_SERVICE_ROLE_KEY","image upload (all providers)", true],
];

let envMissing = [];
for (const [varName, usage, isRequired] of ENV_CHECKS) {
  const val = process.env[varName];
  if (val && val.trim()) {
    ok(`${varName} — SET`);
  } else if (isRequired) {
    // Don't fail the overall check — just log what needs to be set in Vercel
    warn(`${varName} — not in sandbox env  ← must be set in Vercel for: ${usage}`);
    envMissing.push(varName);
  } else {
    warn(`${varName} — optional, not set → will use hardcoded default  (${usage})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CD_MODELS STORE — UI model list consistency
// ─────────────────────────────────────────────────────────────────────────────
head("6. CD_MODELS STORE — UI ↔ registry key alignment");

const store = readSrc("lib/creative-director/store.ts");

// Every key in CD_MODELS must exist in MODEL_REGISTRY
const CD_KEYS_EXPECTED = [
  "gpt-image-1",
  "gpt-image-2",
  "nano-banana-standard",
  "nano-banana-pro",
  "nano-banana-2",
  "seedream-4-5",
  "seedream-v5",
  "flux-kontext",
  "flux-2-image",
  "flux-2-max",
];

for (const key of CD_KEYS_EXPECTED) {
  const inStore    = store.includes(`"${key}"`);
  const inRegistry = registry.includes(`"${key}"`);

  if (inStore && inRegistry) {
    ok(`"${key}" — in CD_MODELS store AND MODEL_REGISTRY ✓`);
  } else if (inStore && !inRegistry) {
    fail(`"${key}" — in CD_MODELS store but MISSING from MODEL_REGISTRY`);
  } else if (!inStore && inRegistry) {
    warn(`"${key}" — in MODEL_REGISTRY but not in CD_MODELS store (UI won't show it)`);
  } else {
    fail(`"${key}" — missing from BOTH store and registry`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. DEFAULT selectedModel — should be gpt-image-2
// ─────────────────────────────────────────────────────────────────────────────
head("7. DEFAULT selectedModel — CDv2 initial state");

if (store.includes(`selectedModel: "gpt-image-2"`)) {
  ok(`Default selectedModel = "gpt-image-2" ✓`);
} else if (store.includes(`selectedModel: "gpt-image-1"`)) {
  fail(`Default selectedModel = "gpt-image-1" — should be "gpt-image-2"`);
} else {
  warn("selectedModel default — could not determine, check store.ts manually");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(B("ROUTING CHECK SUMMARY"));
console.log(`  ${G(`✅ ${passed} passed`)}`);
if (warned > 0) console.log(`  ${Y(`⚠️  ${warned} warnings`)}`);
if (failed > 0) console.log(`  ${R(`❌ ${failed} failed`)}`);
console.log("─".repeat(60));

if (failed === 0) {
  console.log(G("\nAll routing checks passed. Safe to proceed to live generation tests."));
  console.log(Y("\nRemember: verify GPT Image 2 model string with OpenAI before launch.\n"));
} else {
  console.log(R(`\n${failed} check(s) failed — fix before generating.\n`));
  process.exit(1);
}
