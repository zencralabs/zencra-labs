// ─────────────────────────────────────────────────────────────────────────────
// AI Influencer Name Generator — Region-Aware
//
// Picks culturally-matched names from region-keyed pools based on the
// ethnicity_region selected in the builder.  Falls back to an aesthetic
// collision strategy (@heyzara, @realzara, @itszara) — NEVER random suffixes.
//
// Handle storage: lowercase in DB (e.g. "zara")
// Display name:   title-case (e.g. "Zara")
// UI display:     @Zara
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase/admin";
export { formatHandle } from "@/lib/ai-influencer/format-handle";

// ── Region-keyed name pools ───────────────────────────────────────────────────
// Each pool is a mix of feminine, masculine, and neutral names that feel
// authentic to that heritage — short, memorable, and creator-ready.

const NAME_POOLS: Record<string, string[]> = {

  "south-asian-indian": [
    // Feminine
    "Zara", "Aanya", "Kiara", "Mira", "Priya", "Riya", "Nisha", "Diya",
    "Isha", "Sana", "Meera", "Layla", "Arya", "Tara", "Avani",
    // Masculine
    "Aarav", "Arjun", "Rohan", "Vikram", "Dev", "Nikhil", "Sid", "Karan",
    "Ishan", "Rishi",
    // Neutral
    "Kiran", "Sai", "Noor", "Indra", "Veda",
  ],

  "south-asian-other": [
    "Zara", "Anika", "Nadia", "Sana", "Riya", "Leila",
    "Emre", "Rahul", "Nihal", "Dilan",
    "Kiran", "Noor", "Suri", "Veda",
  ],

  "east-asian": [
    // Feminine
    "Yuna", "Hana", "Mei", "Suki", "Rin", "Mina", "Yuki", "Rei",
    "Sora", "Aiko", "Haru", "Nami", "Riko", "Kaya", "Luna",
    // Masculine
    "Kai", "Ren", "Jun", "Hiro", "Kenji", "Ryo", "Sota",
    "Yuto", "Naoki", "Taro",
    // Neutral
    "Yu", "Shu", "Mao", "Ao", "Tao",
  ],

  "southeast-asian": [
    // Feminine
    "Aria", "Lila", "Maya", "Sari", "Kaya", "Nira", "Dara", "Yani",
    "Thida", "Malee",
    // Masculine
    "Bayu", "Ari", "Rama", "Dion", "Farhan", "Rizal",
    // Neutral
    "Suri", "Indra", "Bali", "Reva",
  ],

  "african": [
    // Feminine
    "Nia", "Amara", "Zola", "Imani", "Kemi", "Adaeze", "Nkechi", "Yemi",
    "Fatou", "Awa", "Kira", "Ama", "Ife", "Sadia",
    // Masculine
    "Kofi", "Kwame", "Emeka", "Seun", "Dami", "Ade", "Tunde", "Chidi",
    "Femi", "Segun",
    // Neutral
    "Ndidi", "Amadu", "Remi", "Ore",
  ],

  "african-american": [
    // Feminine
    "Jade", "Morgan", "Aaliyah", "Brianna", "Janelle", "Simone", "Imani",
    "Nyla", "Zoe", "Kayla", "Destiny", "India", "Amara", "Nia",
    // Masculine
    "Marcus", "Jaylen", "Jordan", "Malik", "Darius", "Xavier", "Jamal",
    "Rasheed", "Kal",
    // Neutral
    "Riley", "Quinn", "Sage", "River",
  ],

  "european": [
    // Feminine
    "Elena", "Sofia", "Isabelle", "Vera", "Iris", "Clara", "Nadia",
    "Elara", "Cleo", "Mara", "Thea", "Faye", "Sera", "Wren",
    // Masculine
    "Leo", "Felix", "Julian", "Axel", "Emil", "Lukas", "Rafe",
    "Idris", "Cade",
    // Neutral
    "Quinn", "Sage", "Remi", "Vale",
  ],

  "scandinavian": [
    // Feminine
    "Freya", "Astrid", "Sigrid", "Ingrid", "Liv", "Signe", "Maja",
    "Thea", "Nora", "Runa",
    // Masculine
    "Erik", "Bjorn", "Sven", "Leif", "Axel", "Ulf", "Tor",
    "Ragnar", "Gunnar",
    // Neutral
    "Saga", "Frey", "Storm", "Skye",
  ],

  "mediterranean": [
    // Feminine
    "Elena", "Stella", "Isadora", "Valentina", "Mia", "Lina", "Allegra",
    "Chiara", "Rosa", "Nadia",
    // Masculine
    "Marco", "Luca", "Dante", "Rafael", "Nico", "Leon", "Elias",
    "Angelo", "Matteo",
    // Neutral
    "Remi", "Sable", "Crest", "Vale",
  ],

  "latin-american": [
    // Feminine
    "Luna", "Sofia", "Valentina", "Camila", "Isabella", "Lucia",
    "Gabriela", "Daniela", "Natalia", "Valeria",
    // Masculine
    "Mateo", "Sebastian", "Lucas", "Miguel", "Diego", "Andres",
    "Felipe", "Emilio", "Javier",
    // Neutral
    "Sol", "Cruz", "Vale", "Rio",
  ],

  "brazilian": [
    "Beatriz", "Larissa", "Tatiane", "Giovanna", "Ana", "Bruna",
    "Gabriel", "Thiago", "Gustavo", "Rafael", "Felipe",
    "Davi", "Caua", "Sol",
  ],

  "middle-eastern": [
    // Feminine
    "Layla", "Noor", "Amir", "Yasmin", "Hana", "Rania", "Maha",
    "Lina", "Sana", "Dalia",
    // Masculine
    "Zayn", "Amir", "Omar", "Kareem", "Farouk", "Rami", "Tarek",
    "Yasser", "Basil",
    // Neutral
    "Noor", "Jad", "Sari", "Reem",
  ],

  "mixed-ethnicity": [
    "Nova", "River", "Quinn", "Sage", "Ember", "Storm",
    "Sky", "Echo", "Arrow", "Cedar", "Roux", "Tide",
    "Drift", "Veil", "Lumen", "Flux",
  ],

  // Default pool — universal, creator-coded
  "default": [
    "Nova", "Zara", "Luna", "Aria", "Lyra", "Vera", "Iris", "Maya",
    "Cleo", "Jade", "Kira", "Dara", "Faye", "Juno", "Thea", "Wren",
    "Atlas", "Orion", "Leo", "Axel", "Kai", "Sol", "Ren",
    "River", "Quinn", "Sage", "Ember", "Storm", "Echo", "Lumen",
  ],
};

// ── Collision-safe aesthetic prefixes ─────────────────────────────────────────
// When a clean name is taken, we try these human-readable suffixes first.
// Result: @heyzara, @realzara, @itszara, @byzara, @thezara
// NEVER: @zara2, @zara_timestamp
const AESTHETIC_PREFIXES = ["hey", "real", "its", "by", "the", "iam", "hi", "go"];
const AESTHETIC_SUFFIXES_AS_PREFIX = ["ia", "ux", "oo", "ox"];

// ── Generate a unique handle for a user ──────────────────────────────────────

/**
 * Picks a region-appropriate name and ensures it's unique for this user.
 * Falls back to aesthetic prefixes (@heyzara) before numeric suffixes.
 *
 * Returns: { handle: "zara", displayName: "Zara" }
 */
export async function generateUniqueHandle(
  userId:          string,
  ethnicityRegion?: string | null,
): Promise<{ handle: string; displayName: string }> {
  // Fetch all existing handles for this user to avoid repeated DB hits
  const { data: existing } = await supabaseAdmin
    .from("ai_influencers")
    .select("handle")
    .eq("user_id", userId)
    .not("handle", "is", null);

  const usedHandles = new Set(
    (existing ?? []).map(r => r.handle?.toLowerCase()).filter(Boolean),
  );

  // Pick the region pool — fall back to "default" if region unknown or not found
  const regionKey  = ethnicityRegion?.toLowerCase().trim() ?? "default";
  const regionPool = NAME_POOLS[regionKey] ?? NAME_POOLS["default"];

  // Also draw from default pool as a secondary fallback if region pool runs out
  const fullPool = regionKey === "default"
    ? regionPool
    : [...regionPool, ...NAME_POOLS["default"]];

  // De-duplicate (region pool may overlap with default)
  const seen = new Set<string>();
  const pool = fullPool.filter(n => {
    const l = n.toLowerCase();
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });

  // Shuffle and try each name
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  for (const name of shuffled) {
    const handle = name.toLowerCase();
    if (!usedHandles.has(handle)) {
      return { handle, displayName: name };
    }
  }

  // All base names taken — try aesthetic prefixes before numeric fallback
  // Prefer names at the TOP of the region pool (primary names for this region)
  const priorityBase = shuffled[0]; // first shuffled = candidate for collision
  const baseLower    = priorityBase.toLowerCase();

  for (const prefix of AESTHETIC_PREFIXES) {
    const candidate = `${prefix}${baseLower}`;
    if (!usedHandles.has(candidate)) {
      const displayName = `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}${priorityBase}`;
      return { handle: candidate, displayName };
    }
  }

  for (const suf of AESTHETIC_SUFFIXES_AS_PREFIX) {
    const candidate = `${baseLower}${suf}`;
    if (!usedHandles.has(candidate)) {
      return { handle: candidate, displayName: `${priorityBase}${suf.toUpperCase()}` };
    }
  }

  // Last resort: numeric, but keep it clean (2 digits max)
  for (let i = 2; i <= 99; i++) {
    const candidate = `${baseLower}${i}`;
    if (!usedHandles.has(candidate)) {
      return { handle: candidate, displayName: `${priorityBase}${i}` };
    }
  }

  // Absolute fallback — combine two region names
  const combo = `${shuffled[0].toLowerCase()}${shuffled[1]?.toLowerCase().slice(0, 3) ?? "x"}`;
  return { handle: combo, displayName: shuffled[0] + (shuffled[1]?.slice(0, 3) ?? "X") };
}
