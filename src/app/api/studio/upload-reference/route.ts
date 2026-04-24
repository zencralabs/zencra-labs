/**
 * POST /api/studio/upload-reference
 *
 * Accepts a single image file (multipart/form-data, field name "file"),
 * uploads it to Supabase Storage under temp/refs/{userId}/{uuid}.{ext},
 * and returns the public CDN URL.
 *
 * This URL can then be passed as `imageUrl` in generation requests so
 * that backend providers (running in Node.js) can actually fetch the image.
 * Blob URLs (blob:http://...) are browser-only and cannot be used here.
 *
 * Max file size: 10 MB.
 * Accepted MIME types: image/jpeg, image/png, image/webp, image/gif.
 *
 * Response:
 *   200 { success: true, url: "https://..." }
 *   400 BAD_REQUEST — missing/invalid file
 *   401 UNAUTHORIZED
 *   413 FILE_TOO_LARGE
 *   502 STORAGE_ERROR
 */

import { requireAuthUser }              from "@/lib/supabase/server";
import { supabaseAdmin }               from "@/lib/supabase/admin";
import { checkUploadReferenceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES   = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const BUCKET      = "generations";

export async function POST(req: Request): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Rate limit ─────────────────────────────────────────────────────────────────
  const rateLimitError = await checkUploadReferenceRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  // ── Parse multipart form ──────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ success: false, error: "Missing file field" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return Response.json(
      { success: false, error: `File type ${file.type} not allowed. Use JPEG, PNG, WebP, or GIF.` },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { success: false, error: "File exceeds the 10 MB limit." },
      { status: 413 }
    );
  }

  // ── Build storage path ────────────────────────────────────────────────────────
  const ext  = file.type.split("/")[1].replace("jpeg", "jpg");
  const uuid = crypto.randomUUID();
  const path = `temp/refs/${userId}/${uuid}.${ext}`;

  // ── Upload to Supabase Storage ─────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType:  file.type,
      cacheControl: "3600",
      upsert:       false,
    });

  if (uploadError) {
    console.error("[upload-reference] storage upload failed:", uploadError.message);
    return Response.json(
      { success: false, error: "Storage upload failed." },
      { status: 502 }
    );
  }

  // ── Get public URL ─────────────────────────────────────────────────────────────
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return Response.json({ success: true, url: publicUrl });
}
