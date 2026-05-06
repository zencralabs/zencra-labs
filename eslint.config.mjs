import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ── Security guardrails ───────────────────────────────────────────────────────
//
// These rules enforce the server/client boundary for the Supabase admin client.
// The admin client uses the SERVICE ROLE KEY — it bypasses all RLS policies.
// It must NEVER be imported into client components, hooks, or context providers.
//
// Allowed locations: src/app/api/**, src/lib/auth/**, src/lib/**
// Blocked locations: src/components/**, src/hooks/**, src/contexts/**
//
// Violating this sends the service role key to the browser bundle, which would
// expose every row in the database to any user who opens DevTools.

const ADMIN_CLIENT_PATH = "@/lib/supabase/admin";

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
            name: ADMIN_CLIENT_PATH,
            message:
              "The Supabase admin client (service role key) must NOT be imported in " +
              "client components, hooks, or context providers. Use it only in " +
              "API routes (src/app/api/**) or server-only libs (src/lib/auth/**).",
          },
        ],
      },
    ],
  },
};

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**"],
  },
  securityGuardrails,
];

export default config;
