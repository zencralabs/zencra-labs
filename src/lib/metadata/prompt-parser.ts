/**
 * Prompt Parser — Deterministic Cinematic Extraction
 *
 * Extracts cinematic terms from a prompt string using inline keyword maps.
 * No AI, no external calls, no taxonomy file — pure string matching.
 *
 * Returns a partial EnrichedMetadata (only fields it can detect).
 * Undetected fields are omitted rather than filled with invented values.
 */

import type { EnrichedMetadata } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// INLINE KEYWORD MAPS
// ─────────────────────────────────────────────────────────────────────────────

/** Maps prompt keywords → lens label */
const LENS_MAP: Array<[string[], string]> = [
  [["85mm", "85 mm"],                  "85mm portrait"],
  [["50mm", "50 mm"],                  "50mm standard"],
  [["35mm", "35 mm"],                  "35mm wide"],
  [["24mm", "24 mm"],                  "24mm ultra-wide"],
  [["135mm", "135 mm"],               "135mm telephoto"],
  [["200mm", "200 mm"],               "200mm telephoto"],
  [["macro", "close-up", "closeup"],  "macro"],
  [["fisheye", "fish-eye"],           "fisheye"],
  [["wide angle", "wide-angle"],      "wide-angle"],
  [["telephoto"],                      "telephoto"],
  [["anamorphic"],                     "anamorphic"],
  [["tilt-shift", "tilt shift"],      "tilt-shift"],
  [["bokeh"],                          "portrait with bokeh"],
  [["prime lens"],                     "prime lens"],
  [["zoom lens"],                      "zoom lens"],
];

/** Maps prompt keywords → camera label */
const CAMERA_MAP: Array<[string[], string]> = [
  [["dslr", "canon eos", "nikon", "sony a7"],     "full-frame DSLR"],
  [["medium format", "hasselblad", "phase one"],  "medium format"],
  [["film", "35mm film", "analog"],               "analog film"],
  [["polaroid"],                                   "Polaroid"],
  [["iphone", "smartphone", "mobile"],            "smartphone camera"],
  [["cinematic", "cinema camera", "arri", "red camera", "blackmagic"], "cinema camera"],
  [["drone", "aerial"],                            "drone"],
  [["security camera", "cctv", "surveillance"],   "security camera"],
  [["gopro", "action camera"],                     "action camera"],
  [["webcam"],                                     "webcam"],
];

/** Maps prompt keywords → lighting label */
const LIGHTING_MAP: Array<[string[], string]> = [
  [["golden hour", "golden light"],              "golden hour"],
  [["blue hour"],                                 "blue hour"],
  [["soft light", "soft key", "soft box"],       "soft key light"],
  [["hard light", "harsh light"],                "hard light"],
  [["rim light", "backlight", "back light"],     "rim / backlight"],
  [["natural light", "sunlight", "daylight"],    "natural daylight"],
  [["neon", "neon glow", "neon lights"],         "neon lighting"],
  [["studio lighting", "studio light"],          "studio lighting"],
  [["moody lighting", "dramatic lighting"],      "dramatic moody lighting"],
  [["low key", "low-key"],                        "low-key"],
  [["high key", "high-key"],                      "high-key"],
  [["candlelight", "candle light"],              "candlelight"],
  [["fog", "foggy", "misty", "mist"],            "foggy / atmospheric"],
  [["overcast", "cloudy"],                        "overcast"],
  [["moonlight", "moonlit"],                     "moonlight"],
  [["strobe", "flash"],                           "strobe flash"],
  [["volumetric", "god rays", "light rays"],     "volumetric light"],
  [["hdr", "high dynamic range"],                "HDR"],
];

/** Maps prompt keywords → mood tags */
const MOOD_MAP: Array<[string[], string]> = [
  [["epic", "grand", "majestic"],               "epic"],
  [["moody", "brooding"],                        "moody"],
  [["dramatic"],                                  "dramatic"],
  [["ethereal", "dreamlike", "dreamy"],         "ethereal"],
  [["dark", "gloomy", "ominous", "sinister"],   "dark"],
  [["vibrant", "vivid", "colorful", "colourful"], "vibrant"],
  [["melancholic", "melancholy", "somber", "sombre"], "melancholic"],
  [["romantic", "intimate"],                     "romantic"],
  [["serene", "peaceful", "tranquil", "calm"],  "serene"],
  [["tense", "suspenseful", "thriller"],        "tense"],
  [["mysterious", "enigmatic"],                  "mysterious"],
  [["futuristic", "sci-fi", "cyberpunk"],       "futuristic"],
  [["whimsical", "fantasy", "magical"],         "whimsical"],
  [["raw", "gritty", "rough"],                  "gritty"],
  [["nostalgic", "retro", "vintage"],           "nostalgic"],
  [["surreal", "abstract", "psychedelic"],      "surreal"],
  [["playful", "fun", "joyful"],                "playful"],
  [["haunting", "eerie", "ghostly"],            "haunting"],
];

/** Maps prompt keywords → style tags */
const STYLE_MAP: Array<[string[], string]> = [
  [["photorealistic", "photo-realistic", "hyperrealistic", "hyper-realistic"], "photorealistic"],
  [["cinematic"],                                  "cinematic"],
  [["anime", "manga"],                             "anime"],
  [["oil painting", "oil paint"],                 "oil painting"],
  [["watercolor", "watercolour"],                 "watercolor"],
  [["pencil sketch", "pencil drawing", "sketch"], "pencil sketch"],
  [["digital art", "digital painting"],           "digital art"],
  [["illustration"],                               "illustration"],
  [["3d render", "3d rendered", "cgi", "octane", "blender"], "3D render"],
  [["pixel art", "pixel-art"],                    "pixel art"],
  [["flat design", "flat illustration"],          "flat design"],
  [["concept art"],                                "concept art"],
  [["grunge", "grungy"],                           "grunge"],
  [["minimalist", "minimalistic"],                "minimalist"],
  [["baroque", "renaissance"],                    "classical art"],
  [["pop art"],                                    "pop art"],
  [["ukiyo-e", "japanese art", "woodblock"],      "ukiyo-e"],
  [["noir", "film noir"],                          "noir"],
  [["vaporwave", "lofi", "lo-fi"],               "vaporwave/lofi"],
  [["low poly", "low-poly"],                      "low poly"],
];

/** Maps prompt keywords → composition tags */
const COMPOSITION_MAP: Array<[string[], string]> = [
  [["close-up", "closeup", "extreme close", "ecus"], "close-up"],
  [["medium shot", "mid shot", "waist"],             "medium shot"],
  [["full shot", "full body", "full-body"],          "full shot"],
  [["wide shot", "establishing shot"],               "wide shot"],
  [["aerial", "bird's eye", "birds eye", "top down", "top-down", "overhead"], "aerial / overhead"],
  [["low angle", "worm's eye", "worms eye"],        "low angle"],
  [["high angle"],                                    "high angle"],
  [["portrait", "headshot"],                         "portrait"],
  [["side profile", "side view", "profile shot"],   "side profile"],
  [["symmetrical", "symmetry"],                      "symmetrical"],
  [["rule of thirds"],                               "rule of thirds"],
  [["foreground", "depth of field", "dof"],         "depth of field"],
  [["dutch angle", "tilted", "canted"],             "dutch angle"],
  [["panning", "motion blur"],                       "panning / motion blur"],
];

/** Maps prompt keywords → color tone tags */
const COLOR_TONE_MAP: Array<[string[], string]> = [
  [["warm tone", "warm color", "warm colour", "orange tint", "amber"],       "warm tones"],
  [["cool tone", "cool color", "cool colour", "blue tint", "cold"],          "cool tones"],
  [["pastel", "muted color", "muted colour", "desaturated"],                 "pastel / muted"],
  [["monochrome", "black and white", "b&w", "greyscale", "grayscale"],       "monochrome"],
  [["sepia"],                                                                  "sepia"],
  [["neon", "electric color", "saturated"],                                   "neon / saturated"],
  [["earthy", "earth tone", "muted brown", "ochre"],                         "earthy tones"],
  [["teal and orange", "teal & orange"],                                      "teal & orange"],
  [["purple", "violet", "lavender"],                                          "purple tones"],
  [["green", "emerald", "forest"],                                            "green tones"],
  [["red", "crimson", "scarlet"],                                             "red tones"],
  [["gold", "golden", "gilded"],                                              "golden"],
  [["high contrast"],                                                          "high contrast"],
  [["low contrast", "faded", "washed out"],                                  "low contrast / faded"],
  [["cinematic grade", "color grade", "lut"],                                "cinematic grade"],
];

/** Maps composition → canonical shot_type */
const SHOT_TYPE_MAP: Record<string, string> = {
  "close-up":          "close-up",
  "medium shot":       "medium shot",
  "full shot":         "full shot",
  "wide shot":         "wide shot",
  "aerial / overhead": "aerial",
  "low angle":         "low angle",
  "high angle":        "high angle",
  "portrait":          "portrait",
  "side profile":      "side profile",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize prompt for case-insensitive matching */
function normalize(text: string): string {
  return text.toLowerCase();
}

/**
 * Single-match lookup — returns first map entry whose keywords appear in text.
 * Used for lens, camera, lighting (single best match).
 */
function matchFirst<T>(
  text: string,
  map: Array<[string[], T]>
): T | undefined {
  for (const [keywords, value] of map) {
    if (keywords.some(kw => text.includes(kw))) {
      return value;
    }
  }
  return undefined;
}

/**
 * Multi-match lookup — returns all map entries whose keywords appear in text.
 * Used for mood, style, composition, color_tone (arrays).
 */
function matchAll<T>(
  text: string,
  map: Array<[string[], T]>
): T[] {
  const results: T[] = [];
  for (const [keywords, value] of map) {
    if (keywords.some(kw => text.includes(kw))) {
      results.push(value);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL SUMMARY BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildVisualSummary(partial: {
  shot_type?: string;
  lens?: string;
  lighting?: string;
  mood?: string[];
  style_tags?: string[];
}): string | undefined {
  const parts: string[] = [];

  if (partial.shot_type) parts.push(partial.shot_type);
  if (partial.lens)      parts.push(`${partial.lens} lens`);
  if (partial.lighting)  parts.push(partial.lighting);
  if (partial.mood?.[0]) parts.push(partial.mood[0]);
  if (partial.style_tags?.[0]) parts.push(partial.style_tags[0]);

  if (parts.length === 0) return undefined;
  return parts.join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE SCORER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rough confidence: ratio of populated fields (out of 8 enriched fields).
 * Returns 0–1 rounded to 2 decimal places.
 */
function scoreConfidence(result: Partial<EnrichedMetadata>): number {
  const fields = [
    result.camera, result.lens, result.lighting,
    result.mood?.length ? result.mood : undefined,
    result.style_tags?.length ? result.style_tags : undefined,
    result.composition?.length ? result.composition : undefined,
    result.color_tone?.length ? result.color_tone : undefined,
    result.shot_type,
  ];
  const populated = fields.filter(Boolean).length;
  return Math.round((populated / fields.length) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a prompt string and extract cinematic metadata deterministically.
 *
 * @param prompt - The generation prompt (user-entered text)
 * @returns Partial EnrichedMetadata — only populated fields, never invented values
 */
export function parsePrompt(prompt: string): Omit<EnrichedMetadata, "version"> {
  const text = normalize(prompt);

  // Single-value fields
  const lens     = matchFirst(text, LENS_MAP);
  const camera   = matchFirst(text, CAMERA_MAP);
  const lighting = matchFirst(text, LIGHTING_MAP);

  // Multi-value fields
  const mood        = matchAll(text, MOOD_MAP);
  const style_tags  = matchAll(text, STYLE_MAP);
  const composition = matchAll(text, COMPOSITION_MAP);
  const color_tone  = matchAll(text, COLOR_TONE_MAP);

  // Shot type — derived from first composition match
  const shot_type = composition
    .map(c => SHOT_TYPE_MAP[c])
    .find(Boolean);

  // Visual summary — assembles a short prose description
  const visual_summary = buildVisualSummary({
    shot_type, lens, lighting, mood, style_tags,
  });

  // Build result — only include defined fields
  const result: Omit<EnrichedMetadata, "version"> = {};
  if (camera)               result.camera        = camera;
  if (lens)                 result.lens          = lens;
  if (lighting)             result.lighting      = lighting;
  if (mood.length)          result.mood          = mood;
  if (style_tags.length)    result.style_tags    = style_tags;
  if (composition.length)   result.composition   = composition;
  if (color_tone.length)    result.color_tone    = color_tone;
  if (shot_type)            result.shot_type     = shot_type;
  if (visual_summary)       result.visual_summary = visual_summary;

  result.confidence = scoreConfidence(result);

  return result;
}
