// ─────────────────────────────────────────────────────────────────────────────
// fcs.ts — Fal Cinematic Studio access helper
//
// Single point of truth for FCS access gating.
// Change this function when a Business tier is added — nothing else needs to change.
// ─────────────────────────────────────────────────────────────────────────────

import type { AuthUser } from "@/components/auth/AuthContext";

/**
 * Returns true if the given user has explicit FCS access.
 * Access is granted via the `fcs_enabled` flag in the profiles table.
 */
export function hasFCSAccess(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.fcsEnabled === true;
}
