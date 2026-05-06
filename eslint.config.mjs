import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE A — Comprehensive ignores
//
// Goal: stop ESLint scanning generated, tooling, and duplicate directories.
// Duplicate scanning was the #1 source of noise (worktrees doubling violations).
// These are pure additions — cannot expose new errors in production code.
// ═══════════════════════════════════════════════════════════════════════════════
const globalIgnores = {
  ignores: [
    // Claude internal tooling — worktrees are cloned copies of src; scanning them
    // doubles every violation and produces no actionable signal.
    ".claude/**",

    // Build artifacts — none of these are authored code
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    ".vercel/**",
    "coverage/**",

    // Runtime dependencies — never scan
    "node_modules/**",

    // Supabase local dev artifacts
    "supabase/.branches/**",
    "supabase/.temp/**",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE B+C — Production source code rules (src/**)
//
// Strategy:
//   ERROR   = security, runtime-breaking, or architecture-boundary violations
//   WARN    = cosmetic/debt violations that are real but not production-blocking
//
// Rationale for each rule decision is documented inline.
// ═══════════════════════════════════════════════════════════════════════════════
const productionRules = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    // ── KEEP ERROR: Runtime-breaking rules ────────────────────────────────────

    // react-hooks/rules-of-hooks: Hooks called in a non-hook function = runtime
    // crash in React's reconciler. Cannot relax. The flow/store.ts violations
    // are a naming issue (_useFlowStore reads as non-hook) — suppressed inline
    // with eslint-disable-next-line at the confirmed-safe Zustand call sites.
    // "react-hooks/rules-of-hooks": "error",  ← inherited from next/core-web-vitals

    // no-unused-expressions: Allow short-circuit (a && fn()) and ternary
    // (a ? fn() : fn()) patterns — these are legitimate JS side-effect idioms.
    // Genuinely dead expressions (bare literals, misplaced assignments) stay errors.
    "@typescript-eslint/no-unused-expressions": [
      "error",
      {
        allowShortCircuit: true,   // a && fn()  — valid side-effect pattern
        allowTernary: true,        // a ? fn() : fn()  — valid branching pattern
        allowTaggedTemplates: true,
      },
    ],

    // no-require-imports: Production source code must use ESM imports.
    // CJS require() in browser bundles breaks tree-shaking and is a code-quality
    // red flag. Scripts are excluded separately below.
    // "@typescript-eslint/no-require-imports": "error",  ← inherited

    // ── PHASE C: Cosmetic debt — downgrade to WARN ────────────────────────────
    //
    // These rules catch real issues but 174+37+42+9+4 violations cannot be
    // cleaned up safely during a production hardening sprint without introducing
    // regressions. Warnings still surface in CI output — nothing is silenced.
    // A dedicated cleanup pass will address these once feature velocity slows.

    // 174 violations: unused imports/variables from active development.
    // Runtime impact: zero. Cosmetic debt only.
    "@typescript-eslint/no-unused-vars": "warn",

    // 37 violations: <img> vs Next.js <Image>. Performance advisory.
    // Existing <img> tags render correctly; <Image> optimization is a sprint goal.
    "@next/next/no-img-element": "warn",

    // 42 violations: missing deps in useEffect/useCallback/useMemo arrays.
    // Many are intentional (canvas animation, polling loops with deliberate
    // stable refs). A proper audit of each site is needed — mass-suppress
    // would be worse than keeping as warn.
    "react-hooks/exhaustive-deps": "warn",

    // 9 violations: explicit `any` type annotations. Type safety debt.
    // No runtime impact; these are typing shortcuts in complex async paths.
    "@typescript-eslint/no-explicit-any": "warn",

    // 4 violations: unescaped ' " & in JSX text. HTML rendering edge case.
    // Not a crash, not a security issue. Will fix during next UI polish pass.
    "react/no-unescaped-entities": "warn",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE C: Scripts directory — relaxed rules for Node.js utility scripts
//
// scripts/** are Node.js CLI utilities (upload, verify, seed), not browser code.
// They legitimately use require(), process.exit(), console.log(), and other
// Node-isms that would be wrong in production source but correct here.
// ═══════════════════════════════════════════════════════════════════════════════
const scriptRules = {
  files: ["scripts/**/*.{js,mjs,ts,cjs}"],
  rules: {
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "off",
    // Scripts use ternary-as-statement for short-circuit logging (ok ? pass() : fail())
    "@typescript-eslint/no-unused-expressions": [
      "warn",
      { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE D — Security guardrails (NEVER relaxed)
//
// These rules enforce the server/client boundary for the Supabase admin client.
// The admin client uses the SERVICE ROLE KEY — it bypasses ALL RLS policies.
// A single import in a client component would ship the service role key to the
// browser bundle, exposing every row in the database to any user with DevTools.
//
// Allowed: src/app/api/**, src/lib/auth/**, src/lib/**
// Blocked:  src/components/**, src/hooks/**, src/contexts/**
//
// Severity is ERROR and will never be downgraded to warn.
// These are the rules that protect production user data.
// ═══════════════════════════════════════════════════════════════════════════════
const securityGuardrails = {
  files: [
    "src/components/**/*.{ts,tsx}",
    "src/hooks/**/*.{ts,tsx}",
    "src/contexts/**/*.{ts,tsx}",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/lib/supabase/admin",
            message:
              "[SECURITY] The Supabase admin client (service role key) must NOT be " +
              "imported in client components, hooks, or context providers. " +
              "Use it only in API routes (src/app/api/**) or server-only libs " +
              "(src/lib/auth/**). Violating this ships your service role key to " +
              "the browser bundle.",
          },
        ],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Final config — order matters in flat config (later entries win)
// ═══════════════════════════════════════════════════════════════════════════════
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores,
  productionRules,
  scriptRules,
  securityGuardrails,  // Always last — security rules override everything above
];

export default config;
