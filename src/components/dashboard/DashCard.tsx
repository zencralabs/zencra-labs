import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DashCard — base card primitive for dashboard panels
// ─────────────────────────────────────────────────────────────────────────────

interface DashCardProps {
  children: ReactNode;
  className?: string;
  /** Enable lift-on-hover transform. Default: true */
  hover?: boolean;
}

export default function DashCard({ children, className = "", hover = true }: DashCardProps) {
  const base =
    "bg-background border border-white/[0.06] rounded-[14px] p-5";
  const hoverClass = hover
    ? "transition-transform duration-150 hover:-translate-y-0.5 hover:border-white/[0.1]"
    : "";

  return (
    <div className={[base, hoverClass, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
