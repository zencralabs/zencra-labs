"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// ThemeToggle – Light / Dark mode switch button
// Uses next-themes to persist the user's preference in localStorage.
// The "mounted" check prevents a hydration mismatch flash.
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch – render only after mount
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 w-9 rounded-lg border border-border bg-muted",
          className
        )}
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg",
        "border border-border",
        "bg-card text-foreground",
        "transition-all duration-200",
        "hover:border-electric-600 hover:text-electric-600",
        "dark:hover:border-electric-400 dark:hover:text-electric-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-600",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun size={16} strokeWidth={2} />
      ) : (
        <Moon size={16} strokeWidth={2} />
      )}
    </button>
  );
}
