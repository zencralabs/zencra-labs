/**
 * Server-side auth helpers for API routes.
 *
 * Uses the ANON key + the user's JWT to validate identity.
 * Never imports the service role key — that stays in admin.ts only.
 */

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Extracts and validates the Bearer JWT from an API request.
 *
 * Returns the authenticated Supabase User, or null if:
 *  - No Authorization header
 *  - Token is invalid / expired
 *  - Supabase env vars are not configured
 *
 * @example
 *   const user = await getAuthUser(req);
 *   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function getAuthUser(req: Request): Promise<User | null> {
  const dev = process.env.NODE_ENV === "development";

  if (!supabaseUrl || !supabaseAnonKey) {
    if (dev) console.warn("[getAuthUser] ✗ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return null;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    if (dev) console.warn("[getAuthUser] ✗ No Bearer token in Authorization header");
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    if (dev) console.warn("[getAuthUser] ✗ Empty token after Bearer prefix");
    return null;
  }

  // Use anon key + the user's JWT — Supabase validates the token server-side
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) {
    if (dev) console.warn("[getAuthUser] ✗ auth.getUser failed:", error?.message ?? "no user returned");
    return null;
  }

  // Block synthetic/system users (e.g. demo user) from authenticating through real routes.
  // is_system = true is set once in the DB and never changes at runtime.
  const { data: profileMeta, error: profileErr } = await client
    .from("profiles")
    .select("is_system")
    .eq("id", user.id)
    .single();

  if (dev && profileErr) {
    console.warn("[getAuthUser] ⚠ profiles.is_system query failed (user still allowed):", profileErr.message);
  }

  if (profileMeta?.is_system === true) {
    if (dev) console.warn("[getAuthUser] ✗ Blocked system user:", user.id);
    return null;
  }

  if (dev) console.log("[getAuthUser] ✓ Authenticated:", user.id, user.email);
  return user;
}

/**
 * Same as getAuthUser but returns a 401 response directly if unauthenticated.
 * Use this when the route REQUIRES auth (no guest/demo fallback).
 */
export async function requireAuthUser(req: Request): Promise<
  | { user: User; authError: null }
  | { user: null; authError: Response }
> {
  const user = await getAuthUser(req);
  if (!user) {
    return {
      user: null,
      authError: new Response(
        JSON.stringify({ success: false, code: "UNAUTHORIZED", error: "Unauthorized — valid session required." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return { user, authError: null };
}
