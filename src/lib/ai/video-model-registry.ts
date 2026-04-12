/**
 * Zencra Video Model Registry
 *
 * Single source of truth for all video model capabilities.
 * The frontend renders controls from this registry.
 * The backend validates requests against it.
 * No capability logic should live outside this file.
 */

// ── Camera control ────────────────────────────────────────────────────────────

export type CameraPreset =
  | "simple"
  | "down_back"
  | "forward_up"
  | "right_turn_forward"
  | "left_turn_forward";

export type CameraConfig = {
  horizontal?: number; // pan   -10 to 10
  vertical?: number;   // tilt  -10 to 10
  zoom?: number;       //       -10 to 10
  tilt?: number;
  pan?: number;
  roll?: number;
};

export type CameraControl = {
  type: CameraPreset;
  config?: CameraConfig; // only used when type === "simple"
};

export const CAMERA_PRESET_LABELS: Record<CameraPreset, string> = {
  simple:             "Custom",
  down_back:          "Pull Back",
  forward_up:         "Push In",
  right_turn_forward: "Arc Right",
  left_turn_forward:  "Arc Left",
};

// ── Operation types ───────────────────────────────────────────────────────────

export type VideoOperationType =
  | "text_to_video"
  | "image_to_video"
  | "start_frame"        // i2v with start frame only
  | "start_end_frame"    // i2v with start + end frame
  | "motion_control"     // reference image + motion video
  | "multi_element"      // multiple element images
  | "extend_video"       // extend a previously generated video
  | "lip_sync"           // sync audio to existing video face
  | "avatar"             // AI avatar speaking video
  | "reference_video";   // reference-driven video

// ── Model capability flags ────────────────────────────────────────────────────

export type VideoModelCapabilities = {
  textToVideo:    boolean;
  imageToVideo:   boolean;
  startFrame:     boolean;   // I2V with single start frame
  endFrame:       boolean;   // I2V with start + end frame (image_tail)
  cameraControl:  boolean;
  motionControl:  boolean;   // requires reference video + character image
  multiElement:   boolean;
  extendVideo:    boolean;
  lipSync:        boolean;
  avatar:         boolean;
  audioEnabled:   boolean;
  negativePrompt: boolean;
  proMode:        boolean;   // supports mode: "pro"
  seedControl:    boolean;
  durations:      number[];
  aspectRatios:   string[];
  cameraPresets:  CameraPreset[];
};

// ── Full model definition ─────────────────────────────────────────────────────

export type VideoModel = {
  id:             string; // catalog ID, e.g. "kling-30"
  provider:       "kling" | "seedance" | "runway" | "heygen" | "veo" | "ltx";
  apiModelId:     string; // value sent to provider API, e.g. "kling-v3"
  displayName:    string;
  description:    string;
  badge?:         string | null;
  badgeColor?:    string | null;
  available:      boolean;
  comingSoon:     boolean;
  capabilities:   VideoModelCapabilities;
  creditMultiplier?: number;
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const VIDEO_MODEL_REGISTRY: VideoModel[] = [
  // ── Kling 3.0 ────────────────────────────────────────────────────────────
  {
    id:          "kling-30",
    provider:    "kling",
    apiModelId:  "kling-v3",
    displayName: "Kling 3.0",
    description: "Flagship cinematic model — best motion quality and realism",
    badge:       "HOT",
    badgeColor:  "#DC2626",
    available:   true,
    comingSoon:  false,
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       true,
      cameraControl:  true,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    true,
      lipSync:        true,
      avatar:         false,
      audioEnabled:   false,
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  ["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
    },
  },

  // ── Kling 2.6 ────────────────────────────────────────────────────────────
  {
    id:          "kling-26",
    provider:    "kling",
    apiModelId:  "kling-v2-6",
    displayName: "Kling 2.6",
    description: "Enhanced scene coherence and character fidelity",
    badge:       null,
    badgeColor:  null,
    available:   true,
    comingSoon:  false,
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       true,
      cameraControl:  true,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    true,
      lipSync:        true,
      avatar:         false,
      audioEnabled:   false,
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  ["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
    },
  },

  // ── Kling 2.5 ────────────────────────────────────────────────────────────
  {
    id:          "kling-25",
    provider:    "kling",
    apiModelId:  "kling-v2-5",
    displayName: "Kling 2.5",
    description: "Fast and reliable — great for quick iterations",
    badge:       null,
    badgeColor:  null,
    available:   true,
    comingSoon:  false,
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       false, // v2.5 does not support end frame
      cameraControl:  true,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    false,
      lipSync:        false,
      avatar:         false,
      audioEnabled:   false,
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  ["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
    },
  },

  // ── Seedance 2.0 (coming soon) ───────────────────────────────────────────
  {
    id:          "seedance",
    provider:    "seedance",
    apiModelId:  "seedance-v2",
    displayName: "Seedance 2.0",
    description: "Specialist in human motion, dance, and character performance",
    badge:       "SOON",
    badgeColor:  "#92400e",
    available:   false,
    comingSoon:  true,
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     false,
      endFrame:       false,
      cameraControl:  false,
      motionControl:  true,
      multiElement:   false,
      extendVideo:    false,
      lipSync:        false,
      avatar:         false,
      audioEnabled:   false,
      negativePrompt: true,
      proMode:        false,
      seedControl:    false,
      durations:      [5, 10],
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
    },
  },
];

// ── Helper functions ──────────────────────────────────────────────────────────

export function getVideoModel(id: string): VideoModel | undefined {
  return VIDEO_MODEL_REGISTRY.find(m => m.id === id);
}

export function getAvailableModels(): VideoModel[] {
  return VIDEO_MODEL_REGISTRY.filter(m => m.available);
}

export function getModelsForOperation(op: VideoOperationType): VideoModel[] {
  return VIDEO_MODEL_REGISTRY.filter(m => {
    if (!m.available) return false;
    const c = m.capabilities;
    switch (op) {
      case "text_to_video":   return c.textToVideo;
      case "image_to_video":  return c.imageToVideo;
      case "start_frame":     return c.startFrame;
      case "start_end_frame": return c.endFrame;
      case "motion_control":  return c.motionControl;
      case "multi_element":   return c.multiElement;
      case "extend_video":    return c.extendVideo;
      case "lip_sync":        return c.lipSync;
      case "avatar":          return c.avatar;
      case "reference_video": return c.imageToVideo;
      default:                return false;
    }
  });
}

export function modelSupports(
  modelId: string,
  feature: keyof VideoModelCapabilities,
): boolean {
  const model = getVideoModel(modelId);
  if (!model) return false;
  const val = model.capabilities[feature];
  if (typeof val === "boolean") return val;
  if (Array.isArray(val)) return val.length > 0;
  return false;
}
