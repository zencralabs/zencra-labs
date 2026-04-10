import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

// ── Client-side Supabase client (anon key, respects RLS) ──────────────────────
// Safe to use in browser — never contains service role key
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
