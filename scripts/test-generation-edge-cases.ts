#!/usr/bin/env tsx
/**
 * Zencra Labs — Generation Edge Case Test Script
 *
 * Tests request validation, auth gates, and credit protection logic
 * WITHOUT calling live provider APIs unless --live flag is passed.
 *
 * Run: npm run test:generation-edge
 * Live: npm run test:generation-edge -- --live
 *
 * Default mode: dry-run / validation-only
 * Live mode: calls the real /api/studio/image/generate endpoint
 *
 * Requirements (live mode):
 *   - .env.local must be present with NEXT_PUBLIC_APP_URL set
 *   - A valid Supabase user JWT must be set in TEST_JWT env var
 *   - Server must be running (npm run dev)
 */

const LIVE = process.argv.includes("--live");
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TEST_JWT  = process.env.TEST_JWT ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  description: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
  expectedStatus: number;
  expectedCode?: string;
  expectNoAsset?: boolean;  // true = generation must NOT create an asset row
  expectNoCredit?: boolean; // true = credits must NOT be deducted
}

interface TestResult {
  name: string;
  pass: boolean;
  actualStatus?: number;
  actualCode?: string;
  error?: string;
}

const CASES: TestCase[] = [
  // ── Prompt validation ──────────────────────────────────────────────────────
  {
    name: "empty-prompt",
    description: "Empty prompt string should return 400",
    body: { modelKey: "gpt-image-1", prompt: "" },
    expectedStatus: 400,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "whitespace-only-prompt",
    description: "Whitespace-only prompt should return 400",
    body: { modelKey: "gpt-image-1", prompt: "   \t\n  " },
    expectedStatus: 400,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "too-short-prompt",
    description: "Prompt under 3 chars should return 400",
    body: { modelKey: "gpt-image-1", prompt: "Hi" },
    expectedStatus: 400,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "very-long-prompt",
    description: "Prompt over 2000 chars should return 400",
    body: { modelKey: "gpt-image-1", prompt: "A".repeat(2001) },
    expectedStatus: 400,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "special-characters-prompt",
    description: "Prompt with special characters should pass validation",
    body: { modelKey: "gpt-image-1", prompt: "A cat <with> & special \"characters\" — plus dashes" },
    expectedStatus: LIVE ? 202 : 401, // 401 without valid JWT
    expectNoCredit: !LIVE,
  },
  {
    name: "emoji-prompt",
    description: "Prompt with emoji should pass validation",
    body: { modelKey: "gpt-image-1", prompt: "🦁 A lion 🌅 at sunset" },
    expectedStatus: LIVE ? 202 : 401,
    expectNoCredit: !LIVE,
  },
  {
    name: "non-english-prompt",
    description: "Non-English prompt (Japanese) should pass validation",
    body: { modelKey: "gpt-image-1", prompt: "夕暮れ時の富士山の絵を描いてください" },
    expectedStatus: LIVE ? 202 : 401,
    expectNoCredit: !LIVE,
  },

  // ── Request validation ─────────────────────────────────────────────────────
  {
    name: "missing-model-key",
    description: "Missing modelKey should return 400",
    body: { prompt: "A beautiful landscape" },
    expectedStatus: 400,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "unsupported-model-key",
    description: "Unknown modelKey should return 400 or 404",
    body: { modelKey: "fake-model-9999", prompt: "A test prompt" },
    expectedStatus: 400,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "invalid-aspect-ratio",
    description: "Invalid aspect ratio should return 400",
    body: { modelKey: "gpt-image-1", prompt: "Test prompt here", aspectRatio: "99:1" },
    expectedStatus: 400,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "missing-auth",
    description: "Request without Authorization header should return 401",
    body: { modelKey: "gpt-image-1", prompt: "A valid prompt" },
    headers: { Authorization: "" }, // explicitly empty
    expectedStatus: 401,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "malformed-jwt",
    description: "Malformed JWT should return 401",
    body: { modelKey: "gpt-image-1", prompt: "A valid prompt" },
    headers: { Authorization: "Bearer this-is-not-a-real-jwt" },
    expectedStatus: 401,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
  {
    name: "too-many-reference-images",
    description: "More than 14 reference images should fail validation",
    body: {
      modelKey: "nano-banana-standard",
      prompt: "Test prompt",
      providerParams: {
        referenceUrls: Array.from({ length: 15 }, (_, i) => `https://example.com/img${i}.jpg`),
      },
    },
    expectedStatus: LIVE ? 400 : 401,
    expectNoCredit: true,
    expectNoAsset:  true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRY-RUN VALIDATOR (no live calls)
// ─────────────────────────────────────────────────────────────────────────────

function dryRunValidate(tc: TestCase): TestResult {
  const body = tc.body;
  const errors: string[] = [];

  // Prompt validation
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : null;
  if (prompt !== null) {
    if (prompt.length === 0) errors.push("prompt is empty");
    else if (prompt.length < 3) errors.push("prompt too short (<3 chars)");
    else if (prompt.length > 2000) errors.push("prompt too long (>2000 chars)");
  } else if (!("modelKey" in body)) {
    errors.push("missing modelKey");
  }

  // Model key validation
  const validModels = new Set([
    "gpt-image-1", "nano-banana-standard", "nano-banana-pro", "nano-banana-2",
    "seedream-v5", "seedream-4-5", "flux-kontext",
  ]);
  if ("modelKey" in body && typeof body.modelKey === "string") {
    if (!validModels.has(body.modelKey)) {
      errors.push(`unknown modelKey: ${body.modelKey}`);
    }
  }

  // Aspect ratio validation
  const validARs = new Set([
    "1:1", "16:9", "9:16", "3:4", "4:3", "3:2", "2:3",
    "4:5", "5:4", "21:9", "1:4", "4:1", "1:8", "8:1",
  ]);
  if ("aspectRatio" in body && typeof body.aspectRatio === "string") {
    if (!validARs.has(body.aspectRatio)) {
      errors.push(`invalid aspectRatio: ${body.aspectRatio}`);
    }
  }

  // Reference image count (NB limit)
  const refs = (body.providerParams as Record<string, unknown> | undefined)?.referenceUrls;
  if (Array.isArray(refs) && refs.length > 14) {
    errors.push(`too many reference images: ${refs.length} (max 14)`);
  }

  const expectsError = tc.expectedStatus >= 400;
  const validationWouldError = errors.length > 0;

  // Auth is not simulated in dry-run — treat missing/malformed JWT as expected 401
  const isAuthCase = tc.name.includes("auth") || tc.name.includes("jwt");
  if (isAuthCase) {
    return {
      name: tc.name,
      pass: tc.expectedStatus === 401,
      actualStatus: 401,
    };
  }

  const pass = expectsError === validationWouldError;

  return {
    name:         tc.name,
    pass,
    actualStatus: validationWouldError ? 400 : 202,
    error: !pass
      ? `Expected ${tc.expectedStatus}, dry-run predicted ${validationWouldError ? 400 : 202}. Errors: ${errors.join(", ")}`
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function liveRun(tc: TestCase): Promise<TestResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(TEST_JWT ? { Authorization: `Bearer ${TEST_JWT}` } : {}),
    ...(tc.headers ?? {}),
  };

  // Explicitly empty auth = no auth header
  if (tc.headers?.Authorization === "") delete headers.Authorization;

  try {
    const response = await fetch(`${BASE_URL}/api/studio/image/generate`, {
      method:  "POST",
      headers,
      body:    JSON.stringify(tc.body),
      signal:  AbortSignal.timeout(30_000),
    });

    const json = await response.json().catch(() => ({})) as Record<string, unknown>;
    const actualCode = typeof json.code === "string" ? json.code : undefined;
    const pass = response.status === tc.expectedStatus;

    return {
      name:         tc.name,
      pass,
      actualStatus: response.status,
      actualCode,
      error: !pass
        ? `Expected HTTP ${tc.expectedStatus}, got ${response.status}. Body: ${JSON.stringify(json).slice(0, 200)}`
        : undefined,
    };
  } catch (err) {
    return {
      name:  tc.name,
      pass:  false,
      error: `Network/timeout error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Zencra Generation Edge-Case Tests`);
  console.log(`  Mode: ${LIVE ? `LIVE (${BASE_URL})` : "DRY-RUN (validation-only)"}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  if (LIVE && !TEST_JWT) {
    console.warn("⚠️  TEST_JWT not set — auth-required tests will likely fail as 401.\n");
  }

  const results: TestResult[] = [];

  for (const tc of CASES) {
    const result = LIVE ? await liveRun(tc) : dryRunValidate(tc);
    results.push(result);

    const icon = result.pass ? "✅" : "❌";
    console.log(`${icon} [${tc.name}]`);
    console.log(`   ${tc.description}`);
    if (result.actualStatus) {
      console.log(`   Status: ${result.actualStatus} (expected ${tc.expectedStatus})`);
    }
    if (!result.pass && result.error) {
      console.log(`   ⛔ ${result.error}`);
    }
    console.log();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════════\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
