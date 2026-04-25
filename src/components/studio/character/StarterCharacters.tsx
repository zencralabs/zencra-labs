"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StarterCharacters — slim horizontal strip
// Shown only when no character selected
// 3 built-in starters + 1 "Build Your Own" card
// ─────────────────────────────────────────────────────────────────────────────

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StarterCharactersProps {
  onSelectStarter: (name: string, type: string) => void;
  onBuildOwn: () => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.10)",
  amberBorder: "rgba(245,158,11,0.25)",
  surface:     "#0b0e17",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Starters data ─────────────────────────────────────────────────────────────

const STARTERS = [
  {
    name: "Nova Reyes",
    type: "AI Influencer",
    description: "Bold & empowered creator",
    color: "#f59e0b",
  },
  {
    name: "Marcus Veld",
    type: "Brand Avatar",
    description: "Professional, minimal",
    color: "#3b82f6",
  },
  {
    name: "Zara Onyx",
    type: "AI Influencer",
    description: "Edgy editorial aesthetic",
    color: "#a855f7",
  },
];

// ── Starter card ──────────────────────────────────────────────────────────────

function StarterCard({
  name, type, description, color, onUse,
}: {
  name: string; type: string; description: string; color: string;
  onUse: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      padding: "12px 14px", borderRadius: 10,
      border: `1px solid ${T.border}`,
      background: T.surface,
      minWidth: 160, maxWidth: 200,
      transition: "all 0.15s",
      flexShrink: 0,
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}40`;
        (e.currentTarget as HTMLElement).style.background = `${color}08`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = T.border;
        (e.currentTarget as HTMLElement).style.background = T.surface;
      }}
    >
      {/* Avatar placeholder */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: `${color}18`, border: `1px solid ${color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>
        {name}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 3, letterSpacing: "0.04em" }}>
        {type}
      </div>
      <div style={{ fontSize: 10, color: T.textGhost, marginBottom: 10, lineHeight: 1.5 }}>
        {description}
      </div>

      <button
        onClick={onUse}
        style={{
          padding: "5px 10px", borderRadius: 6,
          border: `1px solid ${color}30`,
          background: `${color}12`,
          color, fontSize: 10, fontWeight: 700,
          cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = `${color}25`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = `${color}12`;
        }}
      >
        Use
      </button>
    </div>
  );
}

// ── Build Own card ────────────────────────────────────────────────────────────

function BuildOwnCard({ onBuildOwn }: { onBuildOwn: () => void }) {
  return (
    <button
      onClick={onBuildOwn}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "12px 14px", borderRadius: 10,
        border: `1.5px dashed ${T.border}`,
        background: "transparent",
        minWidth: 140, maxWidth: 160, gap: 8,
        cursor: "pointer", transition: "all 0.15s",
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = T.amberBorder;
        (e.currentTarget as HTMLElement).style.background = T.amberDim;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = T.border;
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: `1px solid ${T.amberBorder}`, background: T.amberDim,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={T.amber} strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>Build Your Own</div>
        <div style={{ fontSize: 10, color: T.textGhost, lineHeight: 1.5, marginTop: 2 }}>
          Custom identity from scratch
        </div>
      </div>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function StarterCharacters({ onSelectStarter, onBuildOwn }: StarterCharactersProps) {
  return (
    <div style={{
      width: "100%",
      padding: "12px 0 16px",
      borderBottom: `1px solid ${T.border}`,
      marginBottom: 12,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textMuted,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Starters — Ready to Use
        </div>
        <button style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 11, color: T.amber, fontWeight: 600,
        }}>
          View all →
        </button>
      </div>

      <div style={{
        display: "flex", gap: 10, overflowX: "auto",
        paddingBottom: 4, scrollbarWidth: "none",
      }}>
        {STARTERS.map(s => (
          <StarterCard
            key={s.name}
            name={s.name}
            type={s.type}
            description={s.description}
            color={s.color}
            onUse={() => onSelectStarter(s.name, s.type)}
          />
        ))}
        <BuildOwnCard onBuildOwn={onBuildOwn} />
      </div>
    </div>
  );
}
