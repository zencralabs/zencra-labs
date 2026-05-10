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
import { detectMp4AudioTrack, type AudioDetectionResult } from "./audio-detect";

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
 * Target bucket : generations         (must be public)
 * Storage path  : videos/{assetId}.mp4
 *
 * Returns { url, audioDetected } on success.
 * Returns the original externalUrl (and audioDetected: null) on any failure (non-fatal fallback).
 *
 * @param externalUrl  The provider CDN URL (e.g. Kling temporary URL)
 * @param assetId      The Zencra asset UUID — used as the filename
 */
export interface MirrorVideoResult {
  /** Permanent Supabase public URL, or the original provider URL as fallback */
  url: string;
  /**
   * Server-side MP4 audio detection result.
   * true  = audio track present with non-empty samples
   * false = no audio track, or track is empty/stubbed
   * null  = detection inconclusive (parse error or upload failed before detection)
   */
  audioDetected: AudioDetectionResult;
}

export async function mirrorVideoToStorage(
  externalUrl: string,
  assetId:     string,
): Promise<MirrorVideoResult> {
  const BUCKET      = "generations";
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

    // ── Audio detection (zero extra I/O — buffer already in memory) ──────────
    const audioDetected = await detectMp4AudioTrack(buffer);
    console.log(`[mirrorVideoToStorage] audioDetected=${audioDetected} asset=${assetId}`);

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

    console.log(
      `✅ [mirrorVideoToStorage] Kling video persisted to Supabase.` +
      ` asset=${assetId}` +
      ` url=${data.publicUrl}` +
      ` audioDetected=${audioDetected}`
    );
    return { url: data.publicUrl, audioDetected };

  } catch (err) {
    // Non-fatal: log and fall back to the original provider URL.
    // The asset will still resolve in the gallery — it just won't be permanent.
    // ⚠️ If you see this in Vercel logs, the video will expire. Fix the bucket/network issue.
    console.warn(
      `⚠️ [mirrorVideoToStorage] Kling video NOT persisted to Supabase — using temporary provider URL.` +
      ` asset=${assetId}` +
      ` bucket=generations` +
      ` reason="${err instanceof Error ? err.message : String(err)}"` +
      ` tempUrl="${externalUrl.slice(0, 80)}..."`
    );
    return { url: externalUrl, audioDetected: null };
  }
}
