/**
 * src/lib/types/generation.ts
 *
 * Shared TypeScript types for the Zencra Labs product system.
 * Used across API routes, components, and client hooks.
 */

// ── Visibility ─────────────────────────────────────────────────────────────────

/**
 * Controls who can see an asset.
 * - "project"  → visible only to the owner, grouped inside a Project folder
 * - "private"  → visible only to the owner, not grouped in any folder
 * - "public"   → visible to everyone in the global Gallery
 */
export type AssetVisibility = "project" | "private" | "public";

// ── Project ────────────────────────────────────────────────────────────────────

/** A folder that groups generations for a single user. */
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  /** URL of the first asset in the project — used as the cover thumbnail. */
  cover_url: string | null;
  /** Kept in sync by the sync_project_asset_count trigger. */
  asset_count: number;
  created_at: string;
  updated_at: string;
}

export type ProjectInsert = Pick<Project, "name"> & { description?: string };
export type ProjectUpdate = Partial<Pick<Project, "name" | "description">>;

// ── Generation Asset ───────────────────────────────────────────────────────────

export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

/** A single AI-generated asset row from the `generations` table. */
export interface GenerationAsset {
  id: string;
  user_id: string;
  /** Matches a catalog tool id, e.g. "kling-30" */
  tool: string;
  tool_category: "image" | "video" | "audio" | "character" | "enhance";
  prompt: string;
  negative_prompt: string | null;
  /** Serialised JSON parameters passed to the provider. */
  parameters: Record<string, unknown> | null;
  /** Primary result URL (first item for multi-output tools). */
  result_url: string | null;
  /** All result URLs for tools that return multiple assets. */
  result_urls: string[] | null;
  status: GenerationStatus;
  visibility: AssetVisibility;
  project_id: string | null;
  credits_used: number;
  api_cost_usd: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── Lightweight card type for Gallery / MediaCard ──────────────────────────────

/**
 * Minimal shape returned by the public-gallery API.
 * Omits sensitive fields (user_id, api_cost_usd, parameters, error_message).
 */
export interface PublicAsset {
  id: string;
  tool: string;
  tool_category: GenerationAsset["tool_category"];
  prompt: string;
  result_url: string | null;
  result_urls: string[] | null;
  visibility: AssetVisibility;
  project_id: string | null;
  credits_used: number;
  created_at: string;
}

/**
 * Extended version returned to the asset owner — includes project info.
 */
export interface OwnedAsset extends PublicAsset {
  user_id: string;
  status: GenerationStatus;
  negative_prompt: string | null;
  completed_at: string | null;
  /** Populated when the consumer needs the folder name/cover for display. */
  project?: Pick<Project, "id" | "name" | "cover_url"> | null;
}

// ── API response wrappers ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type GalleryResponse = PaginatedResponse<PublicAsset>;

// ── Visibility update payload ──────────────────────────────────────────────────

export interface VisibilityUpdatePayload {
  visibility: AssetVisibility;
  /** Optional — move asset into (or out of) a project at the same time. */
  project_id?: string | null;
}

// ── Action menu types ──────────────────────────────────────────────────────────

export type CardAction =
  | "like"
  | "download"
  | "copy_url"
  | "open"
  | "regenerate"
  | "reuse_prompt"
  | "enhance"
  | "animate"
  | "make_public"
  | "make_private"
  | "move_to_project"
  | "remove_from_project"
  | "delete";
