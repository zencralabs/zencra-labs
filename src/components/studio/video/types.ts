// ─────────────────────────────────────────────────────────────────────────────
// Zencra Video Studio — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type FrameMode =
  | "text_to_video"
  | "start_frame"   // Image Reference — Start Frame always shown; End Frame shown conditionally
                    // when model.capabilities.endFrame is true. No separate "start_end" mode.
  | "extend"
  | "lip_sync"
  | "motion_control";

export type VideoAR = "16:9" | "9:16" | "1:1";
export type Quality = "std" | "pro";
export type CamPreset =
  | null
  | "down_back"
  | "forward_up"
  | "right_turn_forward"
  | "left_turn_forward";

export interface ImageSlot {
  url: string | null;
  preview: string | null;
  name?: string;
}

export interface AudioSlot {
  url: string | null;
  name?: string;
  duration?: number; // seconds
}

export const EMPTY_SLOT: ImageSlot = { url: null, preview: null };
export const EMPTY_AUDIO: AudioSlot = { url: null };

export type VideoStatus = "generating" | "polling" | "done" | "error";

export interface GeneratedVideo {
  id: string;
  url: string | null;
  thumbnailUrl?: string | null;
  prompt: string;
  negPrompt: string;
  modelId: string;
  modelName: string;
  duration: number;
  aspectRatio: string;
  frameMode: FrameMode;
  status: VideoStatus;
  error?: string;
  taskId?: string;
  provider?: string;
  creditsUsed: number;
  createdAt: number;
  isPublic: boolean;
  is_favorite?: boolean;
  // ── Zencra Voice Engine — voiceover pipeline ─────────────────────────────────
  // Populated after video polling succeeds when audioMode === "voiceover".
  // voiceoverStatus is undefined until voiceover is triggered.
  voiceoverScript?: string;
  voiceoverStatus?: "generating" | "ready" | "error";
  voiceoverUrl?: string | null;
  // ── Scene Audio — request tracking + adaptive fallback ──────────────────────
  // audioMode captures which audio mode was active when this video was created.
  // sceneAudioFallback is true when sound_generation timed out and the job was
  // re-dispatched without audio. Together they drive the canvas status badge.
  audioMode?: "none" | "scene" | "voiceover";
  sceneAudioFallback?: boolean;
  // ── Server-side audio detection ──────────────────────────────────────────────
  // Populated on first terminal poll by the server-side MP4 binary scanner.
  // true  = audio track confirmed present with samples
  // false = no audio track or all samples empty (e.g. Kling without Sound Gen pack)
  // null  = detection inconclusive (parse error, or job not yet mirrored)
  // undefined = not yet received from server (still polling)
  audioDetected?: boolean | null;
  // Derived convenience: the final audio source for gallery badges.
  // "scene"     = scene audio detected in video
  // "voiceover" = voiceover pipeline attached
  // "none"      = audioMode was "none" or detection returned false
  // "unknown"   = audioDetected is null (inconclusive)
  audioSource?: "scene" | "voiceover" | "none" | "unknown";
}
