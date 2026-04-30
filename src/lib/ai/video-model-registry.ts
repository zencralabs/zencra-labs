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
  startFrame:     boolean;   // I2V with single start frame (unified into start_end mode)
  endFrame:       boolean;   // I2V with start + end frame (image_tail) — if false, end slot is disabled
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
  // ── Optional capability-driven display fields ──────────────────────────────
  resolutions?:   string[];  // e.g. ["480p","720p"] — if present, shown as pill row in left rail
  frameRate?:     number;    // e.g. 24 — if present, shown as read-only info label (not a control)
};

// ── Full model definition ─────────────────────────────────────────────────────

export type VideoModel = {
  id:             string; // catalog ID, e.g. "kling-30"
  provider:       "kling" | "seedance" | "runway" | "heygen" | "veo" | "sora" | "luma" | "minimax" | "wan" | "grok";
  apiModelId:     string; // value sent to provider API, e.g. "kling-v3"
  displayName:    string;
  description:    string;
  badge?:         string | null;
  badgeColor?:    string | null;
  lipSyncProvider?: string | null; // null = Coming Soon; set to "heygen" | "elevenlabs" when wired
  available:      boolean;
  comingSoon:     boolean;
  capabilities:   VideoModelCapabilities;
  creditMultiplier?:  number;
  supportsSequence?:  boolean;   // Sequence Mode (shot stack) — only Kling 3.0 and 3.0 Omni
  promptChips?:       string[];
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const VIDEO_MODEL_REGISTRY: VideoModel[] = [

  // ── Kling 3.0 ────────────────────────────────────────────────────────────
  // DEFAULT production model. Must remain first in the array — VideoStudioShell
  // uses find(m => m.available) to select the default, so array order matters.
  {
    id:          "kling-30",
    provider:    "kling",
    apiModelId:  "kling-v3",
    displayName: "Kling 3.0",
    description: "Flagship cinematic model — best motion quality and realism",
    badge:            "HOT",
    badgeColor:       "#0EA5A0",
    available:        true,
    comingSoon:       false,
    supportsSequence: true,
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
      lipSync:        false, // Lip Sync is provider-independent — controlled via LIP_SYNC_PROVIDER
      avatar:         false,
      audioEnabled:   false,
      videoInput:     true,
      nativeAudio:    true,   // Kling 3.0 supports native scene audio generation
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      maxDuration:    10,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  ["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
      resolutions:    ["720p", "1080p"],
    },
  },

  // ── Kling 3.0 Omni ───────────────────────────────────────────────────────
  // Full-capability Kling 3.0 variant — unified identity, motion, and frame control.
  //
  // STATUS: BETA — available for controlled testing. NOT the default.
  // Array position is intentionally after Kling 3.0 so find(m => m.available)
  // selects Kling 3.0 as the default session model.
  //
  // Previous issue: Kling API returned code 1201 "model is not supported" —
  // this is an account/resource-pack gate, not a code bug.
  // The provider now throws a friendly error when 1201 is received at dispatch.
  //
  // Rules:
  //   - Lip Sync NOT enabled on Omni (gated to Kling 3.0 only)
  //   - motionControl is false — Omni does not support motion control mode
  //   - Sound Generation (nativeAudio) available if resource pack is active
  //
  // To promote to production: move above Kling 3.0, change badge to "HOT" / null.
  {
    id:          "kling-30-omni",
    provider:    "kling",
    apiModelId:  process.env.KLING_MODEL_OMNI ?? "kling-v3-omni",
    displayName: "Kling 3.0 Omni",
    description: "Full-capability cinematic model — identity, motion, and frame control unified",
    badge:            "BETA",
    badgeColor:       "#8B5CF6",
    available:        true,
    comingSoon:       false,
    supportsSequence: true,
    promptChips: ["cinematic lighting", "slow motion", "aerial shot", "dramatic scene", "ultra realistic", "film grain", "smooth camera motion"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       true,
      cameraControl:  true,
      motionControl:  false,  // Omni does not support motion control
      multiElement:   false,
      extendVideo:    true,
      lipSync:        false,  // Lip Sync limited to Kling 3.0 (not Omni)
      avatar:         false,
      audioEnabled:   false,
      videoInput:     true,
      nativeAudio:    true,   // Scene Audio supported — requires Sound Generation resource pack
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      maxDuration:    10,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  ["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
      resolutions:    ["720p", "1080p"],
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
      motionControl:  false, // Motion Control requires Kling 3.0
      multiElement:   false,
      extendVideo:    true,
      lipSync:        false, // Lip Sync is provider-independent — controlled via LIP_SYNC_PROVIDER
      avatar:         false,
      audioEnabled:   false,
      videoInput:     true,
      nativeAudio:    true,  // Kling 2.6 supports native scene audio generation
      negativePrompt: true,
      proMode:        true,
      seedControl:    false,
      durations:      [5, 10],
      maxDuration:    10,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  ["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"],
      resolutions:    ["720p", "1080p"],
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
      resolutions:    ["720p", "1080p"],
    },
  },

  // ── Seedance 2.0 ─────────────────────────────────────────────────────────
  // BytePlus ModelArk API. Supports T2V, I2V, start frame, and start+end frame.
  // Resolutions: 480p, 720p. Frame rate: 24 fps. Duration: 4–15s (safe discrete: 5, 8, 10).
  // Model ID env-configurable via SEEDANCE_MODEL_ID.
  {
    id:          "seedance-20",
    provider:    "seedance",
    apiModelId:  process.env.SEEDANCE_MODEL_ID ?? "dreamina-seedance-2-0-260128",
    displayName: "Seedance 2.0",
    description: "High-quality cinematic video — text/image to video, first+last frame support.",
    badge:       "NEW",
    badgeColor:  "#A855F7",
    available:   true,
    comingSoon:  false,
    promptChips: ["cinematic lighting", "character performance", "storyboard style", "motion dynamics", "dramatic arc"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       true,   // BytePlus docs: first + last frame workflow supported
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
      durations:      [5, 10],       // Safe confirmed discrete values (API validated)
      maxDuration:    10,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
      resolutions:    ["480p", "720p"],
      frameRate:      24,
    },
  },

  // ── Seedance 2.0 Fast ────────────────────────────────────────────────────
  // Fast-turbo variant of Seedance 2.0 for rapid iteration.
  // Resolutions: 480p, 720p. Frame rate: 24 fps. Safe discrete durations: 5s, 10s.
  // Model ID env-configurable via SEEDANCE_FAST_MODEL_ID.
  {
    id:          "seedance-20-fast",
    provider:    "seedance",
    apiModelId:  process.env.SEEDANCE_FAST_MODEL_ID ?? "dreamina-seedance-2-0-fast-260128",
    displayName: "Seedance 2.0 Fast",
    description: "Rapid generation variant of Seedance 2.0 — first+last frame support.",
    badge:       "FAST",
    badgeColor:  "#10B981",
    available:   true,
    comingSoon:  false,
    promptChips: ["quick draft", "storyboard", "cinematic style", "motion test"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       true,   // BytePlus docs: first + last frame workflow supported
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
      durations:      [5, 10],       // Safe confirmed discrete values
      maxDuration:    10,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
      resolutions:    ["480p", "720p"],
      frameRate:      24,
    },
  },

  // ── Seedance 1.5 Pro ─────────────────────────────────────────────────────
  // BytePlus ModelArk API. Supports T2V, first-frame, and first+last-frame.
  // Resolutions: 480p, 720p, 1080p. Frame rate: 24 fps. Durations: 4s, 8s, 12s only.
  // Model ID env-configurable via SEEDANCE_15_MODEL_ID — NO default (requires explicit config).
  // If model ID is missing (empty string), the studio shows a "Not Configured" screen.
  {
    id:          "seedance-15",
    provider:    "seedance",
    apiModelId:  process.env.SEEDANCE_15_MODEL_ID ?? "",  // Empty = not configured — DO NOT add a default
    displayName: "Seedance 1.5 Pro",
    description: "1080p capable — text/image to video, first+last frame, 4–12s range.",
    badge:       null,
    badgeColor:  null,
    available:   true,
    comingSoon:  false,
    promptChips: ["cinematic style", "character close-up", "storyboard scene", "dramatic lighting"],
    capabilities: {
      textToVideo:    true,
      imageToVideo:   true,
      startFrame:     true,
      endFrame:       true,   // BytePlus docs: first + last frame workflow supported
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
      durations:      [4, 8, 12],    // Confirmed discrete values for 1.5 Pro — do NOT add others
      maxDuration:    12,
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
      resolutions:    ["480p", "720p", "1080p"],  // 1.5 Pro supports 1080p per BytePlus docs
      frameRate:      24,
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
    displayName: "Ray Flash 2",
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

  // ── MiniMax Hailuo 2.3 (Coming Soon) ─────────────────────────────────────
  {
    id:          "minimax-hailuo-23",
    provider:    "minimax",
    apiModelId:  "hailuo-2.3",
    displayName: "Hailuo 2.3",
    description: "MiniMax flagship — cinematic quality with strong motion fidelity",
    badge:       "SOON",
    badgeColor:  "#8B5CF6",
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
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
    },
  },

  // ── MiniMax Hailuo 2.3 Fast (Coming Soon) ────────────────────────────────
  {
    id:          "minimax-hailuo-23-fast",
    provider:    "minimax",
    apiModelId:  "hailuo-2.3-fast",
    displayName: "Hailuo 2.3 Fast",
    description: "Fast-turbo variant of Hailuo 2.3 for rapid creative iteration",
    badge:       "SOON",
    badgeColor:  "#8B5CF6",
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
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
    },
  },

  // ── MiniMax Hailuo 02 (Coming Soon) ──────────────────────────────────────
  {
    id:          "minimax-hailuo-02",
    provider:    "minimax",
    apiModelId:  "hailuo-02",
    displayName: "Hailuo 02",
    description: "MiniMax Hailuo generation 2 — consistent characters and scene depth",
    badge:       "SOON",
    badgeColor:  "#8B5CF6",
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
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
    },
  },

  // ── Wan 2.7 (Coming Soon) ─────────────────────────────────────────────────
  {
    id:          "wan-27",
    provider:    "wan",
    apiModelId:  "wan-2.7",
    displayName: "Wan 2.7",
    description: "Alibaba's open-source cinematic video model — strong T2V and I2V",
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
      aspectRatios:   ["16:9", "9:16", "1:1"],
      cameraPresets:  [],
    },
  },

  // ── Grok Imagine (Coming Soon) ────────────────────────────────────────────
  {
    id:          "grok-imagine",
    provider:    "grok",
    apiModelId:  "grok-imagine",
    displayName: "Grok Imagine",
    description: "xAI's video generation model — real-world grounded and physics-aware",
    badge:       "SOON",
    badgeColor:  "#F59E0B",
    available:   false,
    comingSoon:  true,
    capabilities: {
      textToVideo:    true,
      imageToVideo:   false,
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
