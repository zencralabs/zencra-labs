/**
 * POST /api/media/upload
 *
 * Accepts a multipart/form-data upload with a single "file" field.
 * Automatically:
 *  - Images  → compressed with sharp (WebP, max 1920px, quality 82)
 *  - Videos  → stored as-is (compress your videos with HandBrake or ffmpeg locally before uploading)
 *
 * Returns: { success: true, url: string, path: string, originalBytes, compressedBytes, compressionRatio }
 *
 * Prerequisites:
 *   npm install sharp
 *   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage (from your admin/upload page):
 *   const form = new FormData();
 *   form.append("file", file);
 *   form.append("bucket", "media");          // optional, defaults to "media"
 *   form.append("folder", "showcase");       // optional subfolder
 *   const res = await fetch("/api/media/upload", { method: "POST", body: form });
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { compressImage, isImageMime } from "@/lib/media/compress-image";
import { requireAuthUser } from "@/lib/supabase/server";

// ── Magic-byte video signature detection ──────────────────────────────────────
// Validates that uploaded bytes match the declared MIME type's container format.
// Rejects files where the declared video/* MIME does not match the actual bytes.

type VideoFamily = "mp4" | "webm" | "avi";

/**
 * Reads the first 12 bytes of an ArrayBuffer and returns the detected video
 * container family, or null if no known signature is found.
 *
 *   MP4 / MOV  → "ftyp" atom at bytes 4–7  (0x66 0x74 0x79 0x70)
 *   WebM / MKV → EBML magic at bytes 0–3   (0x1A 0x45 0xDF 0xA3)
 *   AVI        → RIFF at bytes 0–3 + "AVI " at bytes 8–11
 */
function detectVideoFamily(buffer: ArrayBuffer): VideoFamily | null {
  const len   = buffer.byteLength;
  const bytes = new Uint8Array(buffer, 0, Math.min(12, len));

  // WebM / MKV — EBML magic header (both formats share the same container)
  if (len >= 4 &&
      bytes[0] === 0x1A && bytes[1] === 0x45 &&
      bytes[2] === 0xDF && bytes[3] === 0xA3) {
    return "webm";
  }

  // MP4 / MOV — ISO Base Media File Format: "ftyp" box at offset 4
  if (len >= 8 &&
      bytes[4] === 0x66 && bytes[5] === 0x74 &&
      bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "mp4";
  }

  // AVI — RIFF container: "RIFF" at 0–3 and "AVI " at 8–11
  if (len >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x41 && bytes[9] === 0x56 && bytes[10] === 0x49 && bytes[11] === 0x20) {
    return "avi";
  }

  return null;
}

/** MIME types accepted per detected container family */
const VIDEO_FAMILY_MIMES: Record<VideoFamily, readonly string[]> = {
  mp4:  ["video/mp4", "video/quicktime"],
  webm: ["video/webm", "video/x-matroska"],
  avi:  ["video/avi", "video/x-msvideo"],
};

// ── Supabase admin client (uses service role key — server only) ───────────────
function getSupabaseAdmin() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB input limit
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB input limit

/** Explicit allowlist — callers cannot upload to arbitrary buckets */
const ALLOWED_BUCKETS = new Set(["media", "showcase"]);

export async function POST(req: NextRequest) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const { authError } = await requireAuthUser(req);
  if (authError) return authError;

  try {
    const form   = await req.formData();
    const file   = form.get("file") as File | null;
    const bucket = (form.get("bucket") as string | null) ?? "media";

    // ── Bucket allowlist ──────────────────────────────────────────────────
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ success: false, error: `Invalid bucket. Allowed: ${[...ALLOWED_BUCKETS].join(", ")}` }, { status: 400 });
    }
    const folder = (form.get("folder") as string | null) ?? "";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const mime      = file.type || "application/octet-stream";
    const isImage   = isImageMime(mime);
    const isVideo   = mime.startsWith("video/");
    const maxBytes  = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (file.size > maxBytes) {
      return NextResponse.json({
        success: false,
        error: `File too large. Max ${isVideo ? "500 MB" : "20 MB"}.`,
      }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();

    // ── Magic-byte validation for video uploads ─────────────────────────────
    // file.type is attacker-controlled (declared in multipart Content-Type).
    // We verify the actual bytes match the claimed container format before
    // any storage write occurs.
    if (isVideo) {
      const detectedFamily = detectVideoFamily(arrayBuffer);

      if (detectedFamily === null) {
        return NextResponse.json(
          {
            success: false,
            error:   "File content does not match a supported video format. " +
                     "Supported containers: MP4, MOV, WebM, MKV, AVI.",
          },
          { status: 415 },
        );
      }

      const acceptedMimes = VIDEO_FAMILY_MIMES[detectedFamily];
      if (!acceptedMimes.includes(mime)) {
        return NextResponse.json(
          {
            success: false,
            error:   `Declared MIME type "${mime}" does not match the detected ` +
                     `file format (${detectedFamily.toUpperCase()} container). ` +
                     `Please upload a valid ${detectedFamily.toUpperCase()} file.`,
          },
          { status: 415 },
        );
      }
    }

    const supabase    = getSupabaseAdmin();

    let uploadBuffer: Buffer;
    let uploadMime: string;
    let ext: string;
    let originalBytes  = file.size;
    let compressedBytes: number;
    let compressionRatio: string;

    if (isImage) {
      // ── Compress image with sharp ───────────────────────────────────────────
      const result = await compressImage(arrayBuffer, {
        format: "webp",
        quality: 82,
        maxWidthPx: 1920,
      });
      uploadBuffer     = result.buffer;
      uploadMime       = result.mimeType;
      ext              = result.ext;
      originalBytes    = result.originalBytes;
      compressedBytes  = result.compressedBytes;
      compressionRatio = result.compressionRatio;
    } else {
      // ── Videos / other files — upload as-is ────────────────────────────────
      uploadBuffer     = Buffer.from(arrayBuffer);
      uploadMime       = mime;
      ext              = (file.name.split(".").pop() ?? "bin").toLowerCase();
      compressedBytes  = file.size;
      compressionRatio = "0%";
    }

    // ── Build storage path ────────────────────────────────────────────────────
    const timestamp = Date.now();
    const baseName  = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    const fileName  = `${baseName}-${timestamp}.${ext}`;
    const storagePath = folder ? `${folder}/${fileName}` : fileName;

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, uploadBuffer, {
        contentType: uploadMime,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("[media/upload] Supabase upload error:", uploadError);
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    // ── Get public URL ────────────────────────────────────────────────────────
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    console.log(`[media/upload] ✓ ${storagePath} | ${originalBytes} → ${compressedBytes} bytes (${compressionRatio} saved)`);

    return NextResponse.json({
      success:          true,
      url:              publicUrl,
      path:             storagePath,
      bucket,
      originalBytes,
      compressedBytes,
      compressionRatio,
      wasCompressed:    isImage,
    });

  } catch (err) {
    console.error("[media/upload] Unexpected error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    }, { status: 500 });
  }
}
