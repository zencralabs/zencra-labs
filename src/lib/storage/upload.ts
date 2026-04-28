/**
 * Storage Upload Helpers
 *
 * Server-side utilities for mirroring provider-generated assets to Supabase
 * Storage so the gallery never depends on expiring third-party CDN URLs.
 *
 * All helpers are non-fatal: on failure they log the error and return the
 * original URL as a fallback so the caller can still resolve the asset.
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE STORAGE CLIENT (service-role, no session persistence needed)
// ─────────────────────────────────────────────────────────────────────────────

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO MIRROR — Kling (and future async video providers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download a video from an external CDN URL and upload it to Supabase Storage.
 *
 * Target bucket : generated-assets   (must be public)
 * Storage path  : videos/{assetId}.mp4
 *
 * Returns the permanent Supabase public URL on success.
 * Returns the original externalUrl on any failure (non-fatal fallback).
 *
 * @param externalUrl  The provider CDN URL (e.g. Kling temporary URL)
 * @param assetId      The Zencra asset UUID — used as the filename
 */
export async function mirrorVideoToStorage(
  externalUrl: string,
  assetId:     string,
): Promise<string> {
  const BUCKET      = "generated-assets";
  const storagePath = `videos/${assetId}.mp4`;

  try {
    // 1. Download from provider CDN
    const res = await fetch(externalUrl, {
      signal: AbortSignal.timeout(120_000), // 2-minute download window
    });

    if (!res.ok) {
      throw new Error(`Download failed: HTTP ${res.status} from ${externalUrl}`);
    }

    const buffer      = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "video/mp4";

    console.log(
      `[mirrorVideoToStorage] downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB` +
      ` for asset=${assetId}`
    );

    // 2. Upload to Supabase Storage
    const storage = getStorageClient();

    const { error } = await storage.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // 3. Get permanent public URL
    const { data } = storage.storage.from(BUCKET).getPublicUrl(storagePath);

    console.log(`[mirrorVideoToStorage] mirrored Kling video → ${data.publicUrl}`);
    return data.publicUrl;

  } catch (err) {
    // Non-fatal: log and fall back to the original provider URL.
    // The asset will still resolve in the gallery — it just won't be permanent.
    console.error(
      `[mirrorVideoToStorage] failed for asset=${assetId}, falling back to original URL:`,
      err instanceof Error ? err.message : String(err),
    );
    return externalUrl;
  }
}
