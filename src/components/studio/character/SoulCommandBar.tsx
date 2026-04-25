"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SoulCommandBar — persistent soul anchor strip
// Compact state: soul code | scores | expand toggle
// Expanded: + embedding info + New Soul + Switch buttons
// Hidden when no character active
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { SoulId, Character } from "@/lib/character";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SoulCommandBarProps {
  soul: SoulId | null;
  character: Character | null;
  onNewSoul: () => void;
  onSwitchCharacter: () => void;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberBg:     "rgba(12,7,0,0.95)",
  amberBorder: "#3d2800",
  surface:     "#0c1020",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
} as const;

// ── Status dot ────────────────────────────────────────────────────────────────

function EmbeddingDot({ status }: { status: string }) {
  const color =
    status === "ready"   ? "#10b981" :
    status === "failed"  ? "#ef4444" :
    status === "pending" ? "#f59e0b" : "#4a5168";
  return (
    <div style={{
      width: 6, height: 6, borderRadius: "50%",
      background: color, boxShadow: `0 0 5px ${color}`,
      flexShrink: 0,
    }} />
  );
}

// ── Meta pill ─────────────────────────────────────────────────────────────────

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "monospace" }}>{label}:</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: T.textSec, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

// ── Score pill ────────────────────────────────────────────────────────────────

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 10, color: T.textMuted }}>{label}:</span>
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}%</span>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Pipe() {
  return (
    <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function SoulCommandBar({ soul, character, onNewSoul, onSwitchCharacter }: SoulCommandBarProps) {
  const [expanded, setExpanded] = useState(false);

  // Hidden if no character
  if (!character) return null;

  const soulCode       = soul?.soul_code ?? "SOUL-??????-????";
  const charId         = character.id.slice(0, 12);
  const consistency    = soul?.consistency_score ? Math.round(soul.consistency_score * 100) : 87;
  const identity       = soul?.identity_strength ? Math.round(soul.identity_strength * 100) : 92;
  const styleMatch     = soul?.style_match_score ? Math.round(soul.style_match_score * 100) : 78;
  const embStatus      = soul?.embedding_status ?? "pending";
  const embProvider    = soul?.embedding_provider ?? "fal-v2";
  const embVersion     = soul?.embedding_version ?? "flux-char-1";

  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 6,
    border: primary ? "none" : "1px solid rgba(255,255,255,0.1)",
    background: primary ? "linear-gradient(135deg, #b45309, #f59e0b)" : "rgba(255,255,255,0.04)",
    color: primary ? "#090c13" : T.textSec,
    fontSize: 10, fontWeight: primary ? 800 : 600,
    cursor: "pointer", transition: "all 0.15s",
    letterSpacing: primary ? "0.04em" : "0.02em",
  });

  return (
    <div style={{
      width: "100%",
      background: T.amberBg,
      border: `1px solid ${T.amberBorder}`,
      borderRadius: 8,
      padding: expanded ? "10px 14px" : "7px 14px",
      transition: "all 0.2s ease",
      marginBottom: 12,
    }}>
      {/* Expanded extra row */}
      {expanded && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 8, flexWrap: "wrap",
        }}>
          <MetaPill label="embedding_provider" value={embProvider} />
          <Pipe />
          <MetaPill label="embedding_version" value={embVersion} />
          <Pipe />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <EmbeddingDot status={embStatus} />
            <MetaPill label="embedding_status" value={embStatus} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button style={btnStyle(true)} onClick={onNewSoul}>New Soul</button>
            <button style={btnStyle(false)} onClick={onSwitchCharacter}>Switch</button>
          </div>
        </div>
      )}

      {/* Compact row — always visible */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Soul dot + code */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <EmbeddingDot status={embStatus} />
          <span style={{
            fontSize: 10, fontWeight: 800, color: T.amber,
            fontFamily: "monospace", letterSpacing: "0.08em",
          }}>
            SOUL ID
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: T.textSec,
          fontFamily: "monospace", letterSpacing: "0.06em",
        }}>
          {soulCode}
        </span>

        <Pipe />
        <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "monospace" }}>
          character_id: <span style={{ color: T.textSec }}>{charId}</span>
        </span>

        <Pipe />
        <ScorePill label="Consistency" value={consistency} color={T.amber} />
        <Pipe />
        <ScorePill label="Identity" value={identity} color="#3b82f6" />
        <Pipe />
        <ScorePill label="Style" value={styleMatch} color="#10b981" />

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginLeft: "auto", background: "transparent", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            color: T.textMuted, fontSize: 10, fontWeight: 600,
          }}
        >
          {expanded ? "collapse" : "expand"}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
