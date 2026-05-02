/**
 * Add scene_snapshot to creative_directions.
 *
 * scene_snapshot — denormalized JSONB view of the full direction state at the
 * time of last generate (or lock). Stores elements + refinements + mode so the
 * UI can fast-reload scene state without three separate DB fetches.
 * Also provides the foundation for undo/redo and FCS versioning.
 *
 * Written by the generate route (fire-and-forget after data fetch).
 * Written by the lock route (on commit).
 *
 * Shape:
 * {
 *   "mode":        "explore" | "locked",
 *   "elements":    DirectionElementRow[],
 *   "refinements": DirectionRefinementsRow | null,
 *   "snapshot_at": ISO timestamp
 * }
 */

alter table creative_directions
  add column if not exists scene_snapshot jsonb;
