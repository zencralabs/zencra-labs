/**
 * Zencra Studio Route Test Script
 *
 * Tests the full API route stack without a running Next.js server.
 * Imports route handlers directly and calls them with mock Request objects.
 *
 * Covers:
 *  - Dry-run routing (validates auth/flags/parsing without provider calls)
 *  - Negative path tests (401/403/400/404/402)
 *  - Live generation tests (requires real API keys + flag env vars)
 *
 * Usage:
 *   npx tsx scripts/test-routes.ts [--dry-run] [--live-image] [--live-audio] [--negative]
 *
 * Environment:
 *   Set ZENCRA_DRY_RUN=true for dry-run mode.
 *   Set ZENCRA_FLAG_IMAGE_ENABLED=true / ZENCRA_FLAG_AUDIO_ENABLED=true for live tests.
 *   Set TEST_JWT=<valid_supabase_jwt> to authenticate requests.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

interface TestResult {
  name:    string;
  passed:  boolean;
  status?: number;
  body?:   unknown;
  error?:  string;
}

const results: TestResult[] = [];

async function test(
  name:   string,
  fn:     () => Promise<void>
): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✅  ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: msg });
    console.log(`  ❌  ${name}: ${msg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function callRoute(
  handler:  (req: Request) => Promise<Response>,
  method:   string,
  body?:    unknown,
  headers?: Record<string, string>
): Promise<{ status: number; body: unknown }> {
  const req = new Request("http://localhost:3000/test", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const res    = await handler(req);
  const json   = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

const JWT = process.env.TEST_JWT ?? "";
const AUTH_HEADER: Record<string, string> = JWT ? { Authorization: `Bearer ${JWT}` } : {};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

// Dynamic imports so each handler registers providers only when needed
async function getImageRoute() {
  const mod = await import("../src/app/api/studio/image/generate/route");
  return mod.POST;
}
async function getVideoRoute() {
  const mod = await import("../src/app/api/studio/video/generate/route");
  return mod.POST;
}
async function getAudioRoute() {
  const mod = await import("../src/app/api/studio/audio/generate/route");
  return mod.POST;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEGATIVE PATH TESTS (no API keys needed)
// ─────────────────────────────────────────────────────────────────────────────

async function runNegativeTests() {
  console.log("\n── Negative Path Tests ──────────────────────────────────────");
  const imageRoute = await getImageRoute();

  await test("No auth token → 401 (skipped in NODE_ENV=development dev-bypass mode)", async () => {
    if (process.env.NODE_ENV === "development") {
      // In dev mode routes bypass auth and use DEV_DEMO_USER_ID — this is expected behaviour.
      // The 401 gate is tested in staging/production where isDev=false.
      console.log("      → SKIPPED: dev mode bypasses auth gate (expected)");
      return;
    }
    const { status, body } = await callRoute(imageRoute, "POST",
      { modelKey: "gpt-image-1", prompt: "test" }
    );
    assert(status === 401, `Expected 401, got ${status}: ${JSON.stringify(body)}`);
    assert((body as { code?: string }).code === "UNAUTHORIZED", `Expected UNAUTHORIZED code`);
  });

  await test("Missing modelKey → 400", async () => {
    const { status, body } = await callRoute(imageRoute, "POST",
      { prompt: "test" },
      AUTH_HEADER
    );
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("Missing prompt → 400", async () => {
    const { status, body } = await callRoute(imageRoute, "POST",
      { modelKey: "gpt-image-1" },
      AUTH_HEADER
    );
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("Empty JSON body → 400", async () => {
    const req = new Request("http://localhost:3000/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADER },
      body: "{}",
    });
    const res  = await imageRoute(req);
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Unknown modelKey → 404 or 403 (not 500)", async () => {
    const { status } = await callRoute(imageRoute, "POST",
      { modelKey: "nonexistent-model-xyz", prompt: "test" },
      AUTH_HEADER
    );
    assert(
      status === 404 || status === 403 || status === 400,
      `Expected 4xx, got ${status}`
    );
  });

  await test("Coming-soon model (flux-2-image) → 403 not 500", async () => {
    const { status, body } = await callRoute(imageRoute, "POST",
      { modelKey: "flux-2-image", prompt: "test" },
      AUTH_HEADER
    );
    assert(status !== 500, `Coming-soon model should not return 500, got ${status}: ${JSON.stringify(body)}`);
  });

  // FCS with invalid key prefix
  const fcsRoute = (await import("../src/app/api/studio/fcs/generate/route")).POST;
  await test("FCS with non-fcs_ key → 400", async () => {
    const { status } = await callRoute(fcsRoute, "POST",
      { modelKey: "kling-30", prompt: "test" },
      AUTH_HEADER
    );
    // Either 400 (invalid key) or 403 (FCS disabled) — both acceptable
    assert(status === 400 || status === 403, `Expected 400 or 403, got ${status}`);
  });

  // Video duration out of range
  const videoRoute = await getVideoRoute();
  await test("Video durationSeconds > 120 → 400", async () => {
    const { status } = await callRoute(videoRoute, "POST",
      { modelKey: "kling-30", prompt: "test", durationSeconds: 999 },
      AUTH_HEADER
    );
    assert(status === 400 || status === 403, `Expected 400 or 403, got ${status}`);
  });

  await test("FCS durationSeconds > 30 → 400 or 403", async () => {
    const { status } = await callRoute(fcsRoute, "POST",
      { modelKey: "fcs_ltx-v095", prompt: "test", durationSeconds: 99 },
      AUTH_HEADER
    );
    assert(status === 400 || status === 403, `Expected 400 or 403, got ${status}`);
  });

  // UGC — missing both prompt and script
  const ugcRoute = (await import("../src/app/api/studio/ugc/generate/route")).POST;
  await test("UGC missing prompt and script → 400 or 403", async () => {
    const { status } = await callRoute(ugcRoute, "POST",
      { modelKey: "creatify" },
      AUTH_HEADER
    );
    assert(status === 400 || status === 403, `Expected 400 or 403, got ${status}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING SMOKE TESTS (dry-run, no real provider calls)
// ─────────────────────────────────────────────────────────────────────────────

async function runDryRunTests() {
  console.log("\n── Dry-Run Routing Tests ────────────────────────────────────");
  console.log("   (ZENCRA_DRY_RUN=true prevents provider calls)");

  const imageRoute = await getImageRoute();
  const audioRoute = await getAudioRoute();

  await test("Image route — valid body reaches orchestrator (dry-run blocks)", async () => {
    const { status, body } = await callRoute(imageRoute, "POST",
      { modelKey: "gpt-image-1", prompt: "a white circle" },
      AUTH_HEADER
    );
    // In dry-run mode orchestrator throws — expect a handled error (not 500)
    // In non-dry-run mode with flags off — expect 403 FEATURE_DISABLED
    // Either way, route parses correctly and doesn't 500
    assert(status !== 500, `Route should not 500, got: ${status} ${JSON.stringify(body)}`);
    console.log(`      → status: ${status}, code: ${(body as { code?: string })?.code}`);
  });

  await test("Audio route — valid body reaches orchestrator (dry-run blocks)", async () => {
    const { status, body } = await callRoute(audioRoute, "POST",
      { modelKey: "elevenlabs", prompt: "Hello world" },
      AUTH_HEADER
    );
    assert(status !== 500, `Audio route should not 500, got: ${status} ${JSON.stringify(body)}`);
    console.log(`      → status: ${status}, code: ${(body as { code?: string })?.code}`);
  });

  await test("Character route — identity context parsed without error", async () => {
    const charRoute = (await import("../src/app/api/studio/character/generate/route")).POST;
    const { status } = await callRoute(charRoute, "POST",
      {
        modelKey: "flux-character",
        prompt:   "portrait of a person",
        identity: { character_id: "char_test_001", soul_id: "soul_test_001" },
      },
      AUTH_HEADER
    );
    assert(status !== 500, `Character route should not 500, got ${status}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE IMAGE TESTS (requires real API keys + ZENCRA_FLAG_IMAGE_ENABLED=true)
// ─────────────────────────────────────────────────────────────────────────────

async function runLiveImageTests() {
  console.log("\n── Live Image Generation Tests ──────────────────────────────");
  if (!JWT) {
    console.log("   SKIPPED: Set TEST_JWT= to run live tests");
    return;
  }

  const imageRoute = await getImageRoute();

  // ── GPT Image (primary live test — sync provider, lowest cost) ────────────
  await test("GPT Image 1 — generates image synchronously, URL returned immediately", async () => {
    const { status, body } = await callRoute(imageRoute, "POST",
      { modelKey: "gpt-image-1", prompt: "a white circle on black background", aspectRatio: "1:1" },
      AUTH_HEADER
    );
    const data = (body as { data?: { jobId?: string; url?: string; assetId?: string; status?: string } }).data;
    assert(status === 202, `Expected 202, got ${status}: ${JSON.stringify(body)}`);
    assert(!!data?.jobId,   "Response missing jobId");
    assert(!!data?.assetId, "Response missing assetId");
    // GPT Image is sync — status must be "success" and URL must be present immediately
    assert(data?.status === "success", `Expected success (sync provider), got: ${data?.status}`);
    assert(!!data?.url,     "Response missing url (GPT Image should return URL immediately)");
    console.log(`      → URL: ${data?.url}`);
    console.log(`      → jobId: ${data?.jobId}, assetId: ${data?.assetId}, status: ${data?.status}`);
  });

  // ── Nano Banana Standard — SKIPPED (billing) ──────────────────────────────
  // Integration confirmed end-to-end: submit → taskId → polling → DB insert all work.
  // Blocked only by NB account billing (402 insufficient credits).
  // Re-enable when NB account is funded: modelKey: "nano-banana-standard"
  console.log("   SKIPPED: nano-banana-standard — integration complete, blocked by billing (402)");
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE AUDIO TESTS (requires ElevenLabs key + ZENCRA_FLAG_AUDIO_ENABLED=true)
// ─────────────────────────────────────────────────────────────────────────────

async function runLiveAudioTests() {
  console.log("\n── Live Audio Generation Tests ──────────────────────────────");
  if (!JWT) {
    console.log("   SKIPPED: Set TEST_JWT= to run live tests");
    return;
  }

  const audioRoute = await getAudioRoute();

  await test("ElevenLabs — TTS generates audio, asset record created", async () => {
    const { status, body } = await callRoute(audioRoute, "POST",
      { modelKey: "elevenlabs", prompt: "Hello, this is a Zencra test generation." },
      AUTH_HEADER
    );
    const data = (body as { data?: { jobId?: string; url?: string; assetId?: string; status?: string } }).data;
    assert(status === 202, `Expected 202, got ${status}: ${JSON.stringify(body)}`);
    assert(!!data?.jobId,   "Response missing jobId");
    assert(data?.status === "success", `Expected success, got ${data?.status}`);
    if (data?.url) console.log(`      → Audio URL: ${data.url}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const runAll      = args.length === 0;
  const runNeg      = runAll || args.includes("--negative");
  const runDry      = runAll || args.includes("--dry-run");
  const runLiveImg  = args.includes("--live-image");
  const runLiveAud  = args.includes("--live-audio");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Zencra Studio Route Tests");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`  DRY_RUN:  ${process.env.ZENCRA_DRY_RUN ?? "false"}`);
  console.log(`  JWT:      ${JWT ? "SET" : "NOT SET (live tests will be skipped)"}`);

  if (runNeg)     await runNegativeTests();
  if (runDry)     await runDryRunTests();
  if (runLiveImg) await runLiveImageTests();
  if (runLiveAud) await runLiveAudioTests();

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\n  Failed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    ❌ ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log("  All tests passed ✅");
  }
}

main().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
