// ─────────────────────────────────────────────────────────────────────────────
// Zencra Video Studio — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type FrameMode =
  | "text_to_video"
  | "start_frame"
  | "start_end"
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
}
