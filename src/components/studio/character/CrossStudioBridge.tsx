"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CrossStudioBridge — route character to Image/Video/Audio studio
// Builds query params with character_id + soul_id + mode
// ─────────────────────────────────────────────────────────────────────────────

import { useRouter } from "next/navigation";
import type { Character, SoulId, CharacterMode } from "@/lib/character";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CrossStudioBridgeProps {
  character: Character | null;
  soul: SoulId | null;
  activeMode: CharacterMode;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.08)",
  amberBorder: "rgba(245,158,11,0.2)",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Studio bridge button ──────────────────────────────────────────────────────

function BridgeButton({
  label, href, disabled, color,
}: {
  label: string; href: string; disabled: boolean; color: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => !disabled && router.push(href)}
      disabled={disabled}
      style={{
        padding: "9px 16px", borderRadius: 9,
        border: disabled ? `1px solid ${T.border}` : `1px solid ${color}30`,
        background: disabled ? "transparent" : `${color}0a`,
        color: disabled ? T.textGhost : color,
        fontSize: 12, fontWeight: disabled ? 400 : 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        display: "flex", alignItems: "center", gap: 6,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background = `${color}18`;
          (e.currentTarget as HTMLElement).style.borderColor = `${color}50`;
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background = `${color}0a`;
          (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
        }
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
      {label}
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CrossStudioBridge({ character, soul, activeMode }: CrossStudioBridgeProps) {
  const hasCharacter = !!character;

  function buildUrl(studio: string) {
    if (!character) return `/${studio}`;
    const params = new URLSearchParams({
      character_id: character.id,
      ...(soul ? { soul_id: soul.id } : {}),
      mode: activeMode,
    });
    return `/studio/${studio}?${params.toString()}`;
  }

  return (
    <div style={{
      width: "100%",
      padding: "12px 0",
      borderTop: `1px solid ${T.border}`,
      marginTop: 8,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: T.textGhost,
        letterSpacing: "0.1em", textTransform: "uppercase",
        marginBottom: 10,
      }}>
        Use this character in:
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <BridgeButton
          label="Image Studio"
          href={buildUrl("image")}
          disabled={!hasCharacter}
          color="#2563eb"
        />
        <BridgeButton
          label="Video Studio"
          href={buildUrl("video")}
          disabled={!hasCharacter}
          color="#0ea5a0"
        />
        <button
          disabled
          style={{
            padding: "9px 16px", borderRadius: 9,
            border: `1px solid ${T.border}`,
            background: "transparent",
            color: T.textGhost,
            fontSize: 12, fontWeight: 400,
            cursor: "not-allowed",
            display: "flex", alignItems: "center", gap: 6,
            opacity: 0.45,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
          Audio Studio
          <span style={{
            fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
            background: "rgba(245,158,11,0.12)", color: T.amber,
            border: "1px solid rgba(245,158,11,0.2)", letterSpacing: "0.06em",
          }}>
            SOON
          </span>
        </button>
      </div>
    </div>
  );
}
