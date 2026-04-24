#!/usr/bin/env tsx
/**
 * Zencra Labs — Generation Concurrency & Abuse Test Script
 *
 * Simulates concurrent / rapid generation requests to verify:
 *   - Credits do not go negative (atomic RPC guard)
 *   - Idempotency deduplication works (same request ID → cached result)
 *   - Rate limit triggers correctly (10 req/60s per user)
 *   - Double-click protection (rapid same-user requests)
 *   - Each request returns a unique job ID
 *   - Concurrent job cap enforced (MAX_CONCURRENT_JOBS = 3)
 *
 * Run: npm run test:generation-concurrency
 *
 * Requirements:
 *   - .env.local with NEXT_PUBLIC_APP_URL
 *   - TEST_JWT (valid Supabase user JWT)
 *   - Server running: npm run dev
 *   - User must have sufficient credits for multi-request tests
 *
 * WARNING: This script makes REAL API calls (but uses dry-run if ZENCRA_DRY_RUN=true)
 * Run against a test/preview environment, not production.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TEST_JWT  = process.env.TEST_JWT ?? "";
const CONCURRENCY = parseInt(process.env.TEST_CONCURRENCY ?? "5", 10);

if (!TEST_JWT) {
  console.error("❌ TEST_JWT is required. Set it in your environment.");
  console.error("   export TEST_JWT=eyJ...");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function sendGenerateRequest(
  prompt: string,
  modelKey = "gpt-image-1"
): Promise<{ status: number; body: Record<string, unknown>; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/studio/image/generate`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${TEST_JWT}`,
      },
      body: JSON.stringify({ modelKey, prompt }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { status: res.status, body, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 0,
      body: { error: err instanceof Error ? err.message : String(err) },
      latencyMs: Date.now() - start,
    };
  }
}

async function getCreditsBalance(): Promise<number | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/credits/balance`, {
      headers: { Authorization: `Bearer ${TEST_JWT}` },
    });
    const json = await res.json() as Record<string, unknown>;
    const balance = json.balance ?? json.credits ?? json.data;
    return typeof balance === "number" ? balance : null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITES
// ─────────────────────────────────────────────────────────────────────────────

async function testConcurrentRequests(): Promise<void> {
  console.log(`\n── Test 1: Concurrent requests (${CONCURRENCY} simultaneous) ──`);

  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) =>
      sendGenerateRequest(`Concurrent test image ${i + 1} — a scenic mountain landscape`)
    )
  );

  const statuses = results.map((r) => r.status);
  const jobIds   = results
    .filter((r) => r.status === 202)
    .map((r) => (r.body.data as Record<string, unknown> | undefined)?.jobId as string | undefined)
    .filter(Boolean);

  const uniqueJobIds = new Set(jobIds);
  const latencies    = results.map((r) => r.latencyMs);
  const avgLatency   = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  console.log(`   Statuses: ${JSON.stringify(statuses)}`);
  console.log(`   Unique job IDs: ${uniqueJobIds.size} / ${jobIds.length} (should all be unique)`);
  console.log(`   Avg latency: ${avgLatency}ms`);

  const pass = jobIds.length === uniqueJobIds.size;
  console.log(`   ${pass ? "✅" : "❌"} Job ID uniqueness: ${pass ? "PASS" : "FAIL — duplicate job IDs detected"}`);

  // Check that concurrent job cap (3) triggers for excess requests
  const blocked = statuses.filter((s) => s === 429).length;
  if (CONCURRENCY > 3 && blocked > 0) {
    console.log(`   ✅ Concurrent job cap triggered correctly: ${blocked} request(s) blocked`);
  } else if (CONCURRENCY > 3 && blocked === 0) {
    console.log(`   ⚠️  All ${CONCURRENCY} concurrent requests were accepted — cap may not be enforced (or server has capacity)`);
  }
}

async function testDoubleClickProtection(): Promise<void> {
  console.log(`\n── Test 2: Double-click protection (same prompt, rapid fire) ──`);

  const prompt = `Double-click test — golden sunset over the ocean ${Date.now()}`;

  // Fire 3 identical requests within milliseconds
  const results = await Promise.all([
    sendGenerateRequest(prompt),
    sendGenerateRequest(prompt),
    sendGenerateRequest(prompt),
  ]);

  const statuses = results.map((r) => r.status);
  const jobIds   = results
    .filter((r) => r.status === 202)
    .map((r) => (r.body.data as Record<string, unknown> | undefined)?.jobId as string | undefined)
    .filter(Boolean);

  const uniqueJobIds = new Set(jobIds);

  console.log(`   Statuses: ${JSON.stringify(statuses)}`);
  console.log(`   Unique job IDs: ${uniqueJobIds.size} / ${jobIds.length}`);

  // Expect: idempotency deduplicated → fewer unique job IDs than requests
  // OR: rate limit blocked extra requests → some 429s
  const deduped  = uniqueJobIds.size < jobIds.length;
  const blocked  = statuses.some((s) => s === 429);
  const protected_ = deduped || blocked;

  console.log(`   ${protected_ ? "✅" : "⚠️"} Double-click protection: ${
    protected_
      ? `ACTIVE (${deduped ? "idempotency deduplication" : "rate limit"} triggered)`
      : "Not triggered — all identical requests processed separately (acceptable if idempotency window expired)"
  }`);
}

async function testRateLimitTrigger(): Promise<void> {
  console.log(`\n── Test 3: Rate limit trigger (rapid sequential requests) ──`);
  console.log(`   Sending 12 requests sequentially to trigger 10/min user limit...`);

  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    const { status } = await sendGenerateRequest(`Rate limit test ${i + 1} — ${Date.now()}`);
    statuses.push(status);
    process.stdout.write(`.`);
  }
  console.log();

  const rateLimited = statuses.filter((s) => s === 429).length;
  const pass = rateLimited > 0;

  console.log(`   Statuses: ${JSON.stringify(statuses)}`);
  console.log(`   Rate limited: ${rateLimited} / 12`);
  console.log(`   ${pass ? "✅" : "⚠️"} Rate limit: ${pass ? "TRIGGERED correctly" : "NOT triggered — review rate-limit config"}`);
}

async function testCreditIntegrity(): Promise<void> {
  console.log(`\n── Test 4: Credit integrity (balance does not go negative) ──`);

  const balanceBefore = await getCreditsBalance();
  console.log(`   Balance before: ${balanceBefore ?? "unknown"}`);

  if (balanceBefore === null) {
    console.log(`   ⚠️  Could not read balance — skipping credit integrity check`);
    return;
  }

  // Send 3 concurrent requests and check balance after
  await Promise.all([
    sendGenerateRequest("Credit test image 1 — a mountain lake at dawn"),
    sendGenerateRequest("Credit test image 2 — a futuristic city skyline"),
    sendGenerateRequest("Credit test image 3 — an abstract watercolor painting"),
  ]);

  // Wait briefly for DB writes
  await new Promise((r) => setTimeout(r, 1500));

  const balanceAfter = await getCreditsBalance();
  console.log(`   Balance after: ${balanceAfter ?? "unknown"}`);

  if (balanceAfter !== null && balanceBefore !== null) {
    const pass = balanceAfter >= 0;
    console.log(`   ${pass ? "✅" : "❌"} Balance non-negative: ${pass ? "PASS" : "FAIL — credits went negative"}`);

    if (balanceAfter > balanceBefore) {
      console.log(`   ⚠️  Balance INCREASED after generation — possible credit hook issue (review finalize/rollback)`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Zencra Concurrency & Abuse Tests`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Concurrency level: ${CONCURRENCY}`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`\n⚠️  WARNING: This script makes real API calls.`);
  console.log(`   Run against dev/preview only — NOT production.\n`);

  try {
    await testConcurrentRequests();
    await testDoubleClickProtection();
    await testCreditIntegrity();
    // Rate limit test last — it may exhaust the limit for the session
    await testRateLimitTrigger();
  } catch (err) {
    console.error("\nFatal error:", err);
    process.exit(1);
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Concurrency tests complete.`);
  console.log(`  Review results above — no automated pass/fail for all tests.`);
  console.log(`═══════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
