// ─────────────────────────────────────────────────────────────────────────────
// Pack Prompt Builder — buildPackPrompt()
//
// Constructs structured prompt arrays for each pack type.
// Structure is always:
//   1. Base identity string (from appearance + style signatures)
//   2. Identity lock anchor (MANDATORY — injected before any variation)
//   3. Pack-specific variation instruction
//
// The identity lock anchor is NEVER omitted for pack types.
// It is NOT injected for initial 'generate' jobs (no identity exists yet).
// ─────────────────────────────────────────────────────────────────────────────

import type { InfluencerContext, PackPromptItem, PackType } from "./types";

// ── Identity lock anchor (injected into every pack prompt) ────────────────────
// This is the backbone of consistency. Automatic. Invisible to user.
const IDENTITY_ANCHOR =
  "Same person. Same face. Same identity. Do not change facial structure, skin tone, age, or identity.";

// ── Build base identity string from context ───────────────────────────────────
function buildBaseIdentity(ctx: InfluencerContext): string {
  const { profile, identity_lock } = ctx;
  const a = identity_lock.appearance_signature;
  const s = identity_lock.style_signature;

  const parts: string[] = [];

  // Gender + age
  if (a.gender) parts.push(a.gender);
  if (a.age_range) parts.push(`aged ${a.age_range}`);

  // Skin + face
  if (a.skin_tone) parts.push(`${a.skin_tone} skin tone`);
  if (a.face_structure) parts.push(`${a.face_structure} face structure`);

  // Style
  if (s.realism_level) parts.push(s.realism_level);
  if (s.fashion_style) parts.push(`${s.fashion_style} aesthetic`);

  // Appearance notes (raw user input — appended last as modifier)
  if (profile.appearance_notes) parts.push(profile.appearance_notes);

  return parts.join(", ");
}

// ── Assemble full prompt: base → anchor → variation ──────────────────────────
function prompt(base: string, variation: string): string {
  return `${base}. ${IDENTITY_ANCHOR} ${variation}`;
}

// ── Pack builders ─────────────────────────────────────────────────────────────

function buildIdentitySheetPrompts(
  base: string,
  canonicalUrl: string,
): PackPromptItem[] {
  // Identity Sheet: strict 5-angle pose set, studio-controlled environment.
  // No outfit variation. No environment variety. Identity only.
  const studioBase = `${base}, clean white seamless studio backdrop, professional lighting`;
  return [
    {
      label: "Front — Full Body",
      prompt: prompt(studioBase, "standing directly facing camera, full body, neutral expression, arms relaxed, even lighting"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "3/4 Angle",
      prompt: prompt(studioBase, "three-quarter turn facing camera, upper body, slight shoulder angle, soft directional light"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Profile",
      prompt: prompt(studioBase, "exact 90-degree side profile view, full body, clean edge lighting"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Back View",
      prompt: prompt(studioBase, "rear view, full body, same studio setting, over-shoulder glance optional"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Close-Up Portrait",
      prompt: prompt(studioBase, "tight face portrait, sharp detail, catchlights visible, no cropping at chin"),
      aspectRatio: "1:1",
      referenceUrl: canonicalUrl,
    },
  ];
}

function buildLookPackPrompts(
  base: string,
  ctx: InfluencerContext,
  canonicalUrl: string,
): PackPromptItem[] {
  // Look Pack: outfit variations. Face and body locked via reference URL.
  // Environment is neutral — outfit is the variable.
  const { style_signature } = ctx.identity_lock;
  const platformHint = style_signature.platform_intent?.includes("Instagram")
    ? "Instagram-ready"
    : style_signature.platform_intent?.includes("TikTok")
    ? "TikTok-ready"
    : "content-ready";

  return [
    {
      label: "Casual",
      prompt: prompt(base, `casual everyday outfit, relaxed natural setting, ${platformHint}, upper body to full body`),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Editorial",
      prompt: prompt(base, "high-fashion editorial look, dramatic lighting, strong pose, magazine quality"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Streetwear",
      prompt: prompt(base, "contemporary streetwear aesthetic, urban setting, confident stance, raw energy"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Formal",
      prompt: prompt(base, "tailored formal attire, refined professional setting, polished composition"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
  ];
}

function buildScenePackPrompts(
  base: string,
  canonicalUrl: string,
): PackPromptItem[] {
  // Scene Pack: environment changes. Identity preserved via reference.
  // Face and outfit remain consistent — background is the variable.
  return [
    {
      label: "Urban — Golden Hour",
      prompt: prompt(base, "urban city backdrop, golden hour warm light, bokeh background, city energy"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Clean Studio",
      prompt: prompt(base, "clean professional studio setup, neutral backdrop, controlled lighting, commercial quality"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Natural Outdoor",
      prompt: prompt(base, "outdoor natural setting, soft diffused daylight, organic environment, relaxed mood"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Luxury Interior",
      prompt: prompt(base, "modern luxury interior space, ambient warm lighting, architectural detail, premium feel"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
  ];
}

function buildPosePackPrompts(
  base: string,
  canonicalUrl: string,
): PackPromptItem[] {
  // Pose Pack: body position and movement variety. Neutral studio or clean environment.
  return [
    {
      label: "Power Stand",
      prompt: prompt(base, "confident standing pose, shoulders back, arms relaxed at sides, direct eye contact, studio"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Seated — Relaxed",
      prompt: prompt(base, "natural seated pose, lifestyle setting, relaxed body language, candid feel"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Dynamic — Movement",
      prompt: prompt(base, "dynamic movement pose, mid-motion energy, fashion editorial feel, slight motion blur"),
      aspectRatio: "2:3",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Upper Body — Close",
      prompt: prompt(base, "upper body composition, engaging camera, intimate framing, strong eye contact"),
      aspectRatio: "4:5",
      referenceUrl: canonicalUrl,
    },
  ];
}

function buildSocialPackPrompts(
  base: string,
  canonicalUrl: string,
): PackPromptItem[] {
  // Social Pack: format-specific outputs ready for platform posting.
  // Aspect ratio is the primary variable — composition adapts per format.
  return [
    {
      label: "Story — 9:16",
      prompt: prompt(base, "vertical format composition, full body or upper body, optimized for stories and reels, platform-ready"),
      aspectRatio: "9:16",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Post — 1:1",
      prompt: prompt(base, "square format composition, centered, clean background, feed-ready, high visual impact"),
      aspectRatio: "1:1",
      referenceUrl: canonicalUrl,
    },
    {
      label: "Banner — 16:9",
      prompt: prompt(base, "horizontal banner composition, rule of thirds, YouTube or header format, wide aspect"),
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

  switch (pack_type) {
    case "identity-sheet": return buildIdentitySheetPrompts(base, canonicalUrl);
    case "look-pack":      return buildLookPackPrompts(base, ctx, canonicalUrl);
    case "scene-pack":     return buildScenePackPrompts(base, canonicalUrl);
    case "pose-pack":      return buildPosePackPrompts(base, canonicalUrl);
    case "social-pack":    return buildSocialPackPrompts(base, canonicalUrl);
  }
}

// ── Initial generation prompt (no identity anchor — used for candidate creation) ──

export function buildGenerationPrompt(
  profile: InfluencerContext["profile"],
): string {
  const parts: string[] = [];

  if (profile.gender) parts.push(profile.gender);
  if (profile.age_range) parts.push(`aged ${profile.age_range}`);
  if (profile.skin_tone) parts.push(`${profile.skin_tone} skin tone`);
  if (profile.face_structure) parts.push(`${profile.face_structure} face structure`);
  if (profile.fashion_style) parts.push(`${profile.fashion_style} aesthetic`);
  if (profile.realism_level) parts.push(profile.realism_level);
  if (profile.mood.length > 0) parts.push(profile.mood.join(", "));
  if (profile.appearance_notes) parts.push(profile.appearance_notes);

  return [
    parts.join(", "),
    "portrait photography, studio lighting, sharp focus, professional quality",
  ].join(". ");
}
