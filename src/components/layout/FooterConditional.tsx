"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FooterConditional — hides footer on app-workspace routes (studio/*)
// Keeps Footer rendered in the tree but invisible on workspace routes so
// the shell can own its own viewport without page scroll.
// ─────────────────────────────────────────────────────────────────────────────

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/Footer";

/** Routes that behave as full-height app workspaces — no footer. */
const WORKSPACE_PREFIXES = ["/studio"];

export function FooterConditional() {
  const pathname = usePathname();
  const isWorkspace = WORKSPACE_PREFIXES.some(p => pathname.startsWith(p));
  if (isWorkspace) return null;
  return <Footer />;
}
