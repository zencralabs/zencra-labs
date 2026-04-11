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
// DO NOT re-export supabase/admin here — it would pull SUPABASE_SERVICE_ROLE_KEY
// into the client bundle and crash at runtime.
// Import the admin client directly in API routes / server actions:
//   import { supabaseAdmin } from "@/lib/supabase/admin";
