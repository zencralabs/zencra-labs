/**
 * Zencra Labs — API Logic Test Suite
 * Run with:  node scripts/test-api.mjs
 *
 * Tests all business logic without needing a running server.
 * For HTTP endpoint tests, see the curl commands at the bottom.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${e.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual: (expected) => {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b)
        throw new Error(`Expected ${b}, got ${a}`);
    },
    toBeGreaterThan: (n) => {
      if (actual <= n) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
  };
}

// ─── calculateCredits (inlined — mirrors src/lib/credits/calculate.ts) ────────
function getBaseCredits(mode) {
  return { image: 2, video: 10, audio: 3 }[mode] ?? 0;
}
function getQualityModifier(quality) {
  return { draft: 0, cinematic: 1, studio: 3 }[quality] ?? 1;
}
function calculateCredits({ mode, quality, durationSeconds }) {
  const base = getBaseCredits(mode);
  const modifiers = {};
  const qMod = getQualityModifier(quality);
  if (qMod > 0) modifiers.quality = qMod;
  if (mode === "video" && durationSeconds && durationSeconds > 5)
    modifiers.duration = Math.ceil((durationSeconds - 5) / 5);
  const total = base + Object.values(modifiers).reduce((s, v) => s + v, 0);
  return { base, modifiers, total };
}

// ─── Tool Registry (inlined — mirrors src/lib/ai/tool-registry.ts) ───────────
const TOOL_REGISTRY = {
  image: { "dalle": "dalle-3", "nano-banana": "nano-banana-pro", "ideogram": "ideogram-v2" },
  video: { "kling": "kling-v1", "seedance": "seedance-v1",       "heygen": "heygen-v2"     },
  audio: { "elevenlabs": "elevenlabs-turbo-v2"                                              },
};
function resolveTool(mode, provider) {
  return TOOL_REGISTRY[mode]?.[provider] ?? `${provider}-${mode}`;
}

// ─── toDbStatus (inlined — mirrors src/app/api/generate/route.ts) ─────────────
function toDbStatus(s) {
  if (s === "success")    return "completed";
  if (s === "error")      return "failed";
  if (s === "queued")     return "pending";
  if (s === "processing") return "processing";
  return "pending";
}

// ─── Tests ────────────────────────────────────────────────────────────────────
console.log("\n📦  calculateCredits\n");

test("image cinematic = 2 base + 1 quality = 3", () => {
  const r = calculateCredits({ mode: "image", quality: "cinematic" });
  expect(r.total).toBe(3);
  expect(r.base).toBe(2);
  expect(r.modifiers.quality).toBe(1);
});

test("image draft = 2 base + 0 quality = 2", () => {
  const r = calculateCredits({ mode: "image", quality: "draft" });
  expect(r.total).toBe(2);
});

test("image studio = 2 base + 3 quality = 5", () => {
  const r = calculateCredits({ mode: "image", quality: "studio" });
  expect(r.total).toBe(5);
});

test("video cinematic 5s = 10 + 1 = 11", () => {
  const r = calculateCredits({ mode: "video", quality: "cinematic", durationSeconds: 5 });
  expect(r.total).toBe(11);
  expect(r.modifiers.duration).toBe(undefined);
});

test("video cinematic 10s = 10 + 1 quality + 1 duration = 12", () => {
  const r = calculateCredits({ mode: "video", quality: "cinematic", durationSeconds: 10 });
  expect(r.total).toBe(12);
  expect(r.modifiers.duration).toBe(1);
});

test("video cinematic 30s = 10 + 1 quality + 5 duration = 16", () => {
  const r = calculateCredits({ mode: "video", quality: "cinematic", durationSeconds: 30 });
  expect(r.modifiers.duration).toBe(5);
  expect(r.total).toBe(16);
});

test("audio cinematic = 3 + 1 = 4", () => {
  const r = calculateCredits({ mode: "audio", quality: "cinematic" });
  expect(r.total).toBe(4);
});

console.log("\n🗂️   Tool Registry\n");

test("image + dalle    → 'dalle-3'",            () => expect(resolveTool("image", "dalle")).toBe("dalle-3"));
test("image + nano-banana → 'nano-banana-pro'", () => expect(resolveTool("image", "nano-banana")).toBe("nano-banana-pro"));
test("image + ideogram → 'ideogram-v2'",        () => expect(resolveTool("image", "ideogram")).toBe("ideogram-v2"));
test("video + kling    → 'kling-v1'",           () => expect(resolveTool("video", "kling")).toBe("kling-v1"));
test("video + seedance → 'seedance-v1'",        () => expect(resolveTool("video", "seedance")).toBe("seedance-v1"));
test("video + heygen   → 'heygen-v2'",          () => expect(resolveTool("video", "heygen")).toBe("heygen-v2"));
test("audio + elevenlabs → 'elevenlabs-turbo-v2'", () => expect(resolveTool("audio", "elevenlabs")).toBe("elevenlabs-turbo-v2"));
test("unknown provider → safe fallback (never null)", () => {
  const result = resolveTool("image", "unknown-future-provider");
  if (!result || result.length === 0) throw new Error("fallback was empty/null");
  expect(result).toBe("unknown-future-provider-image");
});

console.log("\n🔄  toDbStatus (status mapping)\n");

test("'success' → 'completed'",   () => expect(toDbStatus("success")).toBe("completed"));
test("'error'   → 'failed'",      () => expect(toDbStatus("error")).toBe("failed"));
test("'queued'  → 'pending'",     () => expect(toDbStatus("queued")).toBe("pending"));
test("'pending' → 'pending'",     () => expect(toDbStatus("pending")).toBe("pending"));
test("'processing' → 'processing'", () => expect(toDbStatus("processing")).toBe("processing"));

console.log("\n🗄️   DB payload shape\n");

test("generation payload has all required non-null fields", () => {
  const body   = { mode: "image", prompt: "a futuristic city", quality: "cinematic" };
  const result = { provider: "dalle", status: "success", url: "https://example.com/img.png", metadata: {} };
  const cost   = calculateCredits({ mode: body.mode, quality: body.quality });

  const toolName = resolveTool(body.mode, result.provider);

  const payload = {
    user_id:       "00000000-0000-0000-0000-000000000001",
    tool:          toolName,                             // "dalle-3"
    tool_category: body.mode,                           // "image"
    prompt:        body.prompt,
    status:        toDbStatus(result.status),           // "completed"
    result_url:    result.url ?? null,
    credits_used:  result.status !== "error" ? cost.total : 0,
    parameters:    result.metadata ?? {},
  };

  // tool must be the resolved model name, not the bare provider
  expect(payload.tool).toBe("dalle-3");
  expect(payload.tool_category).toBe("image");
  expect(payload.status).toBe("completed");
  expect(payload.credits_used).toBe(3);
  expect(payload.result_url).toBe("https://example.com/img.png");

  // Ensure no NOT NULL field is null/undefined
  const notNullFields = ["user_id", "tool", "tool_category", "prompt", "status", "credits_used"];
  for (const f of notNullFields) {
    if (payload[f] === null || payload[f] === undefined)
      throw new Error("NOT NULL violation: " + f + " is " + payload[f]);
  }
});

test("failed generation → credits_used = 0", () => {
  const result = { provider: "dalle", status: "error" };
  const cost   = calculateCredits({ mode: "image", quality: "cinematic" });
  const credits_used = result.status !== "error" ? cost.total : 0;
  expect(credits_used).toBe(0);
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`  ${passed} passed  |  ${failed} failed\n`);
if (failed > 0) process.exit(1);

// ─── HTTP Test Commands (run these in your terminal) ──────────────────────────
console.log("🌐  HTTP curl tests — run these in YOUR terminal (with server running):\n");
console.log(`# 1. Credit estimate (no auth needed)
curl -s -X POST http://localhost:3000/api/credits/estimate \\
  -H "Content-Type: application/json" \\
  -d '{"mode":"image","quality":"cinematic"}' | jq .

# Expected: { success: true, data: { base: 2, modifiers: { quality: 1 }, total: 3 } }

# 2. Credit balance (reads profiles table — needs demo user seeded)
curl -s http://localhost:3000/api/credits/balance | jq .

# Expected: { success: true, data: { available: 10 } }

# 3. Credit history (reads credit_transactions)
curl -s http://localhost:3000/api/credits/history | jq .

# Expected: { success: true, data: [], meta: { total: 0, ... } }

# 4. Generate (full flow — needs demo user + spend_credits RPC)
curl -s -X POST http://localhost:3000/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{"mode":"image","prompt":"a futuristic cyberpunk city at night","quality":"cinematic"}' | jq .

# Expected: { success: true, data: { provider, status: "success", url: "..." }, credits: { used: 3 } }

# 5. Insufficient credits test (seed a user with 0 credits first)
# Update demo user: UPDATE profiles SET credits = 0 WHERE id = '00000000-0000-0000-0000-000000000001';
# Then re-run test 4 — should return 402 with error: "Insufficient credits"
`);
