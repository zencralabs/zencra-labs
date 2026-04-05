import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ─────────────────────────────────────────────────────────────────────────────
// cn() – Class Name Utility
// Merges Tailwind classes safely, resolving conflicts intelligently.
// Usage: cn("px-4 py-2", condition && "bg-blue-500", "px-6")
// → "py-2 bg-blue-500 px-6" (px-4 is overridden by px-6)
// ─────────────────────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────────────────────
// formatDate() – Consistent date formatting across the app
// ─────────────────────────────────────────────────────────────────────────────
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

// ─────────────────────────────────────────────────────────────────────────────
// truncate() – Truncate long strings with ellipsis
// ─────────────────────────────────────────────────────────────────────────────
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}
