// ─────────────────────────────────────────────────────────────────────────────
// Pack Prompt Builder — buildPackPrompt()
//
// Constructs structured prompt arrays for each pack type.
// Structure is always:
//   1. Base identity string (style rendering base + appearance traits)
//   2. Identity lock anchor (MANDATORY — injected before any variation)
//   3. Pack-specific variation instruction (style-aware per category)
//
// The identity lock anchor is NEVER omitted for pack types.
// It is NOT injected for initial 'generate' jobs (no identity exists yet).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  InfluencerContext,
  PackPromptItem,
  PackType,
  StyleCategory,
  AIInfluencerProfile,
} from "./types";

// ── Identity lock anchor (injected into every pack prompt) ────────────────────
// Automatic. Invisible to user. Backbone of consistency across all packs.
const IDENTITY_ANCHOR =
  "Same person. Same face. Same identity. Do not change facial structure, skin tone, age, or identity.";

// ── Style catalogue — rendering language per category ─────────────────────────
// Each entry defines the full visual language for that style.
// These control prompts only — never shown to the user.

interface StyleDescriptor {
  renderingBase:       string;   // Visual rendering mode — goes first in every prompt
  shading:             string;   // Lighting and shading language
  texture:             string;   // Surface and material texture language
  poseLanguage:        string;   // Body position and movement style
  environmentLanguage: string;   // Background and environment style
  outfitLanguage:      string;   // Clothing and fashion style
}

const STYLE_CATALOGUE: Record<StyleCategory, StyleDescriptor> = {
  "hyper-real": {
    renderingBase:       "photorealistic portrait, shot on Sony A7R V, 85mm f/1.4 lens, natural skin texture, shallow depth of field",
    shading:             "realistic lighting, subsurface scattering, natural shadows, golden hour or soft studio light",
    texture:             "real skin pores visible, hair strands detail, fabric weave, natural imperfections",
    poseLanguage:        "natural human body language, real-world poses, candid or editorial stance",
    environmentLanguage: "real-world locations, natural light or professional studio, authentic environments",
    outfitLanguage:      "real-world fashion, contemporary garments, authentic fabric and material detail",
  },
  "3d-animation": {
    renderingBase:       "3D animation render, Pixar-quality CGI, smooth stylized textures, expressive proportions, large eyes",
    shading:             "soft ambient occlusion, rounded form lighting, warm stylized highlights, gentle rim light",
    texture:             "smooth polished surfaces, stylized material rendering, clean geometric forms",
    poseLanguage:        "exaggerated expressive poses, animation-friendly body language, dynamic character staging",
    environmentLanguage: "stylized 3D animated environment, vibrant illustrated world, animated set design",
    outfitLanguage:      "animated character costume design, stylized fashion, clean readable silhouette",
  },
  "anime-manga": {
    renderingBase:       "anime illustration style, 2D cel-shaded, sharp clean line art, vibrant colors, Japanese animation aesthetic",
    shading:             "flat cel-shading, bold black outlines, minimal gradient, anime-style shadow blocks",
    texture:             "clean vector-like surfaces, minimal texture detail, sharp crisp edges",
    poseLanguage:        "dynamic anime poses, exaggerated expressive gestures, action-manga stance, stylized body language",
    environmentLanguage: "anime-style illustrated background, manga panel environment, vibrant stylized scenery",
    outfitLanguage:      "anime character fashion, Japanese streetwear or fantasy costume, bold design, clean linework",
  },
  "fine-art": {
    renderingBase:       "fine art oil painting, classical portrait style, museum-quality composition, master painter aesthetic",
    shading:             "chiaroscuro lighting, painterly brushstrokes, warm classical tones, Rembrandt-style light",
    texture:             "visible canvas texture, oil paint impasto, rich pigment depth, classical material rendering",
    poseLanguage:        "classical portrait pose, formal or contemplative composition, timeless gesture and expression",
    environmentLanguage: "classical interior or pastoral landscape, old-master painted setting, period-appropriate environment",
    outfitLanguage:      "period or contemporary fashion rendered in painterly style, rich fabric texture, classical drapery",
  },
  "game-concept": {
    renderingBase:       "game concept art, high-detail character illustration, cinematic lighting, fantasy or sci-fi aesthetic",
    shading:             "dramatic rim lighting, specular highlights, cinematic shadows, atmospheric depth",
    texture:             "detailed surface materials, armor texture, fabric weave, tech or magical material rendering",
    poseLanguage:        "heroic action pose, combat-ready stance, character sheet angles, dynamic power pose",
    environmentLanguage: "fantasy or sci-fi environment, atmospheric world-building, epic scale backdrop",
    outfitLanguage:      "fantasy armor and robes, sci-fi gear and technology, high-detail costume and equipment design",
  },
  "physical-texture": {
    renderingBase:       "stop-motion craft aesthetic, physical material rendering, handmade art style, tactile surface quality",
    shading:             "soft diffused light, handmade texture emphasis, material-accurate surface shading",
    texture:             "clay, wool, fabric, wood, felt — visible material grain, handcraft imperfection, tactile quality",
    poseLanguage:        "natural static poses, craft-figure proportions, handmade doll or puppet quality",
    environmentLanguage: "miniature set environment, handcrafted scene, craft-material backdrop, tactile world",
    outfitLanguage:      "fabric and textile costume, felt or knit clothing, craft-material fashion, handmade wardrobe",
  },
  "retro-pixel": {
    renderingBase:       "pixel art style, 16-bit retro game aesthetic, limited color palette, sprite character design",
    shading:             "dithering shading technique, pixel-perfect blocky shadows, hard color transitions",
    texture:             "blocky pixel grid, hard edges, simplified geometric forms, no anti-aliasing",
    poseLanguage:        "sprite-sheet pose, limited animation keyframe position, retro game character stance",
    environmentLanguage: "pixel art background, retro game tileset environment, 8-bit or 16-bit scene design",
    outfitLanguage:      "pixel art costume, retro game character fashion, simplified color-block outfit design",
  },
};

// ── Build base identity string from context ───────────────────────────────────
// Order: rendering base → appearance traits → style modifiers → notes
function buildBaseIdentity(ctx: InfluencerContext): string {
  const { profile, identity_lock } = ctx;
  const a = identity_lock.appearance_signature;
  const s = identity_lock.style_signature;

  const category = (s.category ?? "hyper-real") as StyleCategory;
  const style     = STYLE_CATALOGUE[category];

  const parts: string[] = [];

  // Rendering base LEADS — sets the entire visual language
  parts.push(style.renderingBase);

  // Gender + age
  if (a.gender)     parts.push(a.gender);
  if (a.age_range)  parts.push(`aged ${a.age_range}`);

  // Skin + face
  if (a.skin_tone)      parts.push(`${a.skin_tone} skin tone`);
  if (a.face_structure) parts.push(`${a.face_structure} face structure`);

  // Fashion style (from profile — interpreted through the category lens)
  if (s.fashion_style)  parts.push(`${s.fashion_style} aesthetic`);

  // For hyper-real only: supplement with realism level if specified
  if (category === "hyper-real" && s.realism_level) {
    parts.push(s.realism_level);
  }

  // Appearance notes (user-specified details — always last)
  if (profile.appearance_notes) parts.push(profile.appearance_notes);

  return parts.join(", ");
}

// ── Assemble full prompt: base → anchor → variation ──────────────────────────
function prompt(base: string, variation: string): string {
  return `${base}. ${IDENTITY_ANCHOR} ${variation}`;
}

// ── Pack builders (style-aware) ───────────────────────────────────────────────

function buildIdentitySheetPrompts(
  base: string,
  style: StyleDescriptor,
  canonicalUrl: string,
): PackPromptItem[] {
  // 5-angle reference sheet. Controlled environment. Identity only — no outfit variation.
  const sheetBase = `${base}, ${style.shading}, ${style.texture}`;
  return [
    {
      label: "Front — Full Body",
      prompt: prompt(sheetBase, "standing directly facing camera, full body, neutral expression, arms relaxed"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "3/4 Angle",
      prompt: prompt(sheetBase, "three-quarter turn, upper body, slight shoulder angle, soft directional light"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Profile",
      prompt: prompt(sheetBase, "exact 90-degree side profile, full body, clean edge lighting"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Back View",
      prompt: prompt(sheetBase, "rear view, full body, over-shoulder glance optional"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Close-Up Portrait",
      prompt: prompt(sheetBase, "tight face portrait, sharp detail, no chin crop, expressive"),
      aspectRatio: "1:1",
      referenceUrl: canonicalUrl,
    },
  ];
}

function buildLookPackPrompts(
  base: string,
  style: StyleDescriptor,
  ctx: InfluencerContext,
  canonicalUrl: string,
): PackPromptItem[] {
  // Outfit variations anchored to the style category's outfit language.
  const { platform_intent } = ctx.identity_lock.style_signature;
  const platformHint = platform_intent?.includes("Instagram")
    ? "Instagram-ready composition"
    : platform_intent?.includes("TikTok")
    ? "TikTok-ready framing"
    : "content-ready composition";

  return [
    {
      label: "Casual",
      prompt: prompt(base, `${style.outfitLanguage}, casual everyday look, relaxed natural setting, ${platformHint}`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Editorial",
      prompt: prompt(base, `${style.outfitLanguage}, editorial fashion look, dramatic composition, strong visual impact`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Statement",
      prompt: prompt(base, `${style.outfitLanguage}, bold statement outfit, confident pose, high visual energy`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Refined",
      prompt: prompt(base, `${style.outfitLanguage}, refined polished look, sophisticated composition, elevated aesthetic`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
  ];
}

function buildScenePackPrompts(
  base: string,
  style: StyleDescriptor,
  canonicalUrl: string,
): PackPromptItem[] {
  // Environment variations. Identity and outfit are consistent — location changes.
  return [
    {
      label: "Golden Hour",
      prompt: prompt(base, `${style.environmentLanguage}, golden hour warm light, sun-kissed atmosphere, warm ambient glow`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Clean Studio",
      prompt: prompt(base, `${style.environmentLanguage}, clean minimal backdrop, professional studio lighting, commercial quality`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Natural Setting",
      prompt: prompt(base, `${style.environmentLanguage}, natural organic environment, soft diffused light, relaxed mood`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Signature World",
      prompt: prompt(base, `${style.environmentLanguage}, signature atmospheric setting, immersive world, distinct visual identity`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
  ];
}

function buildPosePackPrompts(
  base: string,
  style: StyleDescriptor,
  canonicalUrl: string,
): PackPromptItem[] {
  // Body position variety anchored to the style's pose language.
  return [
    {
      label: "Power Stance",
      prompt: prompt(base, `${style.poseLanguage}, confident commanding pose, direct camera engagement, strong presence`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Relaxed",
      prompt: prompt(base, `${style.poseLanguage}, relaxed natural body language, candid feel, lifestyle composition`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Dynamic",
      prompt: prompt(base, `${style.poseLanguage}, dynamic movement energy, mid-motion, high visual impact`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Close — Upper Body",
      prompt: prompt(base, `${style.poseLanguage}, intimate upper body framing, strong eye contact, engaging composition`),
      aspectRatio: "4:5",
      referenceUrl: canonicalUrl,
    },
  ];
}

function buildSocialPackPrompts(
  base: string,
  style: StyleDescriptor,
  canonicalUrl: string,
): PackPromptItem[] {
  // Platform-format outputs. Aspect ratio is the primary variable — composition adapts.
  return [
    {
      label: "Story — 9:16",
      prompt: prompt(base, `${style.poseLanguage}, vertical format, full body or upper body, optimized for stories and reels, ${style.environmentLanguage}`),
      aspectRatio: "9:16",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Post — 1:1",
      prompt: prompt(base, `${style.poseLanguage}, square format, centered composition, clean high-impact framing, feed-ready`),
      aspectRatio: "1:1",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Banner — 16:9",
      prompt: prompt(base, `${style.poseLanguage}, horizontal banner composition, rule of thirds, wide cinematic framing, ${style.environmentLanguage}`),
      aspectRatio: "16:9",
      referenceUrl: canonicalUrl,
    },
  ];
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildPackPrompt(
  pack_type: PackType,
  ctx: InfluencerContext,
): PackPromptItem[] {
  const base         = buildBaseIdentity(ctx);
  const canonicalUrl = ctx.canonical_asset.url;

  // Style descriptor for this influencer's category
  const category = (ctx.identity_lock.style_signature.category ?? "hyper-real") as StyleCategory;
  const style    = STYLE_CATALOGUE[category];

  switch (pack_type) {
    case "identity-sheet": return buildIdentitySheetPrompts(base, style, canonicalUrl);
    case "look-pack":      return buildLookPackPrompts(base, style, ctx, canonicalUrl);
    case "scene-pack":     return buildScenePackPrompts(base, style, canonicalUrl);
    case "pose-pack":      return buildPosePackPrompts(base, style, canonicalUrl);
    case "social-pack":    return buildSocialPackPrompts(base, style, canonicalUrl);
  }
}

// ── Initial generation prompt (no identity anchor — pre-lock) ─────────────────
// Style category shapes the rendering language from the very first generation.

export function buildGenerationPrompt(
  profile: AIInfluencerProfile,
  style_category: StyleCategory = "hyper-real",
): string {
  const style = STYLE_CATALOGUE[style_category];

  const parts: string[] = [];

  // Rendering base leads — establishes the visual world
  parts.push(style.renderingBase);

  // Identity traits
  if (profile.gender)      parts.push(profile.gender);
  if (profile.age_range)   parts.push(`aged ${profile.age_range}`);
  if (profile.skin_tone)   parts.push(`${profile.skin_tone} skin tone`);
  if (profile.face_structure) parts.push(`${profile.face_structure} face structure`);
  if (profile.fashion_style)  parts.push(`${profile.fashion_style} aesthetic`);
  if (profile.mood.length > 0) parts.push(profile.mood.join(", "));
  if (profile.appearance_notes) parts.push(profile.appearance_notes);

  return [
    parts.join(", "),
    style.shading,
    "sharp focus, professional quality",
  ].join(". ");
}

// ── Style catalogue export (used by identity-lock.ts for signature building) ──
export { STYLE_CATALOGUE };
export type { StyleDescriptor };
