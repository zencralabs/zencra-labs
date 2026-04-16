// ─────────────────────────────────────────────────────────────────────────────
// Lip Sync — Input Validation
// Used in both API routes (server) and optionally in the frontend hook.
// ─────────────────────────────────────────────────────────────────────────────

export const ALLOWED_FACE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_AUDIO_MIME_TYPES = ["audio/mpeg", "audio/wav"] as const;
export const FACE_MAX_BYTES = 20 * 1024 * 1024;   // 20 MB
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;  // 50 MB
export const AUDIO_MIN_SECONDS = 3;
export const AUDIO_MAX_SECONDS = 30;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Validate a face image file before upload */
export function validateFaceImage(file: {
  type: string;
  size: number;
}): ValidationResult {
  if (!(ALLOWED_FACE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { valid: false, error: "Image must be JPG, PNG, or WebP" };
  }
  if (file.size > FACE_MAX_BYTES) {
    return { valid: false, error: "Image must be under 20 MB" };
  }
  return { valid: true };
}

/** Validate an audio file before upload */
export function validateAudioFile(file: {
  type: string;
  size: number;
}): ValidationResult {
  if (!(ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { valid: false, error: "Audio must be MP3 or WAV" };
  }
  if (file.size > AUDIO_MAX_BYTES) {
    return { valid: false, error: "Audio must be under 50 MB" };
  }
  return { valid: true };
}

/** Validate audio duration — called after the file is decoded */
export function validateAudioDuration(durationSeconds: number): ValidationResult {
  if (durationSeconds < AUDIO_MIN_SECONDS) {
    return {
      valid: false,
      error: `Audio must be at least ${AUDIO_MIN_SECONDS} seconds`,
    };
  }
  if (durationSeconds > AUDIO_MAX_SECONDS) {
    return {
      valid: false,
      error: `Audio must be ${AUDIO_MAX_SECONDS} seconds or shorter`,
    };
  }
  return { valid: true };
}

/** Extension from MIME type */
export function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png":  return "png";
    case "image/webp": return "webp";
    case "audio/mpeg": return "mp3";
    case "audio/wav":  return "wav";
    default:           return "bin";
  }
}
