#!/usr/bin/env node
/**
 * check-route-dirs.mjs
 *
 * Detects macOS Finder duplicate directories that corrupt Next.js App Router.
 *
 * When Finder copies a folder that already exists it appends " 2" (space-2) to
 * the name. If that happens inside src/app/ Next.js picks up the directory as a
 * real route segment, generating invalid TypeScript in .next/dev/types/routes.d.ts
 * and producing mysterious 404s on the real routes.
 *
 * Run manually:   node scripts/check-route-dirs.mjs
 * Auto-runs via:  predev / prebuild hooks in package.json
 *
 * Exit 0 = clean.  Exit 1 = violations found (lists the paths, tells you to rm).
 */

import { readdirSync, existsSync } from "fs";
import { join, resolve } from "path";

// ── colour helpers ────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[1m${s}\x1b[0m`;
const D = (s) => `\x1b[90m${s}\x1b[0m`;

const ROOT = resolve(import.meta.dirname, "..");

// ── directories to scan ───────────────────────────────────────────────────────
// Scan src/app (routes) and src/components (shared code).
// node_modules and .next are intentionally excluded.
const SCAN_ROOTS = [
  join(ROOT, "src", "app"),
  join(ROOT, "src", "components"),
];

// ── recursive scanner ─────────────────────────────────────────────────────────
function scanDir(dir, violations = []) {
  if (!existsSync(dir)) return violations;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // Permission error etc — skip silently
    return violations;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    // Flag any directory name that contains a space character.
    // This catches " 2", " 3", " copy", " (1)", etc.
    if (entry.name.includes(" ")) {
      violations.push(join(dir, entry.name));
      // Still recurse — there might be nested space-named dirs too.
    }

    scanDir(join(dir, entry.name), violations);
  }

  return violations;
}

// ── run ───────────────────────────────────────────────────────────────────────
console.log(B("\n🔍  Zencra Route Directory Check"));
console.log(D("   Scanning for macOS Finder duplicate folders (\" 2\" etc.) …\n"));

const violations = SCAN_ROOTS.flatMap((root) => scanDir(root));

if (violations.length === 0) {
  console.log(G("✅  Clean — no directories with spaces found.\n"));
  process.exit(0);
}

// ── report violations ─────────────────────────────────────────────────────────
console.error(R(`❌  Found ${violations.length} directory(s) with spaces in their names:`));
console.error(D("   These are macOS Finder duplicates. They silently corrupt"));
console.error(D("   Next.js route types and cause random 404s on real routes.\n"));

for (const v of violations) {
  // Make the path relative to project root for readability
  const rel = v.replace(ROOT + "/", "");
  console.error(`  ${Y("•")} ${rel}`);
}

console.error(`
${B("Fix:")} delete each directory listed above, then clear the Next.js cache:

  ${D("# Example (repeat for each path above):")}
  rm -rf "${violations[0]}"
  rm -rf .next

${D("Then restart the dev server.")}
`);

process.exit(1);
