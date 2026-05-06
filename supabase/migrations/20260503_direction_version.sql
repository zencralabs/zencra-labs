/**
 * Add direction_version to creative_directions.
 *
 * Starts at 1 on creation. Incremented on significant direction edits
 * (e.g., when re-locked after element/refinement changes).
 *
 * Foundation for:
 *   - Rollback (restore a previous version's snapshot)
 *   - A/B scene comparison (version 1 vs version 2 outputs)
 *   - FCS compatibility (version is part of the identity fingerprint)
 *   - direction_versions table in a future phase
 */

alter table creative_directions
  add column if not exists direction_version int not null default 1;
