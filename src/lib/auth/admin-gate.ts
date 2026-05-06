/**
 * Centralized admin authentication gate.
 *
 * Eliminates the isAdmin() function duplicated across 9+ admin route files.
 * A single change here propagates to every admin route automatically.
 *
 * Usage:
 *   const { user, adminError } = await requireAdmin(req);
 *   if (adminError) return adminError;
 *   // user is guaranteed to be admin from here
 *
 * Security model:
 *   1. Extracts + verifies the Bearer JWT via Supabase anon key (server-side).
 *   2. Queries the profiles table via service role key for the role field.
 *   3. Returns 401 if no valid session, 403 if authenticated but not admin.
 *   4. Both checks are server-authoritative — nothing is trusted from the client.
 *
 * Supports both Request and NextRequest transparently.
 */

import type { User } from "@supabase/supabase-js";
import { getAuthUser }   from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AdminGateResult =
  | { user: User; adminError: null }
  | { user: null;  adminError: Response };

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN GATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies that the incoming request is authenticated AND has admin role.
 *
 * Returns `{ user, adminError: null }` when the caller is a verified admin.
 * Returns `{ user: null, adminError: Response }` with a ready-made 401/403
 * response when the gate fails — just `return adminError` from the route.
 *
 * @example
 *   export async function GET(req: Request) {
 *     const { user, adminError } = await requireAdmin(req);
 *     if (adminError) return adminError;
 *     // ... admin logic using user.id
 *   }
 */
export async function requireAdmin(req: Request): Promise<AdminGateResult> {
  // Step 1 — Verify the JWT is valid and belongs to a real (non-system) user
  const user = await getAuthUser(req);
  if (!user) {
    return {
      user: null,
      adminError: Response.json(
        { success: false, code: "UNAUTHORIZED", error: "Unauthorized — valid session required." },
        { status: 401 }
      ),
    };
  }

  // Step 2 — Verify the user has admin role via service role key (not RLS)
  // Using supabaseAdmin ensures RLS cannot bypass this check.
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    // DB error checking role — fail closed (deny access on uncertainty)
    return {
      user: null,
      adminError: Response.json(
        { success: false, code: "SERVER_ERROR", error: "Failed to verify admin role." },
        { status: 500 }
      ),
    };
  }

  if (profile?.role !== "admin") {
    return {
      user: null,
      adminError: Response.json(
        { success: false, code: "FORBIDDEN", error: "Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { user, adminError: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOLEAN HELPER (for conditional checks without response return)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the request is from a verified admin, false otherwise.
 * Use this only when you need a boolean check (e.g. conditional UI data).
 * For route protection, always use requireAdmin() instead.
 */
export async function isAdminUser(req: Request): Promise<boolean> {
  const result = await requireAdmin(req);
  return result.adminError === null;
}
