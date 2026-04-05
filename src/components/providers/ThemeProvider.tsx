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
      defaultTheme="dark"        // Default to dark (Zencra's primary look)
      enableSystem={true}        // Respect OS preference on first visit
      disableTransitionOnChange  // Prevent flash on theme switch
    >
      {children}
    </NextThemesProvider>
  );
}
