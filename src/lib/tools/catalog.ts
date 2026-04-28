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
 *    coming_soon / planned tools the provider may be a future string.
 *  - Backend canonical IDs live in src/lib/ai/tool-registry.ts (unchanged).
 *  - Cinema tools (LTX / Future Cinema Studio) are kept completely separate
 *    and are NOT listed here.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToolStatus   = "active" | "coming_soon" | "planned";
export type ToolCategory = "image" | "video" | "audio" | "character" | "enhance";

export interface CatalogTool {
  /** Unique display ID — NOT the backend tool ID */
  id: string;
  /**
   * Backend provider key.
   * For active tools this must match a ProviderName in src/lib/ai/types.ts.
   * For coming_soon / planned tools this is informational only.
   */
  provider: string;
  /** User-facing display name shown in the UI */
  displayName: string;
  category: ToolCategory;
  status: ToolStatus;
  /** Short subtitle shown in dropdowns and cards */
  description: string;
  /** Optional badge text e.g. "HOT", "NEW", "SOON", "BETA" */
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

  // ── IMAGE — Nano Banana (active) ───────────────────────────────────────────
  {
    id: "nano-banana",
    provider: "nano-banana",
    displayName: "Nano Banana",
    category: "image",
    status: "active",
    description: "Fast AI image generation",
    badge: "FAST",
    sortOrder: 20,
  },
  {
    id: "nano-banana-pro",
    provider: "nano-banana",
    displayName: "Nano Banana Pro",
    category: "image",
    status: "active",
    description: "High-res Pro model — 1K & 2K output",
    badge: "PRO",
    premium: true,
    sortOrder: 30,
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

  // ── VIDEO — active (real Kling provider wired) ─────────────────────────────
  {
    id: "kling-30-omni",
    provider: "kling",
    displayName: "Kling 3.0 Omni",
    category: "video",
    status: "active",
    description: "Full-capability cinematic — identity, motion, and frame control unified",
    badge: "NEW",
    sortOrder: 55,
  },
  {
    id: "kling-30",
    provider: "kling",
    displayName: "Kling 3.0",
    category: "video",
    status: "active",
    description: "Flagship model — cinematic quality, best motion",
    badge: "HOT",
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
    id: "kling-25",
    provider: "kling",
    displayName: "Kling 2.5 Turbo",
    category: "video",
    status: "active",
    description: "Fast, reliable cinematic generation",
    sortOrder: 80,
  },

  // ── VIDEO — Seedance (active) ───────────────────────────────────────────────
  {
    id: "seedance-20",
    provider: "seedance",
    displayName: "Seedance 2.0",
    category: "video",
    status: "active",
    description: "High-quality cinematic video — text/image to video, first+last frame",
    badge: "NEW",
    sortOrder: 90,
  },
  {
    id: "seedance-20-fast",
    provider: "seedance",
    displayName: "Seedance 2.0 Fast",
    category: "video",
    status: "active",
    description: "Rapid generation variant of Seedance 2.0",
    badge: "FAST",
    sortOrder: 92,
  },
  {
    id: "seedance-15",
    provider: "seedance",
    displayName: "Seedance 1.5 Pro",
    category: "video",
    status: "coming_soon",
    description: "1080p capable — text/image to video, first+last frame",
    badge: "SOON",
    sortOrder: 94,
  },

  // ── VIDEO — MiniMax Hailuo (coming soon) ────────────────────────────────────
  {
    id: "minimax-hailuo-23",
    provider: "minimax",
    displayName: "Hailuo 2.3",
    category: "video",
    status: "coming_soon",
    description: "MiniMax flagship — cinematic quality with strong motion fidelity",
    badge: "SOON",
    sortOrder: 115,
  },
  {
    id: "minimax-hailuo-23-fast",
    provider: "minimax",
    displayName: "Hailuo 2.3 Fast",
    category: "video",
    status: "coming_soon",
    description: "Fast-turbo variant of Hailuo 2.3",
    badge: "SOON",
    sortOrder: 116,
  },
  {
    id: "minimax-hailuo-02",
    provider: "minimax",
    displayName: "Hailuo 02",
    category: "video",
    status: "coming_soon",
    description: "Consistent characters and cinematic scene depth",
    badge: "SOON",
    sortOrder: 117,
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
    id: "wan-27",
    provider: "wan",
    displayName: "Wan 2.7",
    category: "video",
    status: "coming_soon",
    description: "Alibaba's open-source cinematic video model",
    badge: "SOON",
    sortOrder: 125,
  },
  {
    id: "grok-imagine",
    provider: "grok",
    displayName: "Grok Imagine",
    category: "video",
    status: "coming_soon",
    description: "xAI's physics-aware video generation",
    badge: "SOON",
    sortOrder: 127,
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
    id: "kits-ai",
    provider: "kitsai",
    displayName: "Kits AI",
    category: "audio",
    status: "coming_soon",
    description: "Voice transformation and cloning",
    badge: "SOON",
    sortOrder: 150,
  },

  // ── CHARACTER — planned / coming soon ───────────────────────────────────────
  {
    id: "ai-influencer",
    provider: "character",
    displayName: "AI Influencer",
    category: "character",
    status: "coming_soon",
    description: "Create a consistent AI persona for social media",
    badge: "SOON",
    sortOrder: 200,
  },
  {
    id: "face-swap",
    provider: "character",
    displayName: "Face Swap",
    category: "character",
    status: "coming_soon",
    description: "Seamless realistic face swap in images",
    badge: "SOON",
    sortOrder: 210,
  },
  {
    id: "character-swap",
    provider: "character",
    displayName: "Character Swap",
    category: "character",
    status: "coming_soon",
    description: "Replace characters across scenes consistently",
    badge: "SOON",
    sortOrder: 220,
  },
  {
    id: "video-face-swap",
    provider: "character",
    displayName: "Video Face Swap",
    category: "character",
    status: "coming_soon",
    description: "Live face swap in video with motion tracking",
    badge: "SOON",
    sortOrder: 230,
  },
  {
    id: "ai-stylist",
    provider: "character",
    displayName: "AI Stylist",
    category: "character",
    status: "planned",
    description: "AI-driven wardrobe and look transformation",
    badge: "PLANNED",
    sortOrder: 240,
  },
  {
    id: "recast-studio",
    provider: "character",
    displayName: "Recast Studio",
    category: "character",
    status: "planned",
    description: "Recast any video with a different character",
    badge: "PLANNED",
    sortOrder: 250,
  },
  {
    id: "soul-id",
    provider: "character",
    displayName: "Soul ID Character",
    category: "character",
    status: "planned",
    description: "Build a persistent AI character identity",
    badge: "PLANNED",
    sortOrder: 260,
  },

  // ── ENHANCE — Topaz-backed image & video enhancement (coming soon) ──────────
  {
    id: "topaz-image-enhance",
    provider: "topaz",
    displayName: "Image Enhance",
    category: "enhance",
    status: "coming_soon",
    description: "AI-powered sharpening, denoising, and restoration",
    badge: "BETA",
    sortOrder: 300,
  },
  {
    id: "topaz-image-upscale",
    provider: "topaz",
    displayName: "Image Upscale",
    category: "enhance",
    status: "coming_soon",
    description: "Up to 6× upscale with detail recovery",
    badge: "BETA",
    sortOrder: 310,
  },
  {
    id: "topaz-video-enhance",
    provider: "topaz",
    displayName: "Video Enhance",
    category: "enhance",
    status: "coming_soon",
    description: "Frame interpolation and motion-aware enhancement",
    badge: "BETA",
    sortOrder: 320,
  },
  {
    id: "topaz-video-upscale",
    provider: "topaz",
    displayName: "Video Upscale",
    category: "enhance",
    status: "coming_soon",
    description: "Up to 4K upscale with temporal consistency",
    badge: "BETA",
    sortOrder: 330,
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
 * Active tools are shown first; coming_soon / planned tools are clearly labelled.
 */
export function getNavModels(category: ToolCategory, limit = 3): CatalogTool[] {
  return getToolsByCategory(category).slice(0, limit);
}

/** Look up a single tool by its display id */
export function findTool(id: string): CatalogTool | undefined {
  return TOOL_CATALOG.find(t => t.id === id);
}
