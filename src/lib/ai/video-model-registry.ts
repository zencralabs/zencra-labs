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
  audioEnabled:   boolean;   // supports audio reference input
  videoInput:     boolean;   // supports video reference input
  nativeAudio:    boolean;   // generates video with native audio
  negativePrompt: boolean;
  proMode:        boolean;   // supports mode: "pro"
  seedControl:    boolean;
  durations:      number[];
  maxDuration:    number;
  aspectRatios:   string[];
  cameraPresets:  CameraPreset[];
};

// ── Full model definition ─────────────────────────────────────────────────────

export type VideoModel = {
  id:             string; // catalog ID, e.g. "kling-30"
  provider:       "kling" | "seedance" | "runway" | "heygen" | "veo" | "sora" | "luma";
  apiModelId:     string; // value sent to provider API, e.g. "kling-v3"
  displayName:    string;
  description:    string;
  badge?:         string | null;
  badgeColor?:    string | null;
  available:      boolean;
  comingSoon:     boolean;
  capabilities:   VideoModelCapabilities;
  creditMultiplier?: number;
  promptChips?:   string[];
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
    badgeColor:  "#0EA5A0",
    available:   true,
    comingSoon:  false,
    promptChips: ["cinematic lighting", "slow motion", "aerial shot", "dramatic scene", "ultra realistic", "film grain", "smooth camera motion"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       true,
      cameraControl:  true,
      motionControl:  true,
      multiElement:   false,
      extendVideo:    true,
      lipSync:        true,
      avatar:         false,
      audioEnabled:   false,
      videoInput:     true,
      nativeAudio:    false,
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      maxDuration:    10,
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
    promptChips: ["cinematic lighting", "slow motion", "aerial shot", "dramatic scene", "ultra realistic", "film grain", "smooth camera motion"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       false, // v2.6 does not support end frame
      cameraControl:  true,
      motionControl:  true,
      multiElement:   false,
      extendVideo:    true,
      lipSync:        true,
      avatar:         false,
      audioEnabled:   false,
      videoInput:     true,
      nativeAudio:    false,
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      maxDuration:    10,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  ["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
    },
  },

  // ── Kling 2.5 ────────────────────────────────────────────────────────────
  {
    id:          "kling-25",
    provider:    "kling",
    apiModelId:  "kling-v2-5",
    displayName: "Kling 2.5 Turbo",
    description: "Fast and reliable — ideal for quick iterations",
    badge:       null,
    badgeColor:  null,
    available:   true,
    comingSoon:  false,
    promptChips: ["cinematic lighting", "slow motion", "aerial shot", "dramatic scene", "ultra realistic", "film grain", "smooth camera motion"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       true,
      cameraControl:  true,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    false,
      lipSync:        false,
      avatar:         false,
      audioEnabled:   false,
      videoInput:     false,
      nativeAudio:    false,
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      maxDuration:    10,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  ["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
    },
  },

  // ── Seedance 2.0 ─────────────────────────────────────────────────────────
  // Official materials: multimodal text/image/audio/video inputs,
  // controllable extension/editing, up to 15s multi-shot audio-video output.
  {
    id:          "seedance-20",
    provider:    "seedance",
    apiModelId:  "seedance-v2",
    displayName: "Seedance 2.0",
    description: "Multimodal AI — text, image, audio & video inputs. Up to 15s.",
    badge:       "SOON",
    badgeColor:  "#A855F7",
    available:   false,
    comingSoon:  true,
    promptChips: ["multi-shot sequence", "character performance", "storyboard style", "cinematic lighting", "motion dynamics", "dramatic arc", "audio-reactive"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     false,
      endFrame:       false,
      cameraControl:  false,
      motionControl:  true,
      multiElement:   false,
      extendVideo:    true,   // controllable extension per official spec
      lipSync:        false,
      avatar:         false,
      audioEnabled:   true,   // audio reference input per official spec
      videoInput:     true,   // video reference/editing input
      nativeAudio:    true,   // generates with native audio per official spec
      negativePrompt: true,
      proMode:        false,
      seedControl:    false,
      durations:      [5, 10, 15], // up to 15s per official spec
      maxDuration:    15,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
    },
  },

  // ── Runway Gen-4.5 (Coming Soon) ─────────────────────────────────────────
  {
    id:          "runway-gen45",
    provider:    "runway",
    apiModelId:  "gen3a_turbo",
    displayName: "Runway Gen-4.5",
    description: "Professional-grade AI video editing and generation",
    badge:       "SOON",
    badgeColor:  "#F59E0B",
    available:   false,
    comingSoon:  true,
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     false,
      endFrame:       false,
      cameraControl:  false,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    false,
      lipSync:        false,
      avatar:         false,
      audioEnabled:   false,
      videoInput:     false,
      nativeAudio:    false,
      negativePrompt: false,
      proMode:        false,
      seedControl:    false,
      durations:      [5, 10],
      maxDuration:    10,
      aspectRatios:   ["16:9", "9:16"],
      cameraPresets:  [],
    },
  },

  // ── Google Veo 3.2 (Coming Soon) ─────────────────────────────────────────
  {
    id:          "veo-32",
    provider:    "veo",
    apiModelId:  "veo-3",
    displayName: "Google Veo 3.2",
    description: "Advanced AI video with natural cinematic sound generation",
    badge:       "SOON",
    badgeColor:  "#F59E0B",
    available:   false,
    comingSoon:  true,
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     false,
      endFrame:       false,
      cameraControl:  false,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    false,
      lipSync:        false,
      avatar:         false,
      audioEnabled:   false,
      videoInput:     false,
      nativeAudio:    true,
      negativePrompt: false,
      proMode:        false,
      seedControl:    false,
      durations:      [5, 8],
      maxDuration:    8,
      aspectRatios:   ["16:9", "9:16"],
      cameraPresets:  [],
    },
  },

  // ── Sora 2 (Coming Soon) ─────────────────────────────────────────────────
  {
    id:          "sora-2",
    provider:    "sora",
    apiModelId:  "sora-2",
    displayName: "Sora 2",
    description: "OpenAI's next-generation world-simulation video model",
    badge:       "SOON",
    badgeColor:  "#8B5CF6",
    available:   false,
    comingSoon:  true,
    promptChips: ["photorealistic", "consistent physics", "world simulation", "cinematic motion", "character animation"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     false,
      endFrame:       false,
      cameraControl:  false,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    false,
      lipSync:        false,
      avatar:         false,
      audioEnabled:   false,
      videoInput:     false,
      nativeAudio:    false,
      negativePrompt: false,
      proMode:        false,
      seedControl:    false,
      durations:      [5, 10, 20],
      maxDuration:    20,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
    },
  },

  // ── HeyGen (Coming Soon) ─────────────────────────────────────────────────
  {
    id:          "heygen",
    provider:    "heygen",
    apiModelId:  "heygen-avatar",
    displayName: "HeyGen",
    description: "AI avatar video with precise lip-sync and voice cloning",
    badge:       "SOON",
    badgeColor:  "#EC4899",
    available:   false,
    comingSoon:  true,
    capabilities: {
      textToVideo:    false,
      imageToVideo:   false,
      startFrame:     false,
      endFrame:       false,
      cameraControl:  false,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    false,
      lipSync:        true,
      avatar:         true,
      audioEnabled:   true,
      videoInput:     false,
      nativeAudio:    false,
      negativePrompt: false,
      proMode:        false,
      seedControl:    false,
      durations:      [30, 60, 120],
      maxDuration:    120,
      aspectRatios:   ["16:9", "9:16"],
      cameraPresets:  [],
    },
  },

  // ── Luma AI (Coming Soon) ─────────────────────────────────────────────────
  {
    id:          "luma",
    provider:    "luma",
    apiModelId:  "dream-machine",
    displayName: "Luma AI",
    description: "Photorealistic world-simulation video generation",
    badge:       "SOON",
    badgeColor:  "#64748B",
    available:   false,
    comingSoon:  true,
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     false,
      endFrame:       false,
      cameraControl:  false,
      motionControl:  false,
      multiElement:   false,
      extendVideo:    false,
      lipSync:        false,
      avatar:         false,
      audioEnabled:   false,
      videoInput:     false,
      nativeAudio:    false,
      negativePrompt: false,
      proMode:        false,
      seedControl:    false,
      durations:      [5],
      maxDuration:    5,
      aspectRatios:   ["16:9", "9:16"],
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

export function getAllModels(): VideoModel[] {
  return VIDEO_MODEL_REGISTRY;
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
