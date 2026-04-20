#!/usr/bin/env npx tsx
/**
 * nb-backfill.ts — One-time Nano Banana pending asset recovery script
 *
 * Purpose:
 *   Finds all NB assets in the Supabase `assets` table that are still
 *   `status = "pending"` with a known `external_job_id`, re-polls the NB API
 *   to see if they completed, and if so mirrors the result image to Supabase
 *   Storage + marks the DB row `ready`.
 *
 * Usage:
 *   npx tsx scripts/nb-backfill.ts [--dry-run] [--limit=20]
 *
 * Options:
 *   --dry-run   Poll NB and log results, but do NOT write to Supabase
 *   --limit=N   Process at most N assets (default: 50)
 *
 * Prerequisites:
 *   Requires .env.local with:
 *     NEXT_PUBLIC_SUPABASE_URL
 *     SUPABASE_SERVICE_ROLE_KEY
 *     NANO_BANANA_API_KEY
 *     NANO_BANANA_API_BASE_URL
 *
 * Run from the project root:
 *   npx tsx scripts/nb-backfill.ts
 *   npx tsx scripts/nb-backfill.ts --dry-run
 */

import * as fs   from "fs";
import * as path from "path";
import * as https from "https";

// ── Load .env.local manually (no Next.js runtime here) ──────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌  .env.local not found. Run from the project root.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    // Strip surrounding quotes, then strip inline comments (e.g. "value  # note")
    // Must strip quotes first so a quoted hash is preserved; our env values are
    // unquoted API keys/URLs so ` #` anywhere after the value is safe to remove.
    const raw = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    const val = raw.replace(/\s+#.*$/, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// ── Env validation ───────────────────────────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const NB_API_KEY        = process.env.NANO_BANANA_API_KEY!;
const NB_BASE_URL       = process.env.NANO_BANANA_API_BASE_URL!;

for (const [k, v] of Object.entries({ SUPABASE_URL, SERVICE_ROLE_KEY, NB_API_KEY, NB_BASE_URL })) {
  if (!v) { console.error(`❌  Missing env var: ${k}`); process.exit(1); }
}

// ── Args ─────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT   = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "50", 10);

// ── Supabase REST helpers ─────────────────────────────────────────────────────
type Asset = {
  id:              string;
  external_job_id: string;
  model_key:       string;
  user_id:         string;
  url:             string | null;
  status:          string;
  storage_path:    string | null;
  bucket:          string | null;
};

async function supabaseFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Prefer":        "return=representation",
      ...(options.headers ?? {}),
    },
  });
}

async function getPendingNBAssets(): Promise<Asset[]> {
  const res = await supabaseFetch(
    `/assets?status=eq.pending&model_key=like.nano-banana%25&external_job_id=not.is.null&limit=${LIMIT}&select=id,external_job_id,model_key,user_id,url,status,storage_path,bucket`,
    { method: "GET" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<Asset[]>;
}

async function updateAssetReady(assetId: string, publicUrl: string, storagePath: string): Promise<void> {
  const res = await supabaseFetch(
    `/assets?id=eq.${encodeURIComponent(assetId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status:       "ready",
        url:          publicUrl,
        storage_path: storagePath,
        bucket:       "generations",
        updated_at:   new Date().toISOString(),
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update failed (${res.status}): ${text}`);
  }
}

// ── NB API poll ───────────────────────────────────────────────────────────────
type NBPollResult =
  | { outcome: "success"; url: string }
  | { outcome: "pending" }
  | { outcome: "failed";  reason: string }
  | { outcome: "expired"; reason: string };

async function pollNB(taskId: string): Promise<NBPollResult> {
  const endpoint = `${NB_BASE_URL}/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      headers: { "Authorization": `Bearer ${NB_API_KEY}`, "Accept": "application/json" },
      signal:  AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { outcome: "failed", reason: `Network error: ${String(e)}` };
  }

  if (!res.ok) {
    return { outcome: "failed", reason: `HTTP ${res.status}` };
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json() as Record<string, unknown>;
  } catch {
    return { outcome: "failed", reason: "Invalid JSON from NB API" };
  }

  // NB may nest under body.data
  const data = (
    body.data != null && typeof body.data === "object" && !Array.isArray(body.data)
      ? body.data
      : body
  ) as Record<string, unknown>;

  console.log(`  [NB raw] taskId=${taskId}:`, JSON.stringify(data).slice(0, 400));

  // ── Status decode ─────────────────────────────────────────────────────────
  const numStatus = Number(data.taskStatus ?? data.task_status ?? -1);
  const strStatus = String(data.status ?? data.taskStatusStr ?? "").toUpperCase();

  const isSuccess =
    numStatus === 1 || ["SUCCESS", "COMPLETED", "DONE"].includes(strStatus);
  const isFailed  =
    numStatus === 2 || numStatus === 3 ||
    ["FAILED", "ERROR", "CREATE_TASK_FAILED", "GENERATE_FAILED"].includes(strStatus);
  const isPending =
    numStatus === 0 || strStatus === "GENERATING" || strStatus === "PENDING" ||
    (!isSuccess && !isFailed);

  if (isFailed)  return { outcome: "failed",  reason: strStatus || `taskStatus=${numStatus}` };
  if (isPending) return { outcome: "pending" };

  // ── Extract URL (mirrors nano-banana.ts extractUrl logic) ─────────────────
  const extractUrl = (src: Record<string, unknown>): string | undefined => {
    if (Array.isArray(src.result_urls)) {
      for (const u of src.result_urls) {
        if (typeof u === "string" && u.trim()) return u.trim();
      }
    }
    if (typeof src.result_urls === "string" && src.result_urls) {
      const first = src.result_urls.split(",")[0].trim();
      if (first) return first;
    }
    if (typeof src.imageUrl  === "string" && src.imageUrl)  return src.imageUrl;
    if (typeof src.image_url === "string" && src.image_url) return src.image_url;
    if (typeof src.url       === "string" && src.url)       return src.url;
    if (typeof src.imagUrl   === "string" && src.imagUrl)   return src.imagUrl;
    if (Array.isArray(src.images)    && typeof src.images[0]    === "string") return src.images[0];
    if (Array.isArray(src.imageUrls) && typeof src.imageUrls[0] === "string") return src.imageUrls[0];
    if (src.output && typeof src.output === "object") {
      const out = src.output as Record<string, unknown>;
      if (typeof out.image === "string" && out.image) return out.image;
      if (typeof out.url   === "string" && out.url)   return out.url;
    }
    if (src.result && typeof src.result === "object") {
      const r2 = src.result as Record<string, unknown>;
      if (typeof r2.url   === "string" && r2.url)   return r2.url;
      if (typeof r2.image === "string" && r2.image) return r2.image;
    }
    return undefined;
  };

  const url = extractUrl(data);
  if (!url) {
    return { outcome: "failed", reason: "success status but no URL found in response" };
  }

  return { outcome: "success", url };
}

// ── Mirror image to Supabase Storage ─────────────────────────────────────────
async function mirrorToStorage(
  externalUrl: string,
  assetId:     string,
): Promise<{ publicUrl: string; storagePath: string }> {
  const imgRes = await fetch(externalUrl, { signal: AbortSignal.timeout(30_000) });
  if (!imgRes.ok) {
    throw new Error(`Image fetch failed (${imgRes.status}) — URL likely expired`);
  }

  const buffer      = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const ext         = contentType.includes("png") ? "png" : "jpg";
  const storagePath = `nb-generations/${assetId}.${ext}`;

  // Upload via Supabase Storage REST API
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/generations/${storagePath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization":   `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type":    contentType,
      "x-upsert":        "true",
      "Cache-Control":   "3600",
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Storage upload failed (${uploadRes.status}): ${text}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/generations/${storagePath}`;
  return { publicUrl, storagePath };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  NB BACKFILL SCRIPT" + (DRY_RUN ? " [DRY RUN — no writes]" : ""));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  NB base:  ${NB_BASE_URL}`);
  console.log(`  Limit:    ${LIMIT}`);
  console.log();

  // 1. Fetch pending NB assets from Supabase
  console.log("▶  Querying pending NB assets…");
  let assets: Asset[];
  try {
    assets = await getPendingNBAssets();
  } catch (e) {
    console.error("❌  Supabase query failed:", e);
    process.exit(1);
  }

  if (assets.length === 0) {
    console.log("✅  No pending NB assets found. Nothing to recover.");
    return;
  }

  console.log(`   Found ${assets.length} pending asset(s).\n`);

  // 2. Process each asset
  const results = {
    recovered: 0,
    pending:   0,
    failed:    0,
    expired:   0,
  };

  for (const asset of assets) {
    const { id, external_job_id, model_key } = asset;
    console.log(`─── Asset ${id} | model=${model_key} | taskId=${external_job_id}`);

    // Poll NB
    const poll = await pollNB(external_job_id);

    if (poll.outcome === "pending") {
      console.log("  ⏳  Still generating — skipping (retry later)\n");
      results.pending++;
      continue;
    }

    if (poll.outcome === "failed") {
      console.log(`  ❌  Provider reported failure: ${poll.reason}`);
      console.log("      DB row left as pending (no update made)\n");
      results.failed++;
      continue;
    }

    if (poll.outcome === "expired") {
      console.log(`  ⚠️   URL expired — recovery impossible: ${poll.reason}`);
      console.log("      DB row left as pending (re-generation required)\n");
      results.expired++;
      continue;
    }

    // outcome === "success"
    console.log(`  ✅  NB confirmed success. URL: ${poll.url.slice(0, 80)}…`);

    if (DRY_RUN) {
      console.log("  [dry-run] Skipping Storage upload + DB update\n");
      results.recovered++;
      continue;
    }

    // Mirror to storage
    let publicUrl: string;
    let storagePath: string;
    try {
      ({ publicUrl, storagePath } = await mirrorToStorage(poll.url, id));
      console.log(`  📦  Mirrored → ${publicUrl.slice(0, 80)}…`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("fetch failed")) {
        console.log(`  ⚠️   Image URL has expired — recovery impossible.`);
        console.log(`      ${msg}\n`);
        results.expired++;
      } else {
        console.log(`  ❌  Storage upload failed: ${msg}`);
        console.log("      DB row left unchanged.\n");
        results.failed++;
      }
      continue;
    }

    // Update DB
    try {
      await updateAssetReady(id, publicUrl, storagePath);
      console.log("  💾  DB updated → status=ready\n");
      results.recovered++;
    } catch (e) {
      console.error(`  ❌  DB update failed:`, e);
      console.log("      Image is in Storage but DB row unchanged. Manual fix needed.\n");
      results.failed++;
    }
  }

  // 3. Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  BACKFILL COMPLETE");
  console.log(`  ✅  Recovered:        ${results.recovered}`);
  console.log(`  ⏳  Still pending:    ${results.pending}`);
  console.log(`  ⚠️   URL expired:      ${results.expired}  ← re-generate manually`);
  console.log(`  ❌  Failed/skipped:   ${results.failed}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((e) => {
  console.error("\n❌  Unhandled error:", e);
  process.exit(1);
});
