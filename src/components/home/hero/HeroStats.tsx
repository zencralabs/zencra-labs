"use client";

/**
 * HeroStats
 *
 * A 4-column glass grid displaying social-proof numbers.
 * Sharp edges (no border-radius) — matches the Zencra minimal/premium aesthetic.
 *
 * Stats:
 *   2.5M+ Creations | 120K+ Creators | 4.9 Rating | Enterprise Ready
 */

const STATS = [
  { value: "2.5M+",       label: "Creations" },
  { value: "120K+",       label: "Creators" },
  { value: "4.9",         label: "Rating" },
  { value: "Enterprise",  label: "Ready" },
] as const;

export function HeroStats() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        /* 1px gap creates the illusion of dividers against the outer border */
        gap: "1px",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.08)",
        width: "100%",
        maxWidth: "640px",
        /* Responsive horizontal padding so it doesn't stretch too wide on mobile */
        margin: "0 24px",
      }}
    >
      {STATS.map((stat) => (
        <div
          key={stat.label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            padding: "18px 10px",
            background: "rgba(5,5,9,0.65)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Metric */}
          <span
            style={{
              fontSize: "clamp(15px, 1.8vw, 22px)",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.03em",
              lineHeight: 1,
              whiteSpace: "nowrap" as const,
            }}
          >
            {stat.value}
          </span>

          {/* Label */}
          <span
            style={{
              fontSize: "10px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.38)",
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
            }}
          >
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
