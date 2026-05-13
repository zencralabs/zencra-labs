/**
 * POST /api/studio/lipsync/upload
 *
 * Accepts a video or audio file for Studio Lip Sync.
 * Uploads to the "lipsync" private Supabase bucket and returns a 2-hour signed URL.
 * The signed URL is passed directly to fal-ai/sync-lipsync/v3 as video_url / audio_url.
 *
 * FormData fields:
 *   file     — the file blob
 *   fileType — "video" | "audio"
 *
 * Response:
 *   200 { success: true, url: "https://...", fileName: "...", fileSizeBytes: N }
 *   400 BAD_REQUEST
 *   401 UNAUTHORIZED
 *   413 FILE_TOO_LARGE
 *   422 INVALID_FILE_TYPE
 *   502 STORAGE_ERROR
 */

import type { NextRequest }   from "next/server";
import { requireAuthUser }    from "@/lib/supabase/server";
import { checkLipsyncUploadRateLimit } from "@/lib/security/rate-limit";
import { supabaseAdmin }      from "@/lib/supabase/admin";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 120; // large video uploads can take a while

const BUCKET             = "lipsync";
const SIGNED_URL_EXPIRES = 7200; // 2 hours — enough for fal.ai to download + process

const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/avi",
  "video/x-matroska",
  "video/x-msvideo",
]);

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "audio/ogg",
  "audio/webm",
]);

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_AUDIO_BYTES =  50 * 1024 * 1024; //  50 MB

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "video/mp4":          "mp4",
    "video/quicktime":    "mov",
    "video/webm":         "webm",
    "video/avi":          "avi",
    "video/x-matroska":   "mkv",
    "video/x-msvideo":    "avi",
    "audio/mpeg":         "mp3",
    "audio/mp3":          "mp3",
    "audio/wav":          "wav",
    "audio/x-wav":        "wav",
    "audio/mp4":          "m4a",
    "audio/aac":          "aac",
    "audio/flac":         "flac",
    "audio/ogg":          "ogg",
    "audio/webm":         "webm",
  };
  return map[mime] ?? "bin";
}

export async function POST(req: NextRequest): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError ?? Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const userId = user!.id;

  // ── S3-E-2: Upload rate limit — 10 lipsync uploads/hr per user ────────────
  const uploadRateLimitError = await checkLipsyncUploadRateLimit(userId);
  if (uploadRateLimitError) return uploadRateLimitError;

  // ── Parse multipart ─────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const file     = formData.get("file");
  const fileType = String(formData.get("fileType") ?? "").toLowerCase() as "video" | "audio";

  if (!file || !(file instanceof Blob)) {
    return Response.json({ success: false, error: "Missing 'file' field in FormData" }, { status: 400 });
  }
  if (fileType !== "video" && fileType !== "audio") {
    return Response.json({ success: false, error: "Missing 'fileType' field — must be 'video' or 'audio'" }, { status: 400 });
  }

  // ── Validate MIME + size ────────────────────────────────────────────────────
  const isVideo     = fileType === "video";
  const allowedMime = isVideo ? ALLOWED_VIDEO_MIME : ALLOWED_AUDIO_MIME;
  const maxBytes    = isVideo ? MAX_VIDEO_BYTES     : MAX_AUDIO_BYTES;

  if (!allowedMime.has(file.type)) {
    const allowed = isVideo
      ? "MP4, MOV, WebM, AVI, MKV"
      : "MP3, WAV, AAC, FLAC, OGG, M4A";
    return Response.json(
      { success: false, error: `File type '${file.type}' not allowed. Use: ${allowed}` },
      { status: 422 }
    );
  }

  if (file.size > maxBytes) {
    return Response.json(
      { success: false, error: `File exceeds the ${isVideo ? "500 MB" : "50 MB"} limit.` },
      { status: 413 }
    );
  }

  // ── Ensure bucket exists ────────────────────────────────────────────────────
  await supabaseAdmin.storage
    .createBucket(BUCKET, { public: false, fileSizeLimit: MAX_VIDEO_BYTES })
    .catch(() => { /* already exists */ });

  // ── Upload to storage ───────────────────────────────────────────────────────
  const uuid         = crypto.randomUUID();
  const ext          = mimeToExt(file.type);
  const folder       = isVideo ? "studio-video" : "studio-audio";
  const storagePath  = `users/${userId}/lipsync/${folder}/${uuid}.${ext}`;
  const arrayBuffer  = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType:  file.type,
      cacheControl: "3600",
      upsert:       false,
    });

  if (uploadError) {
    console.error("[studio/lipsync/upload] storage upload failed:", uploadError.message);
    return Response.json({ success: false, error: "Storage upload failed." }, { status: 502 });
  }

  // ── Create signed URL (2 hours — fal.ai downloads during processing) ────────
  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES);

  if (signError || !signedData?.signedUrl) {
    console.error("[studio/lipsync/upload] signed URL failed:", signError?.message);
    return Response.json({ success: false, error: "Failed to generate download URL." }, { status: 502 });
  }

  return Response.json({
    success:       true,
    url:           signedData.signedUrl,
    storagePath,
    fileSizeBytes: file.size,
    mimeType:      file.type,
  });
}
