// ─────────────────────────────────────────────────────────────────────────────
// AI Influencer Name Generator
//
// Generates unique handles for AI influencers from a curated name pool.
// Names are evocative, modern, culturally diverse, and creator-ready.
//
// Handle storage: lowercase in DB (e.g. "nova")
// Display name:   title-case (e.g. "Nova")
// UI display:     @Nova
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase/admin";
export { formatHandle } from "@/lib/ai-influencer/format-handle";

// ── Curated name pool ─────────────────────────────────────────────────────────

const INFLUENCER_NAMES: string[] = [
  // Feminine-coded
  "Amanda", "Nova", "Zara", "Luna", "Aria",
  "Sofia", "Nadia", "Lyra", "Vera", "Iris",
  "Elara", "Jade", "Maya", "Cleo", "Seren",
  "Nyx", "Aya", "Lila", "Remi", "Kira",
  "Dara", "Suki", "Veda", "Ines", "Cora",
  "Faye", "Juno", "Leia", "Mara", "Thea",
  "Wren", "Sera", "Isla", "Zoe", "Nia",

  // Masculine-coded
  "Atlas", "Orion", "Leo", "Axel", "Kael",
  "Zion", "Riven", "Sable", "Onyx", "Flint",
  "Reed", "Grey", "Zane", "Kai", "Sol",
  "Ren", "Rook", "Blaze", "Crest", "Penn",
  "Idris", "Rafe", "Cade", "Knox", "Tao",

  // Gender-neutral
  "River", "Quinn", "Sage", "Ember", "Storm",
  "Vale", "Sky", "Fox", "Roux", "Echo",
  "North", "Arrow", "Cove", "Flux", "Cedar",
  "Lumen", "Drift", "Tide", "Veil", "Noire",
];

// ── Generate a unique handle for a user ──────────────────────────────────────

/**
 * Picks a random name from the pool and ensures it's unique for this user.
 * Retries up to 20 times before falling back to a numeric suffix.
 *
 * Returns: { handle: "nova", displayName: "Nova" }
 */
export async function generateUniqueHandle(userId: string): Promise<{
  handle: string;
  displayName: string;
}> {
  // Fetch all existing handles for this user to avoid DB round-trips per attempt
  const { data: existing } = await supabaseAdmin
    .from("ai_influencers")
    .select("handle")
    .eq("user_id", userId)
    .not("handle", "is", null);

  const usedHandles = new Set(
    (existing ?? []).map(r => r.handle?.toLowerCase()).filter(Boolean),
  );

  // Shuffle pool and try each name
  const shuffled = [...INFLUENCER_NAMES].sort(() => Math.random() - 0.5);

  for (const name of shuffled) {
    const handle = name.toLowerCase();
    if (!usedHandles.has(handle)) {
      return { handle, displayName: name };
    }
  }

  // All names taken — append a number to the first name
  const base = shuffled[0].toLowerCase();
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}${i}`;
    if (!usedHandles.has(candidate)) {
      const displayName = `${shuffled[0]}${i}`;
      return { handle: candidate, displayName };
    }
  }

  // Absolute fallback (extremely unlikely)
  const ts = Date.now().toString(36);
  return { handle: `creator_${ts}`, displayName: `Creator${ts}` };
}

