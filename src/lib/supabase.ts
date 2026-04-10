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
// Returns the singleton from supabase/admin.ts.
// Only import this in API routes / server components — NEVER in client code.
import { supabaseAdmin } from "./supabase/admin";
export function createAdminClient() { return supabaseAdmin; }
