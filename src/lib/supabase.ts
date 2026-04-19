import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

// ── Client-side Supabase client (anon key, respects RLS) ──────────────────────
// Safe to use in browser — never contains service role key.
// Explicit auth options keep multi-tab sessions alive and prevent lock races:
//   persistSession  — stores tokens in localStorage (survives page reload)
//   autoRefreshToken — refreshes JWT before it expires (no mid-session logouts)
//   detectSessionInUrl — picks up OAuth tokens from the redirect URL hash
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
    storageKey:        "zencra-auth-token",
  },
});

/** True when real Supabase keys are configured */
export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co";

// ── Server-side admin client ───────────────────────────────────────────────────
// For server-side admin access, import directly from "@/lib/supabase/admin".
// DO NOT import supabaseAdmin here — this file is bundled into client code
// (AuthContext.tsx imports it), and admin.ts throws if SUPABASE_SERVICE_ROLE_KEY
// is missing, which crashes the client bundle.
//
// ✅ In API routes / server components:  import { supabaseAdmin } from "@/lib/supabase/admin"
// ❌ Never import admin client through this file.
