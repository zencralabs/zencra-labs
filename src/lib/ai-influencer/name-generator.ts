// ─────────────────────────────────────────────────────────────────────────────
// AI Influencer Name Generator — Region-Aware
//
// Rule: handles are ALWAYS a single clean name — @Zara, @Gabriela, @Maya.
// NEVER: @heyzara, @realzara, @zara_mpoxu5rt, @zara2, @zara_abc123.
//
// Collision strategy (in priority order):
//   1. Pick a different name from the same region pool (shuffled).
//   2. Draw from the combined global pool (all regions merged, deduped).
//   3. Try the overflow list — curated premium single-word names.
//   4. Append a single digit 2–9 (clean, last resort only).
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

// ── Overflow names — used when all region + global pool names are taken ───────
// Extra curated single-word names, no prefixes, no suffixes. Always clean.
const OVERFLOW_NAMES: string[] = [
  "Zephyr", "Blaze", "Onyx", "Raven", "Indigo", "Slate", "Pearl",
  "Onyx", "Coral", "Opal", "Flint", "Ashen", "Briar", "Cedar",
  "Dusk", "Frost", "Gale", "Haze", "Isle", "Jet", "Knox", "Lake",
  "Moss", "Night", "Oak", "Pine", "Reef", "Silt", "Teal", "Vale",
  "Wave", "Yew", "Zeal", "Brine", "Cyan", "Dune", "Glen", "Hawk",
  "Lark", "Mist", "Quill", "Rush", "Thorn", "Umber", "Volt", "West",
];

// ── Build the combined global pool (all names, deduped) ───────────────────────
function buildGlobalPool(): string[] {
  const seen = new Set<string>();
  const all: string[] = [];
  for (const pool of Object.values(NAME_POOLS)) {
    for (const name of pool) {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        all.push(name);
      }
    }
  }
  return all;
}

const GLOBAL_POOL = buildGlobalPool(); // built once at module load

// ── Shuffle helper ────────────────────────────────────────────────────────────
function shuffled<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ── Generate a unique handle for a user ──────────────────────────────────────

/**
 * Picks a region-appropriate name and ensures it's unique for this user.
 *
 * Collision strategy: try more names from the same region pool, then the
 * global pool, then the overflow list, then a single clean digit suffix (2–9).
 * NEVER: prefixes (hey/real/its), underscores, random hashes, timestamps.
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

  // ── PASS 1: Region pool ───────────────────────────────────────────────────
  const regionKey  = ethnicityRegion?.toLowerCase().trim() ?? "default";
  const regionPool = NAME_POOLS[regionKey] ?? NAME_POOLS["default"];

  for (const name of shuffled(regionPool)) {
    const handle = name.toLowerCase();
    if (!usedHandles.has(handle)) {
      return { handle, displayName: name };
    }
  }

  // ── PASS 2: Global pool (all regions merged) ──────────────────────────────
  for (const name of shuffled(GLOBAL_POOL)) {
    const handle = name.toLowerCase();
    if (!usedHandles.has(handle)) {
      return { handle, displayName: name };
    }
  }

  // ── PASS 3: Overflow curated names ───────────────────────────────────────
  for (const name of shuffled(OVERFLOW_NAMES)) {
    const handle = name.toLowerCase();
    if (!usedHandles.has(handle)) {
      return { handle, displayName: name };
    }
  }

  // ── PASS 4: Single-digit suffix (2–9) — absolute last resort ─────────────
  // Still a clean look: @Zara2 is readable; @zara_k8x3 is not.
  // Pick the first available name from the region pool as the base.
  const base = shuffled(regionPool)[0] ?? "Nova";
  const baseLower = base.toLowerCase();
  for (let i = 2; i <= 9; i++) {
    const candidate = `${baseLower}${i}`;
    if (!usedHandles.has(candidate)) {
      return { handle: candidate, displayName: `${base}${i}` };
    }
  }

  // ── PASS 5: Expand to two-digit suffix (10–99) ───────────────────────────
  for (let i = 10; i <= 99; i++) {
    const candidate = `${baseLower}${i}`;
    if (!usedHandles.has(candidate)) {
      return { handle: candidate, displayName: `${base}${i}` };
    }
  }

  // This should be practically unreachable (200+ names + 98 numeric variants).
  // Combine two region names as an extreme fallback — still no underscore/prefix.
  const second = shuffled(GLOBAL_POOL).find(n => n.toLowerCase() !== baseLower) ?? "Lyra";
  return {
    handle:      `${baseLower}${second.toLowerCase().slice(0, 3)}`,
    displayName: `${base}${second.slice(0, 3)}`,
  };
}
