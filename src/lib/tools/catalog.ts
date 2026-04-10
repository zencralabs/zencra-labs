/**
 * src/lib/tools/catalog.ts
 *
 * SINGLE SOURCE OF TRUTH for all frontend-visible AI tools.
 *
 * Rules:
 *  - This file is FRONTEND-ONLY (display names, badges, sort order).
 *  - Do NOT import from this file inside /api routes or server actions.
 *  - The `provider` field must map to a valid ProviderName in types.ts for
 *    active tools (so the studio pages can pass it to the API). For
 *    coming_soon tools the provider may be a future string — it is never
 *    sent to the API.
 *  - Backend canonical IDs live in src/lib/ai/tool-registry.ts (unchanged).
 *  - Cinema tools (LTX / Future Cinema Studio) are kept completely separate
 *    and are NOT listed here.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToolStatus   = "active" | "coming_soon";
export type ToolCategory = "image" | "video" | "audio";

export interface CatalogTool {
  /** Unique display ID — NOT the backend tool ID */
  id: string;
  /**
   * Backend provider key.
   * For active tools this must match a ProviderName in src/lib/ai/types.ts.
   * For coming_soon tools this is informational only.
   */
  provider: string;
  /** User-facing display name shown in the UI */
  displayName: string;
  category: ToolCategory;
  status: ToolStatus;
  /** Short subtitle shown in dropdowns and cards */
  description: string;
  /** Optional badge text e.g. "HOT", "NEW", "SOON" */
  badge?: string;
  /** Hex badge colour (defaults to category accent if omitted) */
  badgeColor?: string;
  /** Whether this tool costs more credits than the base rate */
  premium?: boolean;
  /** Lower number = shown first within its category */
  sortOrder: number;
}

// ── Catalog ────────────────────────────────────────────────────────────────────

export const TOOL_CATALOG: CatalogTool[] = [
  // ── IMAGE — active ──────────────────────────────────────────────────────────
  {
    id: "gpt-image-15",
    provider: "dalle",           // maps to "dalle-3" in tool-registry.ts
    displayName: "GPT Image 1.5",
    category: "image",
    status: "active",
    description: "OpenAI's advanced image generation model",
    sortOrder: 10,
  },

  // ── IMAGE — coming soon ─────────────────────────────────────────────────────
  {
    id: "nano-banana",
    provider: "nano-banana",
    displayName: "Nano Banana",
    category: "image",
    status: "coming_soon",
    description: "Fast, high-quality 4K image generation",
    badge: "SOON",
    sortOrder: 20,
  },
  {
    id: "nano-banana-pro",
    provider: "nano-banana",
    displayName: "Nano Banana Pro",
    category: "image",
    status: "coming_soon",
    description: "Flagship 4K+ model — best image quality",
    badge: "SOON",
    premium: true,
    sortOrder: 30,
  },
  {
    id: "midjourney-v7",
    provider: "midjourney",
    displayName: "Midjourney v7",
    category: "image",
    status: "coming_soon",
    description: "Industry-leading artistic AI images",
    badge: "SOON",
    sortOrder: 40,
  },
  {
    id: "flux-pro",
    provider: "flux",
    displayName: "FLUX Pro",
    category: "image",
    status: "coming_soon",
    description: "Speed-optimised, fine detail generation",
    badge: "SOON",
    sortOrder: 50,
  },

  // ── VIDEO — active (wired via mock/real provider) ───────────────────────────
  {
    id: "kling-25",
    provider: "kling",
    displayName: "Kling 2.5",
    category: "video",
    status: "active",
    description: "High-quality cinematic video generation",
    sortOrder: 60,
  },
  {
    id: "kling-26",
    provider: "kling",
    displayName: "Kling 2.6",
    category: "video",
    status: "active",
    description: "Enhanced motion and scene coherence",
    sortOrder: 70,
  },
  {
    id: "kling-30",
    provider: "kling",
    displayName: "Kling 3.0",
    category: "video",
    status: "active",
    description: "Cinematic video with AI audio sync",
    badge: "HOT",
    sortOrder: 80,
  },
  {
    id: "seedance-20",
    provider: "seedance",
    displayName: "Seedance 2.0",
    category: "video",
    status: "active",
    description: "Intelligent visual story generation",
    sortOrder: 90,
  },

  // ── VIDEO — coming soon ─────────────────────────────────────────────────────
  {
    id: "veo-32",
    provider: "veo",
    displayName: "Google Veo 3.2",
    category: "video",
    status: "coming_soon",
    description: "Advanced AI video with natural sound",
    badge: "SOON",
    sortOrder: 100,
  },
  {
    id: "sora-2",
    provider: "sora",
    displayName: "OpenAI Sora 2",
    category: "video",
    status: "coming_soon",
    description: "High-fidelity world simulation video",
    badge: "SOON",
    sortOrder: 110,
  },
  {
    id: "runway-gen45",
    provider: "runway",
    displayName: "Runway Gen-4.5",
    category: "video",
    status: "coming_soon",
    description: "Professional-grade AI video editing",
    badge: "SOON",
    sortOrder: 120,
  },

  // ── AUDIO — active ──────────────────────────────────────────────────────────
  {
    id: "elevenlabs",
    provider: "elevenlabs",
    displayName: "ElevenLabs",
    category: "audio",
    status: "active",
    description: "Expressive AI voice and speech generation",
    sortOrder: 130,
  },

  // ── AUDIO — coming soon ─────────────────────────────────────────────────────
  {
    id: "suno-ai",
    provider: "suno",
    displayName: "Suno AI",
    category: "audio",
    status: "coming_soon",
    description: "Full music generation from text",
    badge: "SOON",
    sortOrder: 140,
  },
  {
    id: "kits-ai",
    provider: "kitsai",
    displayName: "Kits AI",
    category: "audio",
    status: "coming_soon",
    description: "Voice transformation and cloning",
    badge: "SOON",
    sortOrder: 150,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** All tools in a category, sorted by sortOrder */
export function getToolsByCategory(category: ToolCategory): CatalogTool[] {
  return TOOL_CATALOG
    .filter(t => t.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Active tools only, optionally filtered by category */
export function getActiveTools(category?: ToolCategory): CatalogTool[] {
  return TOOL_CATALOG.filter(
    t => t.status === "active" && (!category || t.category === category),
  );
}

/**
 * Returns the top N tools for a given category — used in Navbar dropdowns.
 * Active tools are shown first; coming_soon tools are clearly labelled.
 */
export function getNavModels(category: ToolCategory, limit = 3): CatalogTool[] {
  return getToolsByCategory(category).slice(0, limit);
}

/** Look up a single tool by its display id */
export function findTool(id: string): CatalogTool | undefined {
  return TOOL_CATALOG.find(t => t.id === id);
}
