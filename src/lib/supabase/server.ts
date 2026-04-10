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
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  // Use anon key + the user's JWT — Supabase validates the token server-side
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;

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
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return { user, authError: null };
}
