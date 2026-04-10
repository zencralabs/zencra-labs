/**
 * Zencra Labs — Supabase Live Verification Script v2
 *
 * READ-ONLY by default — safe to run in CI or at any time without side effects.
 * Set DEMO_MODE=true to run the full mutation simulation (spend, refund, insert).
 *
 * Usage:
 *   node scripts/verify-supabase.mjs                     # read-only checks
 *   DEMO_MODE=true node scripts/verify-supabase.mjs      # full simulation
 *
 * Checks:
 *   1. RPC existence   — spend_credits, refund_credits
 *   2. Demo user       — profiles row exists
 *   3. Current balance — profiles.credits
 *   4. Generations shape — column names readable (no insert)
 *   5. [DEMO] Full generation insert + spend_credits RPC
 *   6. [DEMO] refund_credits RPC + insufficient-credits guard
 *   7. Latest credit_transactions rows (read-only)
 *   8. Latest generations rows (read-only)
 *
 * Live schema (confirmed 2026-04-10):
 *   profiles            — id, credits (NOT NULL, default 10), plan, role …
 *   credit_transactions — id, user_id, type, amount, balance_after,
 *                         description, metadata (jsonb), created_at
 *   generations         — id, user_id, tool, tool_category, prompt,
 *                         status, credits_used, parameters, result_url,
 *                         metadata, mode, provider, updated_at, created_at …
 */

import { createClient } from "@supabase/supabase-js";

// ─── Config ───────────────────────────────────────────────────────────────────
// Prefer .env values so secrets never need to be hard-coded after first run.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? "https://qlhfmhawhdpagkxaldae.supabase.co";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsaGZtaGF3aGRwYWdreGFsZGFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5Nzg3MSwiZXhwIjoyMDkwOTczODcxfQ.fAviodBtIFqdjhoXIPXg1mKFh5yQvcN9yhQbr04yHxI";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_MODE    = process.env.DEMO_MODE === "true";

// Nil UUID — used only for RPC existence probing. Never inserted anywhere.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Output helpers ───────────────────────────────────────────────────────────
let errors = 0;
const W = 40;
const HR = "─".repeat(66);
const HL = "═".repeat(66);

const fmt = (label) => String(label).padEnd(W);
const val = (v)     => JSON.stringify(v);

function section(n, title) {
  console.log(`\n${HR}\n  ${n}. ${title}\n${HR}`);
}
function pass(label, detail = "") {
  console.log(`  ✅  ${fmt(label)}${detail}`);
}
function fail(label, detail = "") {
  errors++;
  console.log(`  ❌  ${fmt(label)}${detail}`);
}
function info(label, value) {
  console.log(`  ℹ️   ${fmt(label)}${val(value)}`);
}
function skip(label) {
  console.log(`  ⏭️   ${fmt(label)}(DEMO_MODE not set — skipped)`);
}
function check(label, ok, detail = "") {
  ok ? pass(label, detail) : fail(label, detail);
}

// ─── Header ───────────────────────────────────────────────────────────────────
console.log(`\n${HL}`);
console.log("  Zencra Labs — Supabase Live Verification v2");
console.log(`  Project  : qlhfmhawhdpagkxaldae`);
console.log(`  Mode     : ${DEMO_MODE ? "🟠 DEMO — mutations enabled" : "🟢 READ-ONLY — safe"}`);
console.log(`  Demo UID : ${DEMO_USER_ID}`);
console.log(HL);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Probes whether an RPC exists without mutating any data.
 * Uses the nil UUID so the function returns "User not found" (success=false)
 * rather than actually touching any row.
 * If the function is missing, PostgREST returns code PGRST202 or error message
 * containing "Could not find the function".
 */
async function probeRpc(name) {
  const { error } = await db.rpc(name, {
    p_user_id:       NIL_UUID,
    p_amount:        0,
    p_description:   "__probe__",
    p_generation_id: null,
  });
  const missing =
    error && (
      error.code === "PGRST202" ||
      error.message?.toLowerCase().includes("could not find the function") ||
      error.message?.toLowerCase().includes("does not exist")
    );
  return { exists: !missing, errorCode: error?.code, errorMsg: error?.message };
}

// ─── 1. RPC existence ─────────────────────────────────────────────────────────
section(1, "RPC FUNCTIONS — existence check (no mutations)");

const spend  = await probeRpc("spend_credits");
const refund = await probeRpc("refund_credits");

check(
  "spend_credits exists",
  spend.exists,
  spend.exists ? "" : `  → ${spend.errorCode}: ${spend.errorMsg}`
);
check(
  "refund_credits exists",
  refund.exists,
  refund.exists ? "" : `  → ${refund.errorCode}: ${refund.errorMsg}`
);

if (!spend.exists || !refund.exists) {
  console.log(`\n  Run the migration files to deploy missing RPCs:`);
  console.log(`    supabase/migrations/001_spend_credits_rpc.sql`);
  console.log(`    supabase/migrations/002_refund_credits_rpc.sql`);
}

// ─── 2. Demo user ─────────────────────────────────────────────────────────────
section(2, "DEMO USER — profiles table");

const { data: profile, error: profileErr } = await db
  .from("profiles")
  .select("id, username, credits, plan, role, created_at")
  .eq("id", DEMO_USER_ID)
  .single();

if (profileErr || !profile) {
  fail("demo user in profiles", profileErr?.message ?? "row not found");
  console.log(`\n  Seed the demo user:`);
  console.log(`  -- Step 1: create auth.users entry`);
  console.log(`  INSERT INTO auth.users (id, aud, role, email, created_at, updated_at, is_sso_user)`);
  console.log(`  VALUES ('${DEMO_USER_ID}', 'authenticated', 'authenticated',`);
  console.log(`          'demo@zencralabs.dev', now(), now(), false)`);
  console.log(`  ON CONFLICT (id) DO NOTHING;`);
  console.log(`  -- Step 2: create profile`);
  console.log(`  INSERT INTO profiles (id, username, full_name, credits, role, plan)`);
  console.log(`  VALUES ('${DEMO_USER_ID}', 'demo_user', 'Demo User', 10, 'user', 'free')`);
  console.log(`  ON CONFLICT (id) DO UPDATE SET credits = 10;`);
} else {
  pass("demo user in profiles");
  info("username",  profile.username);
  info("plan",      profile.plan);
  info("role",      profile.role);
  info("member since", profile.created_at);
}

// ─── 3. Current balance ───────────────────────────────────────────────────────
section(3, "CURRENT BALANCE — profiles.credits");

const currentCredits = profile?.credits ?? 0;

if (!profile) {
  fail("profiles.credits readable", "demo user not found — run section 2 seed");
} else {
  pass("profiles.credits readable");
  info("credits", currentCredits);

  if (currentCredits < 3) {
    fail(
      "enough credits for simulation (≥ 3)",
      `currently ${currentCredits} — reset with:  UPDATE profiles SET credits = 10 WHERE id = '${DEMO_USER_ID}';`
    );
  } else {
    pass("enough credits for simulation (≥ 3)", `${currentCredits} available`);
  }
}

// ─── 4. Generations table shape ───────────────────────────────────────────────
section(4, "GENERATIONS TABLE — column shape (read-only, 0 rows fetched)");

const { error: shapeErr } = await db
  .from("generations")
  .select(
    "id, user_id, tool, tool_category, prompt, status, credits_used, " +
    "parameters, result_url, metadata, mode, provider, created_at, updated_at"
  )
  .limit(0);

if (shapeErr) {
  fail("generations column shape", shapeErr.message);
} else {
  pass("tool, tool_category");
  pass("status, credits_used");
  pass("result_url, parameters, metadata");
  pass("mode, provider (nullable extras)");
  pass("prompt, user_id, created_at, updated_at");
}

// ─── 5. [DEMO] Full generation insert + spend_credits ─────────────────────────
section(5, "FULL SIMULATION — generation insert + spend_credits [DEMO_MODE]");

let savedGenId     = null;
let creditsAfterSpend = currentCredits;

if (!DEMO_MODE) {
  skip("generation insert");
  skip("spend_credits call");
  skip("profiles.credits decremented");
} else if (currentCredits < 3) {
  fail("simulation skipped — insufficient credits", "reset balance first (see section 3)");
} else {
  // Simulate exactly what /api/generate/route.ts does in production
  const genPayload = {
    user_id:       DEMO_USER_ID,
    tool:          "dalle-3",
    tool_category: "image",
    prompt:        "a futuristic cyberpunk city at night — verify-supabase test",
    status:        "completed",
    result_url:    "https://example.com/mock-dalle-output.png",
    credits_used:  3,
    parameters:    { note: "verify-supabase integration test", provider: "dalle" },
    // metadata has default '{}' in live DB — not required
  };

  const { data: genRow, error: genErr } = await db
    .from("generations")
    .insert(genPayload)
    .select()
    .single();

  if (genErr) {
    fail("generations insert", genErr.message);
  } else {
    savedGenId = genRow.id;
    pass("generations insert succeeded");
    check("tool = 'dalle-3'",         genRow.tool          === "dalle-3");
    check("tool_category = 'image'",  genRow.tool_category === "image");
    check("status = 'completed'",     genRow.status        === "completed");
    check("credits_used = 3",         genRow.credits_used  === 3);
    info("generation id", genRow.id);

    // Call spend_credits RPC
    const { data: spendData, error: spendErr } = await db.rpc("spend_credits", {
      p_user_id:       DEMO_USER_ID,
      p_amount:        3,
      p_description:   "image generation via dalle-3",
      p_generation_id: genRow.id,
    });

    if (spendErr) {
      fail("spend_credits RPC call", spendErr.message);
    } else {
      const s = Array.isArray(spendData) ? spendData[0] : spendData;
      check("spend_credits success = true",  s?.success === true);
      check(
        "new_balance = before - 3",
        s?.new_balance === currentCredits - 3,
        `got ${s?.new_balance}, expected ${currentCredits - 3}`
      );
      check("error_message is null", s?.error_message === null);
      info("balance before", currentCredits);
      info("balance after",  s?.new_balance);
      creditsAfterSpend = s?.new_balance ?? currentCredits;
    }
  }
}

// ─── 6. [DEMO] refund_credits + guard ─────────────────────────────────────────
section(6, "REFUND + GUARD — refund_credits / insufficient-credits [DEMO_MODE]");

if (!DEMO_MODE) {
  skip("refund_credits call");
  skip("profiles.credits restored");
  skip("insufficient-credits guard");
} else {
  // Refund the 3 credits spent in section 5
  const { data: refundData, error: refundErr } = await db.rpc("refund_credits", {
    p_user_id:       DEMO_USER_ID,
    p_amount:        3,
    p_description:   "refund for verify-supabase test",
    p_generation_id: savedGenId,
  });

  if (refundErr) {
    fail("refund_credits RPC call", refundErr.message);
  } else {
    const r = Array.isArray(refundData) ? refundData[0] : refundData;
    check("refund_credits success = true",  r?.success === true);
    check(
      "new_balance = original",
      r?.new_balance === currentCredits,
      `got ${r?.new_balance}, expected ${currentCredits}`
    );
    check("error_message is null", r?.error_message === null);
    info("balance restored to", r?.new_balance);
  }

  // Verify balance in profiles after refund
  const { data: balCheck } = await db
    .from("profiles")
    .select("credits")
    .eq("id", DEMO_USER_ID)
    .single();
  check(
    "profiles.credits = original after refund",
    balCheck?.credits === currentCredits,
    `${balCheck?.credits} (expected ${currentCredits})`
  );

  // Insufficient credits guard
  const { data: guardData, error: guardErr } = await db.rpc("spend_credits", {
    p_user_id:       DEMO_USER_ID,
    p_amount:        999999,
    p_description:   "guard test",
    p_generation_id: null,
  });

  if (guardErr) {
    fail("insufficient-credits guard — RPC error", guardErr.message);
  } else {
    const g = Array.isArray(guardData) ? guardData[0] : guardData;
    check("guard: success = false",       g?.success === false);
    check("guard: error_message present", !!g?.error_message);
    info("guard error_message", g?.error_message);
  }
}

// ─── 7. Latest credit_transactions ───────────────────────────────────────────
section(7, "LATEST LEDGER — credit_transactions (last 3 rows, read-only)");

const { data: txns, error: txnsErr } = await db
  .from("credit_transactions")
  .select("type, amount, balance_after, description, metadata, created_at")
  .eq("user_id", DEMO_USER_ID)
  .order("created_at", { ascending: false })
  .limit(3);

if (txnsErr) {
  fail("credit_transactions readable", txnsErr.message);
} else if (!txns?.length) {
  info("credit_transactions", "no rows yet for demo user");
  pass("credit_transactions readable (empty)");
} else {
  pass("credit_transactions readable", `${txns.length} row(s)`);
  txns.forEach((t, i) => {
    console.log(`\n  ── Row ${i + 1} ──`);
    info("  type",          t.type);
    info("  amount",        t.amount);
    info("  balance_after", t.balance_after);
    info("  description",   t.description);
    info("  metadata",      t.metadata);
    info("  created_at",    t.created_at);
  });
}

// ─── 8. Latest generations ────────────────────────────────────────────────────
section(8, "LATEST GENERATIONS — generations table (last 3 rows, read-only)");

const { data: gens, error: gensErr } = await db
  .from("generations")
  .select("id, tool, tool_category, status, credits_used, prompt, created_at")
  .eq("user_id", DEMO_USER_ID)
  .order("created_at", { ascending: false })
  .limit(3);

if (gensErr) {
  fail("generations readable", gensErr.message);
} else if (!gens?.length) {
  info("generations", "no rows yet for demo user");
  pass("generations readable (empty)");
} else {
  pass("generations readable", `${gens.length} row(s)`);
  gens.forEach((g, i) => {
    console.log(`\n  ── Row ${i + 1} ──`);
    info("  id",            g.id);
    info("  tool",          g.tool);
    info("  tool_category", g.tool_category);
    info("  status",        g.status);
    info("  credits_used",  g.credits_used);
    info("  prompt",        g.prompt?.slice(0, 60) + (g.prompt?.length > 60 ? "…" : ""));
    info("  created_at",    g.created_at);
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${HL}`);
if (errors === 0) {
  console.log("  ✅  ALL CHECKS PASSED — Supabase integration is live and correct.");
  if (!DEMO_MODE) {
    console.log("  💡  Re-run with DEMO_MODE=true for full spend/refund mutation tests.");
  }
} else {
  console.log(`  ❌  ${errors} check(s) FAILED — review the output above.`);
}
console.log(`${HL}\n`);

process.exit(errors > 0 ? 1 : 0);
