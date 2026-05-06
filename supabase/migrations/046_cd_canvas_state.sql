/**
 * Migration 046 — CDv2 canvas_state on creative_directions
 *
 * Adds `canvas_state` JSONB column to `creative_directions`.
 * This stores the full CDv2 canvas snapshot for session persistence:
 * frames, textNodes, connections, uploadedAssets metadata, selectedModel,
 * sceneIntent, characterDirection, activeStyleMood, canvasTransform.
 *
 * Schema version field allows safe forward migration when the shape evolves.
 *
 * Expected shape (version 1):
 * {
 *   "version":          1,
 *   "frames":           GenerationFrame[],
 *   "textNodes":        CanvasTextNode[],
 *   "connections":      NodeConnection[],
 *   "uploadedAssets":   { id, url, name, assignedRole }[],
 *   "selectedModel":    string,
 *   "sceneIntent":      { text: string; uploadedUrl: string | null },
 *   "characterDirection": CharacterDirection,
 *   "activeStyleMood":  string | null,
 *   "canvasTransform":  { x: number; y: number; scale: number },
 *   "savedAt":          ISO timestamp
 * }
 *
 * Written by: PATCH /api/creative-director/directions/[id]/canvas (autosave)
 * Read by:    GET  /api/creative-director/directions/[id]/canvas (restore on mount)
 *
 * Note: blob: URLs in uploadedAssets are NOT persisted (they expire on refresh).
 * Only Supabase Storage URLs and other durable URLs survive restoration.
 */

alter table creative_directions
  add column if not exists canvas_state jsonb;

-- Index on user_id + updated_at so "load my last session" queries stay fast
-- even as the directions table grows.
create index if not exists creative_directions_canvas_user_updated
  on creative_directions (user_id, updated_at desc)
  where canvas_state is not null;
