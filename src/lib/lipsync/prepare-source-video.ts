// ─────────────────────────────────────────────────────────────────────────────
// prepareSourceVideoFromImage
//
// Converts a portrait face image → a source MP4 video required by
// fal-ai/sync-lipsync/v3 (which takes video_url, NOT a raw image URL).
//
// Strategy (tried in order):
//   1. fal-ai/ffmpeg-api  — fal's cloud FFmpeg, no local dependencies needed
//   2. system ffmpeg      — fallback for local dev if fal-ai/ffmpeg-api fails
//
// The output is a still-image video (no motion in v1).
// Duration is matched to the audio track.
// fal-ai/sync-lipsync handles animating the lips.
// ─────────────────────────────────────────────────────────────────────────────

import { exec } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SourceVideoResult {
  /** Public or signed URL to the source MP4 — passed directly to fal sync-lipsync */
  videoUrl:        string;
  /** Duration of the video (seconds) — matches audio duration */
  durationSeconds: number;
  /** Where the video lives — "fal_cdn" | "supabase" | "local_temp" */
  storageLocation: "fal_cdn" | "supabase" | "local_temp";
}

export interface PrepareSourceVideoInput {
  /** Supabase signed URL to the uploaded face image */
  faceSignedUrl:  string;
  /** Duration of the audio track — video will match this */
  audioDuration:  number;
  /** Output aspect ratio — determines resolution */
  aspectRatio:    "9:16" | "16:9" | "1:1";
}

// ── Resolution map ────────────────────────────────────────────────────────────

function aspectRatioToResolution(ar: string): { w: number; h: number } {
  if (ar === "9:16")  return { w: 720, h: 1280 };
  if (ar === "1:1")   return { w: 720, h: 720 };
  return { w: 1280, h: 720 }; // 16:9 default
}

/**
 * Build a vf filter string that scales + pads to exact target dimensions.
 * Uses force_original_aspect_ratio + pad to avoid distortion.
 */
function scaleFilter(w: number, h: number): string {
  return (
    `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,` +
    `format=yuv420p`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Method 1 — fal-ai/ffmpeg-api (cloud FFmpeg, no local binary needed)
// ─────────────────────────────────────────────────────────────────────────────

async function uploadToFalStorage(imageBuffer: ArrayBuffer, contentType: string): Promise<string> {
  const apiKey = process.env.FAL_KEY ?? "";
  const res = await fetch("https://storage.fal.run", {
    method:  "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type":  contentType,
    },
    body: imageBuffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fal storage upload failed (${res.status}): ${text}`);
  }
  const data = await res.json() as { url: string };
  return data.url;
}

async function prepareViaFalFFmpeg(
  input: PrepareSourceVideoInput
): Promise<SourceVideoResult> {
  const apiKey = process.env.FAL_KEY ?? "";
  if (!apiKey) throw new Error("FAL_KEY not set");

  const { faceSignedUrl, audioDuration, aspectRatio } = input;
  const duration = Math.max(1, Math.ceil(audioDuration));
  const { w, h } = aspectRatioToResolution(aspectRatio);

  // Step 1 — download face image
  const imgRes = await fetch(faceSignedUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch face image: ${imgRes.status}`);
  const imgBuffer  = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const ext         = contentType.includes("png") ? "png" : "jpg";

  // Step 2 — upload to fal storage so fal-ai/ffmpeg-api can access it
  const falImageUrl = await uploadToFalStorage(imgBuffer, contentType);

  // Step 3 — submit FFmpeg job to fal queue
  const submitRes = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api", {
    method:  "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      inputs: [{ url: falImageUrl, name: `input.${ext}` }],
      commands: [{
        args: [
          "-loop",         "1",
          "-i",            `input.${ext}`,
          "-t",            String(duration),
          "-c:v",          "libx264",
          "-r",            "25",
          "-vf",           scaleFilter(w, h),
          "-movflags",     "+faststart",
          "output.mp4",
        ],
      }],
    }),
  });

  // If the endpoint doesn't exist (404), bubble up so we can try fallback
  if (submitRes.status === 404) throw new Error("fal-ai/ffmpeg-api not found");

  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    throw new Error(`fal-ai/ffmpeg-api submit failed (${submitRes.status}): ${text}`);
  }

  const submitData = await submitRes.json() as {
    request_id: string;
    response_url?: string;
  };

  const requestId   = submitData.request_id;
  const responseUrl = submitData.response_url
    ?? `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}`;

  // Step 4 — poll for completion (max 60 seconds — should only take 2–5s for a still video)
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2_000));

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}/status`,
      { headers: { "Authorization": `Key ${apiKey}` } }
    );
    const statusData = await statusRes.json() as { status: string };

    if (statusData.status === "COMPLETED") {
      const resultRes = await fetch(responseUrl, {
        headers: { "Authorization": `Key ${apiKey}` },
      });
      const result = await resultRes.json() as {
        output_files?: Array<{ url: string; name?: string }>;
      };

      const videoUrl = result.output_files?.find(f => f.name?.endsWith(".mp4") || !f.name)?.url
        ?? result.output_files?.[0]?.url;

      if (!videoUrl) throw new Error("fal-ai/ffmpeg-api returned no output file");

      return { videoUrl, durationSeconds: duration, storageLocation: "fal_cdn" };
    }

    if (statusData.status === "FAILED") {
      throw new Error("fal-ai/ffmpeg-api failed to create source video");
    }
  }

  throw new Error("fal-ai/ffmpeg-api timed out after 60 seconds");
}

// ─────────────────────────────────────────────────────────────────────────────
// Method 2 — System FFmpeg fallback (local dev + self-hosted)
// ─────────────────────────────────────────────────────────────────────────────

async function prepareViaLocalFfmpeg(
  input: PrepareSourceVideoInput
): Promise<SourceVideoResult> {
  const { faceSignedUrl, audioDuration, aspectRatio } = input;
  const duration = Math.max(1, Math.ceil(audioDuration));
  const { w, h } = aspectRatioToResolution(aspectRatio);

  // Verify ffmpeg is available
  try {
    await execAsync("ffmpeg -version", { timeout: 5_000 });
  } catch {
    throw new Error(
      "System ffmpeg not found. Options:\n" +
      "  1) Install ffmpeg: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)\n" +
      "  2) Set FAL_KEY to enable the fal-ai/ffmpeg-api cloud preprocessing."
    );
  }

  const uid     = crypto.randomUUID();
  const tmpDir  = "/tmp";
  const imgPath = join(tmpDir, `lipsync-face-${uid}.jpg`);
  const vidPath = join(tmpDir, `lipsync-video-${uid}.mp4`);

  try {
    // Download face image to /tmp
    const imgRes = await fetch(faceSignedUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch face image: ${imgRes.status}`);
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    await fs.writeFile(imgPath, imgBuf);

    // Build ffmpeg command
    const vf  = scaleFilter(w, h);
    const cmd = `ffmpeg -y -loop 1 -i "${imgPath}" -t ${duration} -c:v libx264 -r 25 -vf "${vf}" -movflags +faststart "${vidPath}"`;
    await execAsync(cmd, { timeout: 60_000 });

    // Read the video and return as base64 data URL (for dev only — not suitable for production)
    // In production, this path would upload to Supabase storage instead.
    const vidBuf   = await fs.readFile(vidPath);
    const base64   = vidBuf.toString("base64");
    const videoUrl = `data:video/mp4;base64,${base64}`;

    // NOTE: fal's queue API can typically accept data URLs but this should only
    // be used in development. In production the fal-ai/ffmpeg-api path handles this.
    return { videoUrl, durationSeconds: duration, storageLocation: "local_temp" };
  } finally {
    await fs.unlink(imgPath).catch(() => {});
    await fs.unlink(vidPath).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — tries fal first, falls back to local
// ─────────────────────────────────────────────────────────────────────────────

export async function prepareSourceVideoFromImage(
  input: PrepareSourceVideoInput
): Promise<SourceVideoResult> {
  // Try fal cloud preprocessing first (works in production without local deps)
  if (process.env.FAL_KEY) {
    try {
      return await prepareViaFalFFmpeg(input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only fall through if the endpoint doesn't exist or is unavailable
      if (
        msg.includes("not found") ||
        msg.includes("503") ||
        msg.includes("timed out")
      ) {
        console.warn("[prepare-source-video] fal-ai/ffmpeg-api unavailable, trying local ffmpeg:", msg);
      } else {
        // Config or auth error — don't silently fall through
        throw err;
      }
    }
  }

  // Fallback: local ffmpeg (dev environment)
  return await prepareViaLocalFfmpeg(input);
}
