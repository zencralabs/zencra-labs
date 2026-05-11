// ─────────────────────────────────────────────────────────────────────────────
// formatHandle — pure client-safe utility
//
// Kept separate from name-generator.ts (which imports supabaseAdmin) so that
// client components can import this without pulling the service role key into
// the browser bundle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a raw handle for display.
 * "nova"            → "@Nova"
 * "zara_mpoxu5rt"   → "@Zara"   (strips legacy random suffix)
 * null              → "@Creator"
 *
 * Legacy handles from an older implementation have the form `name_xxxxxxx`
 * where the suffix is 4–10 lowercase alphanumeric chars. We strip that suffix
 * at display time while the DB cleanup migration removes it at the source.
 */
export function formatHandle(handle: string | null | undefined): string {
  if (!handle) return "@Creator";
  let clean = handle.replace(/^@/, "");
  // Strip legacy random suffix: word_[a-z0-9]{4,10}
  const legacySuffix = /^([a-z]+)_[a-z0-9]{4,10}$/i;
  const match = clean.match(legacySuffix);
  if (match) clean = match[1];
  return `@${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}
