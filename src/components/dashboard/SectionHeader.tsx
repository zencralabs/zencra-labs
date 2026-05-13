import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader — section title + optional subtitle + optional right action
// ─────────────────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned content (e.g. a link or button) */
  action?: ReactNode;
  className?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div>
        {/* Title: Syne (font-display) */}
        <h2 className="font-display text-lg font-bold text-white leading-tight">
          {title}
        </h2>
        {/* Subtitle: Familjen Grotesk (font-sans) */}
        {subtitle && (
          <p className="font-sans text-sm text-white/50 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
