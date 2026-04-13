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

export async function POST(req: NextRequest) {
  try {
    const form   = await req.formData();
    const file   = form.get("file") as File | null;
    const bucket = (form.get("bucket") as string | null) ?? "media";
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
