// POST /api/lipsync/upload/face
// Accepts a face/portrait image, validates it, uploads to Supabase storage,
// creates an asset record, and returns the asset ID + signed URL.

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin }   from "@/lib/supabase/admin";
import { validateFaceImage, mimeToExt } from "@/lib/lipsync/validation";

export const maxDuration = 60;

const BUCKET = "lipsync";
const SIGNED_URL_EXPIRES = 3600; // 1 hour — enough time for provider processing

export async function POST(req: Request) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  try {
    // ── 2. Parse multipart ──────────────────────────────────────────────────
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided — include 'file' in FormData" },
        { status: 400 }
      );
    }

    // ── 3. Validate ─────────────────────────────────────────────────────────
    const validation = validateFaceImage({ type: file.type, size: file.size });
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 422 }
      );
    }

    // ── 4. Ensure storage bucket exists ─────────────────────────────────────
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
    }).catch(() => { /* bucket already exists — ignore */ });

    // ── 5. Upload to Supabase storage ───────────────────────────────────────
    const assetId     = crypto.randomUUID();
    const ext         = mimeToExt(file.type);
    const storagePath = `users/${user.id}/lipsync/source-face/${assetId}.${ext}`;
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

    // ── 6. Generate a signed URL (private bucket) ───────────────────────────
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRES);

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        { success: false, error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    // ── 7. Create asset record ──────────────────────────────────────────────
    const { data: asset, error: assetError } = await supabaseAdmin
      .from("assets")
      .insert({
        id:               assetId,
        user_id:          user.id,
        asset_type:       "image",
        storage_path:     storagePath,
        public_url:       signedData.signedUrl,
        mime_type:        file.type,
        file_size_bytes:  file.size,
        source:           "upload",
        visibility:       "private",
      })
      .select("id, storage_path, public_url, mime_type, file_size_bytes")
      .single();

    if (assetError) {
      return NextResponse.json(
        { success: false, error: assetError.message },
        { status: 500 }
      );
    }

    // ── 8. Respond ──────────────────────────────────────────────────────────
    return NextResponse.json({
      success:       true,
      assetId:       asset.id,
      url:           asset.public_url,
      storagePath:   asset.storage_path,
      mimeType:      asset.mime_type,
      fileSizeBytes: asset.file_size_bytes,
    });
  } catch (err) {
    console.error("[lipsync/upload/face]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Upload error" },
      { status: 500 }
    );
  }
}
