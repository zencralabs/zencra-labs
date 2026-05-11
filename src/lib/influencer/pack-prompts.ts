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
    renderingBase:       "photorealistic portrait, Sony A7R V with 85mm f/1.4 prime lens, natural skin pores and microtexture, shallow depth of field, subtle natural facial asymmetry, genuine human presence",
    shading:             "realistic three-point lighting, subsurface scattering on skin, natural shadow rolloff, golden hour or softbox studio light, catchlight in eyes",
    texture:             "visible skin pores, individual hair strands, fabric weave detail, natural complexion variation, no artificial smoothing",
    poseLanguage:        "natural human body language, real-world poses, candid or editorial stance, authentic creator energy",
    environmentLanguage: "real-world locations, natural ambient light or professional studio, authentic environments, lived-in atmosphere",
    outfitLanguage:      "contemporary real-world fashion, authentic fabric and material detail, luxury or streetwear aesthetic",
  },
  "3d-animation": {
    renderingBase:       "3D animation render, Pixar-quality CGI, smooth stylized textures, expressive proportions",
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

// ─────────────────────────────────────────────────────────────────────────────
// composeInfluencerPrompt — Hidden Cinematic Prompt Composer
//
// Converts all builder signals into a single cinematic prompt for
// fal-ai/instant-character. Called once per candidate during initial
// casting generation (pre-lock).
//
// Design rules:
//   - No cross-style contradictions (anime ≠ photorealistic, pixel ≠ subsurface scattering)
//   - Candidate index drives persona energy — same style DNA, subtle personality shift
//   - Appearance notes always last (highest user override priority)
//   - Negative prompt is static — kept internal, never surfaced to UI
//   - image_url is NOT sent for initial casting (Option A). Reference image is only
//     used post-lock during pack generation via buildPackPrompt() + referenceUrl.
// ─────────────────────────────────────────────────────────────────────────────

// ── Compose input / output ────────────────────────────────────────────────────

export interface ComposeInfluencerPromptInput {
  profile:           AIInfluencerProfile;
  styleCategory:     StyleCategory;
  rosterTags:        string[];
  candidateIndex:    number;   // 0-based
  candidateCount:    number;
  // Mixed/Blended heritage — 2–4 region keys from the UI blend chip selector.
  // When present and length >= 2, overrides the simple "mixed-ethnicity" descriptor
  // with an authentic blended-heritage instruction.
  mixedBlendRegions?: string[];
}

export interface ComposedInfluencerPrompt {
  prompt:         string;
  negativePrompt: string;
}

// ── Negative prompt — standard quality guard ──────────────────────────────────
// Internal only. Never shown to user or stored in UI state.
// v2: added oversmoothing, artificial symmetry, wax-figure, and stock-photo blockers
// to help break out of the generic "AI face" aesthetic.
const NEGATIVE_PROMPT =
  "blurry, low quality, distorted face, extra limbs, duplicate face, bad anatomy, " +
  "deformed hands, watermark, text, logo, oversaturated, plastic skin, waxy skin, " +
  "airbrushed skin, oversmoothed skin, synthetic looking, wax figure, perfect symmetry, " +
  "artificial face, stock photo, generic AI face, uncanny valley, harsh compression artifacts, " +
  "multiple people, crowd, collage, grid, split screen, out of focus eyes";

// ── Style-aware quality suffix ────────────────────────────────────────────────
// Each category gets quality language that belongs to its visual world.
// No photorealistic language on anime. No cel-shading on hyper-real.
// v2 hyper-real: added eye catchlight, skin microtexture, and anti-plastic language
const STYLE_QUALITY_SUFFIX: Record<StyleCategory, string> = {
  "hyper-real":       "tack-sharp focus on eyes, natural lens bokeh, catchlight in eyes, genuine skin microtexture, visible skin pores, premium editorial photography quality, no artificial skin smoothing, true-to-life color grading",
  "3d-animation":     "high-end 3D render quality, smooth surface detail, cinematic character lighting, Pixar-quality surface shading",
  "anime-manga":      "clean crisp line art, vibrant flat color palette, high-quality anime illustration, sharp edges, no blurring",
  "fine-art":         "masterful painting technique, rich tonal depth, museum-quality composition, painterly brushwork, classical craft",
  "game-concept":     "high-detail character concept art, cinematic rim lighting, professional game art quality, sharp material rendering",
  "physical-texture": "sharp material detail, professional craft photography, tactile surface quality, clean diffused light",
  "retro-pixel":      "clean pixel grid, sharp hard edges, consistent retro color palette, no anti-aliasing, crisp sprite edges",
};

// ── Candidate casting variants — 4 persona directions per style ───────────────
// Creates CASTING DIVERSITY: same creative direction, different personality energy.
// Candidates should feel like 4 options in a real casting session — not random strangers.
const CANDIDATE_VARIANTS: Record<StyleCategory, string[]> = {
  "hyper-real": [
    // Casting direction A — editorial powerhouse: strong gaze, couture energy, the face you stop scrolling for
    "direct commanding gaze into lens, editorial fashion energy, confident jaw set, high-fashion posture, natural brow definition, premium lifestyle context",
    // Casting direction B — warm lifestyle creator: genuine smile lines, relatable human energy, candid warmth
    "natural open expression, genuine smile reaching eyes, crow's feet and laugh lines present, authentic approachable creator warmth, off-duty lifestyle presence",
    // Casting direction C — cinematic moody portrait: low-key light, artistic depth, film-quality atmosphere
    "cinematic 3/4 angle, dramatic shadow falloff, contemplative inward expression, artistic moody atmosphere, film-quality atmospheric depth, subtle catch light in eyes",
    // Casting direction D — high-energy creator: expressive personality, dynamic aliveness, platform-native energy
    "expressive animated face, mid-laugh or candid animated expression, creator-native energy, vibrant personality, dynamic head angle, eyes alive with personality",
  ],
  "3d-animation": [
    "bold expressive character design, confident hero pose, strong eye contact",
    "friendly approachable character, warm inviting smile, gentle personality",
    "mysterious dramatic lighting, artistic moody atmosphere, intense expression",
    "energetic dynamic pose, playful expression, vibrant animated personality",
  ],
  "anime-manga": [
    "cool composed expression, sharp editorial gaze, strong character presence",
    "warm friendly expression, soft expressive eyes, approachable anime charm",
    "dramatic emotional intensity, atmospheric lighting, artistic depth",
    "energetic expressive pose, vibrant dynamic personality, bold character energy",
  ],
  "fine-art": [
    "classical composed portrait, dignified presence, strong artistic gaze",
    "soft contemplative expression, warm painterly mood, gentle inner light",
    "dramatic chiaroscuro portrait, intense emotional expression, deep shadows",
    "lively animated subject, rich color energy, expressive character vitality",
  ],
  "game-concept": [
    "heroic commanding stance, powerful presence, battle-ready energy",
    "wise enigmatic expression, thoughtful depth, mysterious character gravity",
    "intense dramatic pose, cinematic tension, high-stakes atmospheric energy",
    "agile dynamic character, fluid movement energy, explosive presence",
  ],
  "physical-texture": [
    "posed with quiet confidence, clean craft composition, strong character presence",
    "warm expressive character, charming handmade quality, gentle personality",
    "artistically dramatic placement, material depth, moody craft atmosphere",
    "playful dynamic arrangement, tactile energy, expressive character movement",
  ],
  "retro-pixel": [
    "hero character sprite, confident pose, commanding pixel presence",
    "friendly approachable design, warm pixel expression, inviting energy",
    "mysterious rogue character, dramatic pixel lighting, cool atmospheric energy",
    "energetic action sprite, dynamic pixel motion, vibrant explosive color",
  ],
};

// ── Platform intent → composition language ────────────────────────────────────
function resolvePlatformLanguage(platform_intent: string[]): string {
  if (platform_intent.includes("Instagram"))
    return "Instagram-ready creator portrait, content-optimized composition";
  if (platform_intent.includes("TikTok"))
    return "TikTok-native creator presence, vertical-format composition";
  if (platform_intent.includes("YouTube"))
    return "YouTube creator presence, thumbnail-ready composition";
  if (platform_intent.includes("LinkedIn"))
    return "professional creator presence, editorial composition";
  if (platform_intent.length > 0)
    return "social media creator composition, content-ready framing";
  return "";
}

// ── Ethnicity/Region → prompt descriptor ─────────────────────────────────────
// Maps the structured region key to a natural-language facial genetics phrase.
// Injected AFTER base identity traits, BEFORE fashion/mood (genetic first).
// These are descriptive, not stereotyping — they guide facial bone structure,
// skin tone behavior, and hair texture in the rendering model.
const ETHNICITY_PROMPT_MAP: Record<string, string> = {
  "south-asian-indian":  "South Asian Indian heritage, warm golden-brown complexion, dark expressive eyes",
  "south-asian-other":   "South Asian heritage, warm olive complexion, expressive dark eyes",
  "east-asian":          "East Asian heritage, smooth porcelain complexion, refined almond-shaped eyes",
  "southeast-asian":     "Southeast Asian heritage, warm caramel complexion, bright almond eyes",
  "african":             "African heritage, rich deep melanin complexion, strong defined features",
  "african-american":    "African American heritage, rich melanin complexion, sculpted features",
  "european":            "European heritage, light to medium complexion, varied eye color",
  "scandinavian":        "Scandinavian heritage, fair porcelain complexion, light eyes, strong Nordic features",
  "mediterranean":       "Mediterranean heritage, warm olive complexion, dark hair, expressive features",
  "latin-american":      "Latin American heritage, warm mixed complexion, dark expressive eyes",
  "brazilian":           "Brazilian heritage, warm sun-kissed complexion, rich dark hair",
  "middle-eastern":      "Middle Eastern heritage, warm olive complexion, deep dark eyes, defined facial structure",
  "mixed-ethnicity":     "mixed heritage, uniquely blended features, warm neutral complexion",
};

// Region label map used to build human-readable blend strings
const REGION_LABELS: Record<string, string> = {
  "south-asian-indian":  "South Asian Indian",
  "south-asian-other":   "South Asian",
  "east-asian":          "East Asian",
  "southeast-asian":     "Southeast Asian",
  "african":             "African",
  "african-american":    "African American",
  "european":            "European",
  "scandinavian":        "Scandinavian",
  "mediterranean":       "Mediterranean",
  "latin-american":      "Latin American",
  "brazilian":           "Brazilian",
  "middle-eastern":      "Middle Eastern",
};

function resolveEthnicityDescriptor(
  ethnicity_region: string | null | undefined,
  mixedBlendRegions?: string[],
): string | null {
  if (!ethnicity_region) return null;
  const key = ethnicity_region.toLowerCase().trim();

  // ── Mixed/Blended with real region selection ──────────────────────────────
  if (key === "mixed-ethnicity" && mixedBlendRegions && mixedBlendRegions.length >= 2) {
    const labels = mixedBlendRegions
      .map(r => REGION_LABELS[r] ?? r)
      .slice(0, 4); // cap at 4

    // Build the and-list: "A and B", "A, B, and C", "A, B, C, and D"
    let regionList: string;
    if (labels.length === 2) {
      regionList = `${labels[0]} and ${labels[1]}`;
    } else {
      regionList = labels.slice(0, -1).join(", ") + `, and ${labels[labels.length - 1]}`;
    }

    return (
      `mixed heritage facial genetics blending ${regionList} features naturally, ` +
      `authentic human ancestry, no stereotype, subtle believable genetic blend, ` +
      `warm neutral complexion that reflects diverse heritage`
    );
  }

  // ── Single region or mixed with no selections (fallback to Auto) ──────────
  if (key === "mixed-ethnicity") {
    // Mixed selected but fewer than 2 blend regions chosen — fall back to Auto
    return null;
  }

  return ETHNICITY_PROMPT_MAP[key] ?? null;
}

// ── Gender → structural anatomy descriptor ────────────────────────────────────
// A single bare word ("Male") is too weak to override diffusion model priors.
// These inject full anatomical structure so the model renders actual biological
// sex differences — jaw shape, brow ridge, facial proportions — not just style.
// Digital humans must read as the correct gender immediately.
const GENDER_DESCRIPTOR: Record<string, string> = {
  "Male":
    "male, masculine facial structure, strong jawline, masculine brow ridge, " +
    "male facial proportions, broad forehead, defined masculine bone structure",
  "Female":
    "female, feminine facial structure, soft rounded jawline, feminine brow arch, " +
    "feminine facial proportions, delicate bone structure",
  "Non-binary":
    "androgynous facial features, gender-neutral face structure, balanced facial proportions",
  "Androgynous":
    "androgynous facial features, gender-neutral face structure, balanced facial proportions",
};

// ── Main composer ─────────────────────────────────────────────────────────────

export function composeInfluencerPrompt({
  profile,
  styleCategory,
  rosterTags,
  candidateIndex,
  candidateCount: _candidateCount,
  mixedBlendRegions,
}: ComposeInfluencerPromptInput): ComposedInfluencerPrompt {
  const style    = STYLE_CATALOGUE[styleCategory];
  const variants = CANDIDATE_VARIANTS[styleCategory];
  // Clamp index — safe for 1×, 2×, 3× candidate counts
  const variant  = variants[candidateIndex % variants.length];

  const parts: string[] = [];

  // 1. Rendering base — establishes the entire visual world (style-aware)
  //    This leads every prompt. The category decides the language — no contradictions.
  parts.push(style.renderingBase);

  // 2. Identity traits — gender uses full structural anatomy descriptors.
  //    A bare "Male" token is too weak to override the model's female-face prior.
  //    Structural descriptors (jaw shape, brow ridge, bone structure) give the
  //    model explicit anatomical targets — gender reads correctly from first render.
  if (profile.gender) {
    const genderDescriptor = GENDER_DESCRIPTOR[profile.gender] ?? profile.gender;
    parts.push(genderDescriptor);
  }
  if (profile.age_range)  parts.push(`aged ${profile.age_range}`);

  // 2a. Ethnicity/Region — facial genetics descriptor (after age, before skin override)
  //     Only injected when selected; appearance_notes can still override specifics.
  const ethnicityDesc = resolveEthnicityDescriptor(profile.ethnicity_region, mixedBlendRegions);
  if (ethnicityDesc) parts.push(ethnicityDesc);

  // 2b. Hyper-real naturalness block — injected only for hyper-real style.
  //     Pushes the model away from the "AI face" aesthetic toward genuine human imperfection.
  //     Placed after ethnicity (which sets bone structure) and before skin/face overrides.
  if (styleCategory === "hyper-real") {
    parts.push(
      "natural human imperfections, subtle facial asymmetry, genuine pore texture, " +
      "authentic complexion variation, real skin depth, no artificial smoothing, " +
      "true human face — not a render, not a composite"
    );
  }

  // Skin tone + face structure — most meaningful for realism-adjacent styles,
  // harmless for stylized ones (anime/pixel artists can still apply these)
  if (profile.skin_tone)      parts.push(`${profile.skin_tone} skin tone`);
  if (profile.face_structure) parts.push(`${profile.face_structure} face structure`);

  // 3. Fashion + mood
  if (profile.fashion_style)   parts.push(`${profile.fashion_style} aesthetic`);
  if (profile.mood.length > 0) parts.push(profile.mood.join(", "));

  // 4. Platform composition language
  const platformLang = resolvePlatformLanguage(profile.platform_intent);
  if (platformLang) parts.push(platformLang);

  // 5. Roster tags → creative direction context
  //    e.g. ["Fashion", "Luxury"] → "Fashion, Luxury creator"
  if (rosterTags.length > 0) {
    parts.push(`${rosterTags.join(", ")} creator`);
  }

  // 6. Appearance notes — user-written direction, always last (highest override priority)
  if (profile.appearance_notes) parts.push(profile.appearance_notes);

  // 7. Style-aware quality suffix — no contradictory rendering terms
  parts.push(STYLE_QUALITY_SUFFIX[styleCategory]);

  // 8. Candidate casting direction — subtle persona energy variation
  //    Same style DNA, different personality. Casting options, not random strangers.
  parts.push(variant);

  return {
    prompt:         parts.join(", "),
    negativePrompt: NEGATIVE_PROMPT,
  };
}
