/**
 * Server-side image compression using sharp.
 * Run: npm install sharp
 * Used in /api/media/upload to auto-compress before Supabase storage.
 */

import sharp from "sharp";

export interface CompressImageOptions {
  maxWidthPx?: number;   // resize if wider — default 1920
  quality?: number;      // 1–100, default 82
  format?: "webp" | "jpeg" | "png" | "avif";
}

export interface CompressImageResult {
  buffer: Buffer;
  mimeType: string;
  ext: string;
  originalBytes: number;
  compressedBytes: number;
  compressionRatio: string; // e.g. "68%"
}

/**
 * Compress an image buffer. Returns the compressed buffer + metadata.
 * Defaults: WebP at quality 82, max 1920px wide — great balance of quality + size.
 */
export async function compressImage(
  input: Buffer | ArrayBuffer,
  options: CompressImageOptions = {}
): Promise<CompressImageResult> {
  const {
    maxWidthPx = 1920,
    quality = 82,
    format = "webp",
  } = options;

  const src = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const originalBytes = src.byteLength;

  let pipeline = sharp(src).rotate(); // auto-rotate from EXIF

  // Resize only if wider than maxWidthPx — preserves aspect ratio
  pipeline = pipeline.resize({ width: maxWidthPx, withoutEnlargement: true });

  let compressed: Buffer;
  let mimeType: string;
  let ext: string;

  switch (format) {
    case "avif":
      compressed = await pipeline.avif({ quality, effort: 4 }).toBuffer();
      mimeType = "image/avif";
      ext = "avif";
      break;
    case "jpeg":
      compressed = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      mimeType = "image/jpeg";
      ext = "jpg";
      break;
    case "png":
      compressed = await pipeline.png({ quality, compressionLevel: 8 }).toBuffer();
      mimeType = "image/png";
      ext = "png";
      break;
    case "webp":
    default:
      compressed = await pipeline.webp({ quality, effort: 4 }).toBuffer();
      mimeType = "image/webp";
      ext = "webp";
  }

  const compressedBytes = compressed.byteLength;
  const compressionRatio = `${Math.round((1 - compressedBytes / originalBytes) * 100)}%`;

  return { buffer: compressed, mimeType, ext, originalBytes, compressedBytes, compressionRatio };
}

/**
 * Quick check: is this file an image by mime type?
 */
export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

/**
 * Quick check: is this file a video by mime type?
 */
export function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}
