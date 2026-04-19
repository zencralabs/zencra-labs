/**
 * Zencra Provider Capability Registry
 *
 * Human-readable metadata for every capability tag.
 * Used by: UI filter generation, validation messages, admin dashboards.
 *
 * All capability tags are defined in core/types.ts.
 * This file only adds display metadata — no logic.
 */

import type { CapabilityTag, StudioType } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY METADATA
// ─────────────────────────────────────────────────────────────────────────────

export interface CapabilityMeta {
  tag: CapabilityTag;
  label: string;
  description: string;
  studio: StudioType | StudioType[];
  requiresInput?: string;   // describes what input is required, if any
}

export const CAPABILITY_META: Record<CapabilityTag, CapabilityMeta> = {

  // ── Image ───────────────────────────────────────────────────────────────────
  text_to_image: {
    tag: "text_to_image",
    label: "Text to Image",
    description: "Generate images from a text prompt",
    studio: "image",
  },
  image_to_image: {
    tag: "image_to_image",
    label: "Image to Image",
    description: "Transform an existing image using a prompt",
    studio: "image",
    requiresInput: "source image",
  },
  edit: {
    tag: "edit",
    label: "Edit",
    description: "Edit specific regions or elements of an image",
    studio: ["image", "character"],
    requiresInput: "source image",
  },
  inpaint: {
    tag: "inpaint",
    label: "Inpaint",
    description: "Fill masked regions of an image with AI-generated content",
    studio: ["image", "character"],
    requiresInput: "source image + mask",
  },
  outpaint: {
    tag: "outpaint",
    label: "Outpaint",
    description: "Extend an image beyond its original boundaries",
    studio: ["image", "character"],
    requiresInput: "source image",
  },
  upscale: {
    tag: "upscale",
    label: "Upscale",
    description: "Increase image resolution with AI enhancement",
    studio: ["image", "character"],
    requiresInput: "source image",
  },
  photoreal: {
    tag: "photoreal",
    label: "Photorealistic",
    description: "Generates photorealistic outputs indistinguishable from photography",
    studio: ["image", "character"],
  },
  stylized: {
    tag: "stylized",
    label: "Stylized",
    description: "Produces stylized, artistic, or illustrated outputs",
    studio: "image",
  },
  consistency: {
    tag: "consistency",
    label: "Identity Consistency",
    description: "Maintains character or style consistency across multiple generations",
    studio: ["image", "character"],
  },
  variation: {
    tag: "variation",
    label: "Variations",
    description: "Generates multiple variations of an existing image",
    studio: "image",
    requiresInput: "source image",
  },

  // ── Video ───────────────────────────────────────────────────────────────────
  text_to_video: {
    tag: "text_to_video",
    label: "Text to Video",
    description: "Generate video from a text prompt",
    studio: "video",
  },
  image_to_video: {
    tag: "image_to_video",
    label: "Image to Video",
    description: "Animate an image into a video clip",
    studio: "video",
    requiresInput: "start image",
  },
  start_frame: {
    tag: "start_frame",
    label: "Start Frame",
    description: "Use an image as the first frame of the generated video",
    studio: "video",
    requiresInput: "start image",
  },
  end_frame: {
    tag: "end_frame",
    label: "End Frame",
    description: "Use a second image as the last frame (first + last frame workflow)",
    studio: "video",
    requiresInput: "start image + end image",
  },
  motion_control: {
    tag: "motion_control",
    label: "Motion Control",
    description: "Animate a subject using a reference motion video",
    studio: "video",
    requiresInput: "subject image + reference video",
  },
  extend: {
    tag: "extend",
    label: "Extend Video",
    description: "Extend a previously generated video clip",
    studio: "video",
    requiresInput: "source video",
  },
  cinematic: {
    tag: "cinematic",
    label: "Cinematic",
    description: "Optimized for cinematic quality and film-like output",
    studio: ["video", "fcs"],
  },
  fast_mode: {
    tag: "fast_mode",
    label: "Fast Mode",
    description: "Accelerated generation with reduced wait time",
    studio: "video",
  },
  lip_sync: {
    tag: "lip_sync",
    label: "Lip Sync",
    description: "Synchronize lip movement to an audio track",
    studio: "video",
    requiresInput: "face video + audio",
  },
  avatar: {
    tag: "avatar",
    label: "Avatar",
    description: "Generate talking-head avatar video from a script",
    studio: "video",
  },
  native_audio: {
    tag: "native_audio",
    label: "Native Audio",
    description: "Video is generated with embedded, AI-produced audio",
    studio: "video",
  },

  // ── Audio ───────────────────────────────────────────────────────────────────
  text_to_speech: {
    tag: "text_to_speech",
    label: "Text to Speech",
    description: "Convert written text to natural speech audio",
    studio: "audio",
  },
  voice_clone: {
    tag: "voice_clone",
    label: "Voice Clone",
    description: "Clone a voice from a short audio sample",
    studio: "audio",
    requiresInput: "voice sample",
  },
  dubbing: {
    tag: "dubbing",
    label: "Dubbing",
    description: "Replace dialogue in a video with AI-dubbed translation",
    studio: "audio",
    requiresInput: "source video",
  },
  translation: {
    tag: "translation",
    label: "Translation",
    description: "Translate and re-voice audio into another language",
    studio: "audio",
  },
  narration: {
    tag: "narration",
    label: "Narration",
    description: "Optimized for long-form narration and documentary-style speech",
    studio: "audio",
  },
  voice_convert: {
    tag: "voice_convert",
    label: "Voice Convert",
    description: "Transform existing audio into a different AI voice",
    studio: "audio",
    requiresInput: "source audio",
  },

  // ── Character ───────────────────────────────────────────────────────────────
  identity_creation: {
    tag: "identity_creation",
    label: "Identity Creation",
    description: "Generate a consistent digital human from a description",
    studio: "character",
  },
  identity_refinement: {
    tag: "identity_refinement",
    label: "Identity Refinement",
    description: "Edit and refine an existing character identity",
    studio: "character",
    requiresInput: "character reference",
  },
  scene_expansion: {
    tag: "scene_expansion",
    label: "Scene Expansion",
    description: "Place a character identity into a new scene or environment",
    studio: "character",
  },
  look_variation: {
    tag: "look_variation",
    label: "Look Variation",
    description: "Generate styled variations of a character identity",
    studio: "character",
  },
  motion_starter: {
    tag: "motion_starter",
    label: "Motion Starter",
    description: "Generate a short motion clip from a character image",
    studio: "character",
    requiresInput: "character image",
  },

  // ── UGC ─────────────────────────────────────────────────────────────────────
  product_to_ad: {
    tag: "product_to_ad",
    label: "Product to Ad",
    description: "Generate a UGC-style ad video from a product URL",
    studio: "ugc",
    requiresInput: "product URL",
  },
  script_to_avatar: {
    tag: "script_to_avatar",
    label: "Script to Avatar",
    description: "Generate an avatar-based video from a written script",
    studio: "ugc",
  },
  character_to_ugc: {
    tag: "character_to_ugc",
    label: "Character to UGC",
    description: "Generate UGC content using a Zencra character identity",
    studio: "ugc",
    requiresInput: "character_id",
  },

  // ── FCS ─────────────────────────────────────────────────────────────────────
  cinematic_studio: {
    tag: "cinematic_studio",
    label: "Cinematic Studio",
    description: "Full cinematic production pipeline in Future Cinema Studio",
    studio: "fcs",
  },
  long_form: {
    tag: "long_form",
    label: "Long-Form",
    description: "Supports extended duration cinematic generation",
    studio: "fcs",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** All capability tags for a given studio. */
export function getCapabilitiesForStudio(studio: StudioType): CapabilityTag[] {
  return (Object.values(CAPABILITY_META) as CapabilityMeta[])
    .filter(m => Array.isArray(m.studio) ? m.studio.includes(studio) : m.studio === studio)
    .map(m => m.tag);
}

/** Human-readable label for a capability tag. */
export function getCapabilityLabel(tag: CapabilityTag): string {
  return CAPABILITY_META[tag]?.label ?? tag;
}

/** Whether a capability tag requires a specific input asset. */
export function capabilityRequiresInput(tag: CapabilityTag): string | undefined {
  return CAPABILITY_META[tag]?.requiresInput;
}
