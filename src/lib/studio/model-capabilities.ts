/**
 * Shared model capability registry.
 * Used by both Image Studio and Creative Director to ensure consistent upload caps.
 * Source of truth: these are product-configured caps (not necessarily provider hard limits).
 */

export interface ModelCapabilities {
  /** Maximum number of reference images this model accepts. 1 = single ref only. */
  maxReferenceImages: number;
  /** Human-readable tooltip for upload cap UI */
  uploadCapLabel: string;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  "gpt-image-1":          { maxReferenceImages: 16, uploadCapLabel: "Up to 16 reference images" },
  // Phase 1C: gpt-image-2 Reference Stack — max 2 (subject + scene).
  // imageUrls[0] = primary subject / identity reference
  // imageUrls[1] = scene / style reference
  // Future: evolve to roles-aware references[] when needed.
  "gpt-image-2":          { maxReferenceImages: 2,  uploadCapLabel: "Up to 2 references (subject + scene)" },
  "nano-banana-pro":      { maxReferenceImages: 14, uploadCapLabel: "Up to 14 reference images" },
  "nano-banana-standard": { maxReferenceImages: 1,  uploadCapLabel: "Single reference image" },
  "nano-banana-2":        { maxReferenceImages: 14, uploadCapLabel: "Up to 14 reference images" },
  // seedream-v5 and v5-lite do NOT accept image input — adapter rejects it at validateInput().
  // maxReferenceImages: 0 ensures the Add button is never shown for these models.
  "seedream-v5":          { maxReferenceImages: 0,  uploadCapLabel: "Text-to-image only — no reference images" },
  "seedream-v5-lite":     { maxReferenceImages: 0,  uploadCapLabel: "Text-to-image only — no reference images" },
  "seedream-4-5":         { maxReferenceImages: 1,  uploadCapLabel: "1 reference image for edit mode" },
  "flux-kontext":         { maxReferenceImages: 1,  uploadCapLabel: "Single reference image only" },
};

/** Returns upload cap for a model key. Defaults to 1 for unknown models (conservative). */
export function getModelCapabilities(modelKey: string): ModelCapabilities {
  return MODEL_CAPABILITIES[modelKey] ?? { maxReferenceImages: 1, uploadCapLabel: "Single reference image" };
}
