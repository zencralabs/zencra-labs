// ─────────────────────────────────────────────────────────────────────────────
// formatHandle — pure client-safe utility
//
// Kept separate from name-generator.ts (which imports supabaseAdmin) so that
// client components can import this without pulling the service role key into
// the browser bundle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a raw handle for display.
 * "nova" → "@Nova"  |  null → "@Unknown"
 */
export function formatHandle(handle: string | null | undefined): string {
  if (!handle) return "@Creator";
  const clean = handle.replace(/^@/, "");
  return `@${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}
