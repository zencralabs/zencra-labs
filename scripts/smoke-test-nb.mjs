/**
 * Nano Banana Smoke Test
 * ─────────────────────
 * Tests all 5 variants + failure cases against the live API.
 *
 * Usage:
 *   node scripts/smoke-test-nb.mjs
 *
 * Requires in environment (or .env.local):
 *   NANO_BANANA_API_KEY        — your reseller key
 *   NANO_BANANA_API_BASE_URL   — https://api.nanobananaapi.ai
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ───────────────────────────────────────────────────────────
try {
  const envFile = readFileSync(join(__dirname, "../.env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* already in environment */ }

// ── Config ────────────────────────────────────────────────────────────────────
const API_KEY     = process.env.NANO_BANANA_API_KEY;
const API_BASE    = process.env.NANO_BANANA_API_BASE_URL ?? "https://api.nanobananaapi.ai";
const CALLBACK    = process.env.NANO_BANANA_CALLBACK_URL ?? "https://zencralabs.com/api/nb-callback";
const POLL_MS     = 3_000;
const TIMEOUT_MS  = 120_000;

// ── Confirmed endpoint paths ──────────────────────────────────────────────────
const EP = {
  standard: "/api/v1/nanobanana/generate",
  pro:      "/api/v1/nanobanana/generate-pro",
  task:     "/api/v1/nanobanana/record-info",
};

// ── taskStatus numeric codes ──────────────────────────────────────────────────
const TS = { GENERATING: 0, SUCCESS: 1, CREATE_TASK_FAILED: 2, GENERATE_FAILED: 3 };

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";
const SKIP = "⏭  SKIP";
const WARN = "⚠️  WARN";

let passed = 0, failed = 0, skipped = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(label, status, detail = "") {
  const icon = status === "pass" ? PASS : status === "fail" ? FAIL : status === "skip" ? SKIP : WARN;
  console.log(`  ${icon} ${label}${detail ? ": " + detail : ""}`);
  if (status === "pass") passed++;
  else if (status === "fail") failed++;
  else if (status === "skip") skipped++;
}

async function poll(taskId) {
  const deadline = Date.now() + TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    await new Promise(r => setTimeout(r, POLL_MS));
    const res = await fetch(`${API_BASE}${EP.task}?taskId=${encodeURIComponent(taskId)}`, {
      headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { console.log(`    poll HTTP ${res.status} attempt=${attempt}`); continue; }
    const body = await res.json();
    const data = body.data ?? body;
    const taskStatus = Number(data.taskStatus ?? -1);
    console.log(`    poll attempt=${attempt} taskStatus=${taskStatus}`);
    if (taskStatus === TS.SUCCESS) return { ok: true, data };
    if (taskStatus === TS.CREATE_TASK_FAILED || taskStatus === TS.GENERATE_FAILED) {
      return { ok: false, error: `taskStatus=${taskStatus} (${data.errMsg ?? data.message ?? "failed"})` };
    }
  }
  return { ok: false, error: "timeout" };
}

async function submitAndPoll(label, path, body) {
  console.log(`\n── ${label} ──`);
  console.log("  Payload:", JSON.stringify({ ...body, callBackUrl: "(set)" }));

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "Accept":       "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const submitBody = await res.json().catch(() => ({}));
  console.log(`  Submit HTTP ${res.status}:`, JSON.stringify(submitBody).slice(0, 300));

  // Validate submit response shape
  log("HTTP 200 on submit", res.ok ? "pass" : "fail", res.ok ? "" : `got ${res.status}`);
  log("body.code === 200", submitBody.code === 200 ? "pass" : "warn", `code=${submitBody.code}`);

  if (!res.ok) {
    log("task polling", "skip", "submit failed");
    return null;
  }

  const data   = submitBody.data ?? {};
  const taskId = data.taskId ?? data.task_id ?? submitBody.taskId ?? "";
  log("taskId present in data.taskId", !!taskId ? "pass" : "fail", taskId || "missing");
  if (!taskId) return null;

  console.log(`  Polling task ${taskId}...`);
  const result = await poll(taskId);
  log("poll reached terminal SUCCESS", result.ok ? "pass" : "fail",
      result.ok ? `imageUrl=${result.data?.imageUrl ?? "(check above)"}` : result.error);

  if (result.ok) {
    const imageUrl = result.data?.imageUrl ?? result.data?.image_url ?? "";
    log("imageUrl is a non-empty string", imageUrl ? "pass" : "fail", imageUrl.slice(0, 80) || "empty");
    return imageUrl;
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║      Nano Banana API Smoke Tests                        ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log(`  Base URL : ${API_BASE}`);
console.log(`  API Key  : ${API_KEY ? API_KEY.slice(0, 8) + "..." : "⚠ MISSING"}`);

if (!API_KEY) {
  console.log(`
  ⚠️  NANO_BANANA_API_KEY is not set in .env.local.
  Add the key you received from the reseller:
      NANO_BANANA_API_KEY=your_key_here
  Then re-run:  node scripts/smoke-test-nb.mjs
`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: PAYLOAD SHAPE VALIDATION (structure, no network)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[1] PAYLOAD SHAPE VALIDATION");

const stdTxt   = { type: "TEXTTOIAMGE",  prompt: "test", numImages: 1, callBackUrl: CALLBACK };
const stdImg   = { type: "IMAGETOIAMGE", prompt: "test", numImages: 1, callBackUrl: CALLBACK, imageUrls: ["https://example.com/img.jpg"] };
const proPayload = { prompt: "test", resolution: "1K", callBackUrl: CALLBACK };

log("Standard TEXTTOIAMGE type string exact",  stdTxt.type === "TEXTTOIAMGE",  stdTxt.type);
log("Standard IMAGETOIAMGE type string exact",  stdImg.type === "IMAGETOIAMGE", stdImg.type);
log("Standard includes numImages:1",           stdTxt.numImages === 1,          `${stdTxt.numImages}`);
log("Standard Edit includes imageUrls array",  Array.isArray(stdImg.imageUrls), `${JSON.stringify(stdImg.imageUrls)}`);
log("Pro resolution uppercase (1K/2K/4K)",     /^[124]K$/.test(proPayload.resolution), proPayload.resolution);
log("Both include callBackUrl",                !!(stdTxt.callBackUrl && proPayload.callBackUrl), "present");

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: LIVE SMOKE TESTS
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[2] LIVE SMOKE TESTS (real API calls)\n");

// Test 1: Standard text-to-image
await submitAndPoll("Test 1: Nano Banana (standard TEXTTOIAMGE)", EP.standard, {
  type:        "TEXTTOIAMGE",
  prompt:      "A glowing neon city skyline at night, photorealistic",
  numImages:   1,
  callBackUrl: CALLBACK,
});

// Test 2: Nano Banana Edit (IMAGETOIAMGE)
// Uses a publicly accessible test image
await submitAndPoll("Test 2: Nano Banana Edit (IMAGETOIAMGE)", EP.standard, {
  type:        "IMAGETOIAMGE",
  prompt:      "Transform into a watercolor painting style",
  numImages:   1,
  callBackUrl: CALLBACK,
  imageUrls:   ["https://placehold.co/512x512/1a1a2e/FFFFFF.png"],
});

// Test 3: Pro 1K
await submitAndPoll("Test 3: Nano Banana Pro 1K", EP.pro, {
  prompt:      "A majestic mountain landscape at sunrise, ultra detailed",
  resolution:  "1K",
  callBackUrl: CALLBACK,
});

// Test 4: Pro 2K
await submitAndPoll("Test 4: Nano Banana Pro 2K", EP.pro, {
  prompt:      "Cyberpunk street market at dusk, rain reflections",
  resolution:  "2K",
  callBackUrl: CALLBACK,
});

// Test 5: Pro 4K
await submitAndPoll("Test 5: Nano Banana Pro 4K", EP.pro, {
  prompt:      "Ultra high resolution abstract geometric art, vivid colors",
  resolution:  "4K",
  callBackUrl: CALLBACK,
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: FAILURE CASES
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[3] FAILURE CASE TESTS\n");

// FC-1: Bad API key
{
  console.log("── FC-1: Invalid API key ──");
  const res = await fetch(`${API_BASE}${EP.standard}`, {
    method: "POST",
    headers: {
      "Authorization": "Bearer INVALID_KEY_TEST_XXXX",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "TEXTTOIAMGE", prompt: "test", numImages: 1, callBackUrl: CALLBACK }),
    signal: AbortSignal.timeout(15_000),
  });
  log("Bad key returns 401/403", res.status === 401 || res.status === 403 ? "pass" : "warn",
    `got HTTP ${res.status}`);
}

// FC-2: Edit without imageUrls (should fail or treat as text-to-image)
{
  console.log("\n── FC-2: IMAGETOIAMGE without imageUrls ──");
  const res = await fetch(`${API_BASE}${EP.standard}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "IMAGETOIAMGE", prompt: "edit this", numImages: 1, callBackUrl: CALLBACK }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  log("Missing imageUrls returns error (not 200 success)", !res.ok || body.code !== 200 ? "pass" : "warn",
    `HTTP ${res.status} code=${body.code}`);
}

// FC-3: Pro with invalid resolution
{
  console.log("\n── FC-3: Pro endpoint with invalid resolution ──");
  const res = await fetch(`${API_BASE}${EP.pro}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "test", resolution: "8K", callBackUrl: CALLBACK }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  log("Invalid resolution rejected", !res.ok || body.code !== 200 ? "pass" : "warn",
    `HTTP ${res.status} code=${body.code}`);
}

// FC-4: Fake taskId poll
{
  console.log("\n── FC-4: Poll non-existent taskId ──");
  const res = await fetch(`${API_BASE}${EP.task}?taskId=FAKE_TASK_00000000`, {
    headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  log("Fake taskId returns 404 or error", res.status === 404 || body.code !== 200 ? "pass" : "warn",
    `HTTP ${res.status} code=${body.code ?? "n/a"}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log(`║  Results: ${passed} passed, ${failed} failed, ${skipped} skipped${" ".repeat(Math.max(0, 28 - String(passed+failed+skipped).length))}║`);
console.log("╚══════════════════════════════════════════════════════════╝\n");

if (failed > 0) process.exit(1);
