"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ThemeProvider
// Wraps the app with next-themes for light/dark mode support.
// The `attribute="class"` option adds/removes "dark" class on <html>,
// which is exactly what Tailwind's darkMode: "class" expects.
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      forcedTheme="dark"         // Zencra is dark-only — cinematic video platform
      enableSystem={false}       // Never inherit OS preference
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
