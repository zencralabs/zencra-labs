/**
 * Style Preview System — Image Studio empty state
 *
 * Each model has its own folder of hero images that reflect its visual identity.
 * Admins can swap images at any time without touching code.
 *
 * Folder locations:
 *   /public/zencralabs/hero-images/{model-key}/hero-{1-5}.jpg
 *
 * Rules:
 *   - 3 to 5 images per model (strip layout is tuned for this range)
 *   - Recommended dimensions: 400×540px portrait or 480×640px
 *   - Format: JPG or WebP for best performance
 *   - Missing images fall back to gradient placeholders — no broken icons
 */

export type HeroModelKey =
  | "gpt-image"
  | "nano-banana"
  | "nano-banana-pro"
  | "nano-banana-2"
  | "seedream"
  | "flux";

export const MODEL_HERO_IMAGES: Record<HeroModelKey, string[]> = {
  "gpt-image": [
    "/zencralabs/hero-images/gpt-image/hero-1.jpg",
    "/zencralabs/hero-images/gpt-image/hero-2.jpg",
    "/zencralabs/hero-images/gpt-image/hero-3.jpg",
    "/zencralabs/hero-images/gpt-image/hero-4.jpg",
    "/zencralabs/hero-images/gpt-image/hero-5.jpg",
  ],
  "nano-banana": [
    "/zencralabs/hero-images/nano-banana/hero-1.jpg",
    "/zencralabs/hero-images/nano-banana/hero-2.jpg",
    "/zencralabs/hero-images/nano-banana/hero-3.jpg",
    "/zencralabs/hero-images/nano-banana/hero-4.jpg",
    "/zencralabs/hero-images/nano-banana/hero-5.jpg",
  ],
  "nano-banana-pro": [
    "/zencralabs/hero-images/nano-banana-pro/hero-1.jpg",
    "/zencralabs/hero-images/nano-banana-pro/hero-2.jpg",
    "/zencralabs/hero-images/nano-banana-pro/hero-3.jpg",
    "/zencralabs/hero-images/nano-banana-pro/hero-4.jpg",
    "/zencralabs/hero-images/nano-banana-pro/hero-5.jpg",
  ],
  "nano-banana-2": [
    "/zencralabs/hero-images/nano-banana-2/hero-1.jpg",
    "/zencralabs/hero-images/nano-banana-2/hero-2.jpg",
    "/zencralabs/hero-images/nano-banana-2/hero-3.jpg",
    "/zencralabs/hero-images/nano-banana-2/hero-4.jpg",
    "/zencralabs/hero-images/nano-banana-2/hero-5.jpg",
  ],
  "seedream": [
    "/zencralabs/hero-images/seedream/hero-1.jpg",
    "/zencralabs/hero-images/seedream/hero-2.jpg",
    "/zencralabs/hero-images/seedream/hero-3.jpg",
    "/zencralabs/hero-images/seedream/hero-4.jpg",
    "/zencralabs/hero-images/seedream/hero-5.jpg",
  ],
  "flux": [
    "/zencralabs/hero-images/flux/hero-1.jpg",
    "/zencralabs/hero-images/flux/hero-2.jpg",
    "/zencralabs/hero-images/flux/hero-3.jpg",
    "/zencralabs/hero-images/flux/hero-4.jpg",
    "/zencralabs/hero-images/flux/hero-5.jpg",
  ],
};

/**
 * Maps any Image Studio model ID to its hero image folder.
 * Add new model IDs here as new providers are onboarded.
 */
export function getHeroImagesForModel(modelId: string): string[] {
  if (modelId === "nano-banana-pro")      return MODEL_HERO_IMAGES["nano-banana-pro"];
  if (modelId === "nano-banana-2")        return MODEL_HERO_IMAGES["nano-banana-2"];
  if (modelId === "nano-banana-standard") return MODEL_HERO_IMAGES["nano-banana"];
  if (modelId.startsWith("nano-banana"))  return MODEL_HERO_IMAGES["nano-banana"];
  if (modelId.includes("seedream"))       return MODEL_HERO_IMAGES["seedream"];
  if (modelId.includes("flux"))           return MODEL_HERO_IMAGES["flux"];
  // dalle3 and any unknown model → gpt-image folder
  return MODEL_HERO_IMAGES["gpt-image"];
}

/**
 * Returns the display label for the style preview pill.
 */
export function getHeroModelLabel(modelId: string): string {
  if (modelId === "nano-banana-pro")      return "Nano Banana Pro";
  if (modelId === "nano-banana-2")        return "Nano Banana 2";
  if (modelId === "nano-banana-standard") return "Nano Banana";
  if (modelId.startsWith("nano-banana"))  return "Nano Banana";
  if (modelId.includes("seedream"))       return "Seedream";
  if (modelId.includes("flux"))           return "Flux Kontext";
  return "GPT Image";
}

// Legacy export — kept for backward compatibility during the migration window.
// Use getHeroImagesForModel() for all new code.
export const HERO_IMAGES: string[] = MODEL_HERO_IMAGES["gpt-image"];
