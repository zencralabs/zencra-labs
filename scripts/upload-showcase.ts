/**
 * upload-showcase.ts — One-shot Supabase Storage upload for showcase videos
 *
 * Reads all MP4s from /public/showcase/ and uploads them to the
 * Supabase `showcase` bucket (public CDN).
 *
 * Run once from project root after sourcing .env.local:
 *   source .env.local && node --experimental-strip-types scripts/upload-showcase.ts
 *
 * After confirming all URLs play correctly, remove /public/showcase/ files
 * to stop Vercel serving them as static assets.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const __dirname  = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = join(__dirname, "..");
const SOURCE_DIR = join(REPO_ROOT, "public", "showcase");
const BUCKET     = "showcase";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing env vars. Source .env.local before running:");
  console.error("    source .env.local && node --experimental-strip-types scripts/upload-showcase.ts");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function publicUrl(filename: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n── Zencra Showcase Upload ────────────────────────────────────");
  console.log(`   Source : ${SOURCE_DIR}`);
  console.log(`   Bucket : ${BUCKET}`);
  console.log(`   Project: ${SUPABASE_URL}\n`);

  // List MP4 files
  const files = readdirSync(SOURCE_DIR)
    .filter(f => extname(f).toLowerCase() === ".mp4")
    .sort();

  if (files.length === 0) {
    console.warn("⚠️  No .mp4 files found in", SOURCE_DIR);
    process.exit(0);
  }

  console.log(`   Found ${files.length} file(s):\n`);

  let totalBytes = 0;
  const results: { filename: string; url: string; size: string; status: "ok" | "error" }[] = [];

  for (const filename of files) {
    const filePath = join(SOURCE_DIR, filename);
    const stats    = statSync(filePath);
    totalBytes    += stats.size;

    process.stdout.write(`   Uploading ${filename} (${formatBytes(stats.size)}) … `);

    const fileBuffer = readFileSync(filePath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, fileBuffer, {
        contentType:  "video/mp4",
        cacheControl: "public, max-age=31536000, immutable",
        upsert:       true,   // overwrite if re-running
      });

    if (error) {
      console.log("❌  FAILED");
      console.error(`      → ${error.message}`);
      results.push({ filename, url: "", size: formatBytes(stats.size), status: "error" });
    } else {
      const url = publicUrl(filename);
      console.log("✓");
      results.push({ filename, url, size: formatBytes(stats.size), status: "ok" });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n── Results ───────────────────────────────────────────────────");
  for (const r of results) {
    const icon = r.status === "ok" ? "✓" : "✗";
    console.log(`   ${icon} ${r.filename.padEnd(35)} ${r.size.padStart(8)}`);
    if (r.status === "ok") {
      console.log(`     → ${r.url}`);
    }
  }

  const ok     = results.filter(r => r.status === "ok").length;
  const failed = results.filter(r => r.status === "error").length;

  console.log(`\n   Total uploaded: ${ok}/${files.length} (${formatBytes(totalBytes)})`);

  if (failed > 0) {
    console.error(`\n❌  ${failed} file(s) failed. Fix errors above and re-run.`);
    process.exit(1);
  }

  console.log("\n── Next Steps ────────────────────────────────────────────────");
  console.log("   1. Open the homepage and confirm all videos autoplay from Supabase CDN");
  console.log("   2. Confirm /showcase/*.mp4 returns 410 in the browser");
  console.log("   3. Once verified, delete /public/showcase/*.mp4 from the repo");
  console.log("   4. Deploy to Vercel\n");
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
