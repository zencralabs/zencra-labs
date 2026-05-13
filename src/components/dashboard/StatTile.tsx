import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// StatTile — single-stat display primitive (label + value + optional icon)
// ─────────────────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  /**
   * CSS color string used to tint the icon box background.
   * Applied at 12% opacity via hex alpha suffix (e.g. "#2563EB" → "#2563EB1F").
   */
  accentColor?: string;
  className?: string;
}

export default function StatTile({
  label,
  value,
  icon,
  accentColor,
  className = "",
}: StatTileProps) {
  // Hex alpha for ~12% opacity: 0.12 × 255 ≈ 31 = 0x1F
  const iconBg = accentColor ? `${accentColor}1F` : "rgba(255,255,255,0.06)";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {icon && (
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center self-end"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
      )}
      {/* Value uses Syne (font-display) for cinematic weight */}
      <div className="font-display text-2xl font-bold text-white leading-none">
        {value}
      </div>
      {/* Label uses Familjen Grotesk (font-sans) */}
      <div className="font-sans text-xs text-white/50 leading-snug">
        {label}
      </div>
    </div>
  );
}
