// POST /api/lipsync/upload/audio
// Accepts an MP3/WAV audio file, validates type/size, uploads to Supabase storage,
// creates an asset record, and returns the asset ID + signed URL.
//
// Duration validation (3–30s) happens client-side before upload, and is
// re-validated server-side in /api/lipsync/create using the stored duration.
// Send the decoded duration as a JSON field `duration_seconds` in FormData.

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }   from "@/lib/supabase/admin";
import {
  validateAudioFile,
  validateAudioDuration,
  mimeToExt,
} from "@/lib/lipsync/validation";

export const maxDuration = 60;

const BUCKET = "lipsync";
const SIGNED_URL_EXPIRES = 3600;

export async function POST(req: Request) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  try {
    // ── 2. Parse multipart ──────────────────────────────────────────────────
    const formData        = await req.formData();
    const file            = formData.get("file") as File | null;
    const durationRaw     = formData.get("duration_seconds");
    const durationSeconds = durationRaw ? parseFloat(String(durationRaw)) : NaN;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided — include 'file' in FormData" },
        { status: 400 }
      );
    }

    // ── 3. Validate file type/size ──────────────────────────────────────────
    const fileVal = validateAudioFile({ type: file.type, size: file.size });
    if (!fileVal.valid) {
      return NextResponse.json(
        { success: false, error: fileVal.error },
        { status: 422 }
      );
    }

    // ── 4. Validate duration (if provided) ─────────────────────────────────
    if (!isNaN(durationSeconds)) {
      const durVal = validateAudioDuration(durationSeconds);
      if (!durVal.valid) {
        return NextResponse.json(
          { success: false, error: durVal.error },
          { status: 422 }
        );
      }
    }

    // ── 5. Ensure bucket exists ─────────────────────────────────────────────
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
    }).catch(() => { /* already exists */ });

    // ── 6. Upload to storage ────────────────────────────────────────────────
    const assetId     = crypto.randomUUID();
    const ext         = mimeToExt(file.type);
    const storagePath = `users/${user.id}/lipsync/source-audio/${assetId}.${ext}`;
    const bytes       = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // ── 7. Generate signed URL ──────────────────────────────────────────────
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRES);

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { success: false, error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    // ── 8. Create asset record ──────────────────────────────────────────────
    const { data: asset, error: assetError } = await supabaseAdmin
      .from("assets")
      .insert({
        id:               assetId,
        user_id:          user.id,
        asset_type:       "audio",
        storage_path:     storagePath,
        public_url:       signedData.signedUrl,
        mime_type:        file.type,
        file_size_bytes:  file.size,
        duration_seconds: isNaN(durationSeconds) ? null : durationSeconds,
        source:           "upload",
        visibility:       "private",
      })
      .select("id, storage_path, public_url, mime_type, file_size_bytes, duration_seconds")
      .single();

    if (assetError) {
      return NextResponse.json(
        { success: false, error: assetError.message },
        { status: 500 }
      );
    }

    // ── 9. Respond ──────────────────────────────────────────────────────────
    return NextResponse.json({
      success:         true,
      assetId:         asset.id,
      url:             asset.public_url,
      storagePath:     asset.storage_path,
      mimeType:        asset.mime_type,
      fileSizeBytes:   asset.file_size_bytes,
      durationSeconds: asset.duration_seconds,
    });
  } catch (err) {
    console.error("[lipsync/upload/audio]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload error" },
      { status: 500 }
    );
  }
}
