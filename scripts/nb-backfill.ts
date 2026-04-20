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
  created_at:      string;
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
    `/assets?status=eq.pending&model_key=like.nano-banana%25&external_job_id=not.is.null&limit=${LIMIT}&select=id,external_job_id,model_key,user_id,url,status,storage_path,bucket,created_at&order=created_at.asc`,
    { method: "GET" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<Asset[]>;
}

// Jobs older than this are assumed stale — NB will not complete them
const STALE_THRESHOLD_DAYS = 3;

async function updateAssetStale(assetId: string, reason: string): Promise<void> {
  const res = await supabaseFetch(
    `/assets?id=eq.${encodeURIComponent(assetId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status:     "failed",
        updated_at: new Date().toISOString(),
        // store the stale reason in the error_message column if it exists;
        // if the column doesn't exist Supabase will silently ignore it
        error_message: reason,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase stale-update failed (${res.status}): ${text}`);
  }
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
    const errText = await res.text().catch(() => "");
    return { outcome: "failed", reason: `HTTP ${res.status} — ${errText.slice(0, 200)}` };
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json() as Record<string, unknown>;
  } catch {
    return { outcome: "failed", reason: "Invalid JSON from NB API" };
  }

  // ── FULL untruncated log ─────────────────────────────────────────────────
  console.log(`\n  ┌─ NB RAW RESPONSE taskId=${taskId}`);
  console.log(`  │  HTTP status: ${res.status}`);
  console.log(`  │  Top-level keys: [${Object.keys(body).join(", ")}]`);
  console.log(JSON.stringify(body, null, 2).split("\n").map(l => `  │  ${l}`).join("\n"));
  console.log(`  └─ END RAW RESPONSE\n`);

  // body.data is the primary payload
  const hasNestedData =
    body.data != null && typeof body.data === "object" && !Array.isArray(body.data);
  const data = (hasNestedData ? body.data : body) as Record<string, unknown>;

  // ── 1. PRIMARY: successFlag + data.response.resultImageUrl ───────────────
  // Confirmed production structure (Apr 20 2026 raw response logs):
  //   body.data.successFlag         = 1
  //   body.data.response.resultImageUrl = "https://tempfile.aiquickdraw.com/..."
  const successFlag = Number(data.successFlag ?? -1);
  const responseObj = data.response;
  const primaryUrl =
    responseObj && typeof responseObj === "object" && !Array.isArray(responseObj)
      ? (responseObj as Record<string, unknown>).resultImageUrl
      : undefined;

  console.log(`  [decode] successFlag=${successFlag}  response.resultImageUrl=${JSON.stringify(primaryUrl ?? "(absent)")}`);

  if (successFlag === 1 && typeof primaryUrl === "string" && primaryUrl.trim()) {
    const url = primaryUrl.trim();
    console.log(`  ✅  SUCCESS via successFlag+resultImageUrl`);
    return { outcome: "success", url };
  }

  // ── 2. FALLBACK: all legacy / alternate field variants ────────────────────
  const extractUrl = (src: Record<string, unknown>): string | undefined => {
    if (Array.isArray(src.result_urls)) {
      for (const u of src.result_urls) { if (typeof u === "string" && u.trim()) return u.trim(); }
    }
    if (typeof src.result_urls === "string" && src.result_urls) {
      const first = src.result_urls.split(",")[0].trim(); if (first) return first;
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
    if (src.response && typeof src.response === "object") {
      const rsp = src.response as Record<string, unknown>;
      if (typeof rsp.resultImageUrl === "string" && rsp.resultImageUrl) return rsp.resultImageUrl;
      if (typeof rsp.imageUrl       === "string" && rsp.imageUrl)       return rsp.imageUrl;
      if (typeof rsp.url            === "string" && rsp.url)            return rsp.url;
    }
    return undefined;
  };

  const fallbackUrl = extractUrl(data) ?? extractUrl(body as Record<string, unknown>);
  if (fallbackUrl) {
    console.log(`  ✅  SUCCESS via fallback field`);
    return { outcome: "success", url: fallbackUrl };
  }

  // ── 3. Explicit failure codes ─────────────────────────────────────────────
  const numStatus = Number(data.taskStatus ?? data.task_status ?? -1);
  const strStatus = String(data.status ?? data.taskStatusStr ?? "").toUpperCase();
  const isFailed =
    numStatus === 2 || numStatus === 3 ||
    ["FAILED", "ERROR", "CREATE_TASK_FAILED", "GENERATE_FAILED"].includes(strStatus);

  if (isFailed) return { outcome: "failed", reason: strStatus || `taskStatus=${numStatus}` };

  // ── 4. None of the above → genuinely still pending ────────────────────────
  console.log(`  ⏳  No success signal found — treating as pending.`);
  console.log(`      successFlag=${successFlag}  numStatus=${numStatus}  strStatus="${strStatus}"`);
  return { outcome: "pending" };
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
    stale:     0,
  };

  for (const asset of assets) {
    const { id, external_job_id, model_key, created_at } = asset;

    const ageMs   = Date.now() - new Date(created_at).getTime();
    const ageDays = (ageMs / 86_400_000).toFixed(1);
    const isStale = ageMs > STALE_THRESHOLD_DAYS * 86_400_000;

    console.log(`─── Asset ${id} | model=${model_key} | age=${ageDays}d${isStale ? " [STALE]" : ""}`);
    console.log(`    taskId=${external_job_id}`);
    console.log(`    created_at=${created_at}`);

    // ── Stale-age check: if older than threshold, stop polling and mark stale ─
    if (isStale) {
      console.log(`  ⏰  Job is ${ageDays} days old (threshold: ${STALE_THRESHOLD_DAYS}d).`);
      console.log(`      NB provider will not complete jobs this old — marking as stale/failed.`);
      if (!DRY_RUN) {
        try {
          await updateAssetStale(id, `Stale after ${ageDays} days — NB provider did not complete.`);
          console.log("  💾  DB updated → status=failed (stale)\n");
        } catch (e) {
          console.error("  ❌  Failed to mark stale:", e, "\n");
        }
      } else {
        console.log("  [dry-run] Would mark as stale/failed\n");
      }
      results.stale++;
      continue;
    }

    // Poll NB for live status
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
  console.log("  BACKFILL COMPLETE" + (DRY_RUN ? " [DRY RUN]" : ""));
  console.log(`  ✅  Recovered:        ${results.recovered}`);
  console.log(`  ⏳  Still pending:    ${results.pending}  ← genuinely still generating`);
  console.log(`  ⏰  Marked stale:     ${results.stale}  ← too old, marked as failed`);
  console.log(`  ⚠️   URL expired:      ${results.expired}  ← re-generate manually`);
  console.log(`  ❌  Failed/skipped:   ${results.failed}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((e) => {
  console.error("\n❌  Unhandled error:", e);
  process.exit(1);
});
