"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterCanvas — dominant center canvas for Character Studio
// States: empty | generating | result
// Design: amber-tinted shimmer, version badge, hover action buttons
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { CharacterMode, Character, SoulId, CharacterVersion } from "@/lib/character";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  surface:      "#0b0e17",
  border:       "#1a2035",
  borderAmber:  "#3d2800",
  amber:        "#f59e0b",
  amberGlow:    "rgba(245,158,11,0.25)",
  textPrimary:  "#e8eaf0",
  textSec:      "#8b92a8",
  textMuted:    "#4a5168",
  textGhost:    "#3d4560",
} as const;

// ── Corner accents ─────────────────────────────────────────────────────────────

function CornerAccents() {
  const s: React.CSSProperties = {
    position: "absolute", width: 16, height: 16, pointerEvents: "none",
  };
  const line = "1.5px solid rgba(245,158,11,0.22)";
  return (
    <>
      <div style={{ ...s, top: 8, left: 8, borderTop: line, borderLeft: line, borderTopLeftRadius: 3 }} />
      <div style={{ ...s, top: 8, right: 8, borderTop: line, borderRight: line, borderTopRightRadius: 3 }} />
      <div style={{ ...s, bottom: 8, left: 8, borderBottom: line, borderLeft: line, borderBottomLeftRadius: 3 }} />
      <div style={{ ...s, bottom: 8, right: 8, borderBottom: line, borderRight: line, borderBottomRightRadius: 3 }} />
    </>
  );
}

// ── Generating shimmer ────────────────────────────────────────────────────────

function GeneratingOverlay() {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(9,12,19,0.85)",
      backdropFilter: "blur(6px)",
      borderRadius: "inherit",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      {/* Amber sweep line top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.7), transparent)",
        animation: "ccSweep 2.2s ease-in-out infinite",
      }} />

      {/* Amber pulse bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 44 }}>
        {[0.45, 0.75, 0.55, 0.90, 0.65, 0.80, 0.50, 0.85, 0.60].map((h, i) => (
          <div key={i} style={{
            width: 4, borderRadius: 2,
            height: `${h * 100}%`,
            background: `linear-gradient(to top, rgba(180,83,9,0.6), #f59e0b)`,
            animation: `ccBar ${0.75 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${(i * 0.08).toFixed(2)}s`,
            boxShadow: "0 0 8px rgba(245,158,11,0.3)",
          }} />
        ))}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 5 }}>
          Building your character…
        </div>
        <div style={{ fontSize: 12, color: T.textMuted }}>
          Soul ID embedding in progress
        </div>
      </div>

      <div style={{ width: 160, height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: "40%",
          background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.9), transparent)",
          animation: "ccShimmer 1.6s ease-in-out infinite", borderRadius: 2,
        }} />
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(180,83,9,0.4), transparent)",
        animation: "ccSweep 2.2s ease-in-out infinite", animationDirection: "reverse" }} />

      <style>{`
        @keyframes ccSweep   { 0%{backgroundPosition:-200% 0} 100%{backgroundPosition:200% 0} }
        @keyframes ccBar     { from{transform:scaleY(0.5)} to{transform:scaleY(1)} }
        @keyframes ccShimmer { 0%{transform:translateX(-200%)} 100%{transform:translateX(400%)} }
      `}</style>
    </div>
  );
}

// ── Empty state silhouette ────────────────────────────────────────────────────

function EmptyCanvas() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      width: "100%", height: "100%", gap: 16,
    }}>
      {/* Animated silhouette placeholder */}
      <div style={{
        width: 80, height: 100, position: "relative",
        opacity: 0.18,
        animation: "ccPulse 3s ease-in-out infinite",
      }}>
        <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="40" cy="22" r="16" stroke="#f59e0b" strokeWidth="1.5" />
          <path d="M10 90 C10 65 30 52 40 52 C50 52 70 65 70 90" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <style>{`
          @keyframes ccPulse { 0%,100%{opacity:0.14} 50%{opacity:0.24} }
        `}</style>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>
          No character selected
        </div>
        <div style={{ fontSize: 12, color: T.textGhost, maxWidth: 200, lineHeight: 1.6 }}>
          Select a starter or build your own character to begin
        </div>
      </div>
    </div>
  );
}

// ── Version badge ────────────────────────────────────────────────────────────

function VersionBadge({ version }: { version: CharacterVersion }) {
  const modeLabel = version.version_name ?? (version.mode ?? "base") + " v" + version.id.slice(-2);
  return (
    <div style={{
      position: "absolute", top: 12, left: 12, zIndex: 10,
      padding: "3px 10px", borderRadius: 20,
      background: "rgba(9,12,19,0.85)",
      border: "1px solid rgba(245,158,11,0.3)",
      fontSize: 10, fontWeight: 700, color: "#f59e0b",
      letterSpacing: "0.06em", textTransform: "uppercase",
      backdropFilter: "blur(8px)",
    }}>
      {modeLabel}
    </div>
  );
}

// ── Version switcher ──────────────────────────────────────────────────────────

function VersionSwitcher({
  versions, activeVersionId, onSelect,
}: {
  versions: CharacterVersion[];
  activeVersionId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = versions.find(v => v.id === activeVersionId) ?? versions[0];
  if (!active || versions.length < 2) return null;

  return (
    <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button style={{
        padding: "4px 10px", borderRadius: 8,
        background: "rgba(9,12,19,0.88)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: T.textSec, fontSize: 11, fontWeight: 600,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
      }}>
        Versions ({versions.length})
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, paddingTop: 4,
          minWidth: 160, zIndex: 50,
        }}>
          <div style={{
            background: "rgba(9,12,19,0.97)", border: "1px solid #1a2035",
            borderRadius: 10, padding: 4,
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
            backdropFilter: "blur(16px)",
          }}>
            {versions.map(v => {
              const isCur = v.id === activeVersionId;
              const label = v.version_name ?? (v.mode ?? "base");
              return (
                <button key={v.id}
                  onClick={() => { onSelect(v.id); setOpen(false); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "7px 12px", borderRadius: 6, border: "none",
                    background: isCur ? "rgba(245,158,11,0.12)" : "transparent",
                    color: isCur ? "#f59e0b" : T.textSec,
                    fontSize: 12, fontWeight: isCur ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Result hover actions ──────────────────────────────────────────────────────

const MODE_ACTIONS: CharacterMode[] = ["refine", "lookbook", "scene", "motion"];
const MODE_LABELS: Record<string, string> = {
  refine: "Refine", lookbook: "Lookbook", scene: "Scene", motion: "Animate",
};

function ResultOverlay({
  mode, onModeAction,
}: {
  mode: CharacterMode;
  onModeAction: (m: CharacterMode) => void;
}) {
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
      background: "linear-gradient(to top, rgba(9,12,19,0.92) 0%, transparent 100%)",
      padding: "40px 16px 16px",
      display: "flex", gap: 8, justifyContent: "center",
      transition: "opacity 0.2s",
    }}>
      {MODE_ACTIONS.map(m => (
        <button key={m}
          onClick={() => onModeAction(m)}
          style={{
            padding: "7px 14px", borderRadius: 8,
            border: mode === m ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
            background: mode === m ? "rgba(245,158,11,0.18)" : "rgba(9,12,19,0.7)",
            color: mode === m ? "#f59e0b" : T.textSec,
            fontSize: 12, fontWeight: mode === m ? 700 : 500,
            cursor: "pointer", transition: "all 0.15s",
            backdropFilter: "blur(8px)",
          }}
        >
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CharacterCanvasProps {
  mode: CharacterMode;
  character: Character | null;
  soul: SoulId | null;
  isGenerating: boolean;
  versions: CharacterVersion[];
  activeVersionId: string | null;
  onModeAction: (mode: CharacterMode) => void;
  onVersionSelect: (versionId: string) => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterCanvas({
  mode, character, isGenerating,
  versions, activeVersionId,
  onModeAction, onVersionSelect,
}: CharacterCanvasProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const activeVersion = versions.find(v => v.id === activeVersionId) ?? versions[0] ?? null;
  const hasResult = !!activeVersion?.asset_id;

  const canvasGlow = [
    "0 0 0 1px rgba(255,255,255,0.05)",
    "0 0 40px rgba(245,158,11,0.08)",
    "0 0 80px rgba(245,158,11,0.04)",
    "0 16px 64px rgba(0,0,0,0.8)",
  ].join(", ");

  return (
    <div
      style={{
        position: "relative", width: "100%",
        aspectRatio: "3 / 4",
        minHeight: 400,
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        background: T.surface,
        boxShadow: canvasGlow,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
    >
      {/* Subtle radial amber glow center */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 60% 50% at 50% 48%, rgba(245,158,11,0.04) 0%, transparent 100%)",
        borderRadius: "inherit",
      }} />

      {/* Inner dashed frame */}
      <div style={{
        position: "absolute", inset: 8, borderRadius: 10,
        border: "1px dashed rgba(255,255,255,0.07)",
        pointerEvents: "none", zIndex: 1,
      }} />

      <CornerAccents />

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", alignItems: "stretch",
        justifyContent: "center", position: "relative", zIndex: 2,
      }}>
        {isGenerating ? (
          <>
            {hasResult && (
              <div style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
                <div style={{
                  width: "100%", height: "100%",
                  background: "rgba(245,158,11,0.04)",
                }} />
              </div>
            )}
            <GeneratingOverlay />
          </>
        ) : hasResult ? (
          <>
            {/* In a real app this shows the actual character image */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(135deg, #0b0e17 0%, #0c1020 50%, #090c13 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ opacity: 0.15 }}>
                <svg viewBox="0 0 80 100" width="80" height="100" fill="none">
                  <circle cx="40" cy="22" r="16" stroke="#f59e0b" strokeWidth="1.5" />
                  <path d="M10 90 C10 65 30 52 40 52 C50 52 70 65 70 90" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{
                position: "absolute", bottom: "35%",
                fontSize: 12, color: T.textMuted, textAlign: "center",
              }}>
                Character image will render here
              </div>
            </div>
            {activeVersion && <VersionBadge version={activeVersion} />}
            <VersionSwitcher
              versions={versions}
              activeVersionId={activeVersionId}
              onSelect={onVersionSelect}
            />
            {showOverlay && <ResultOverlay mode={mode} onModeAction={onModeAction} />}
          </>
        ) : character ? (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            width: "100%", height: "100%", gap: 12,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              border: "1px solid rgba(245,158,11,0.2)",
              background: "rgba(245,158,11,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                <path d="M20 21a8 8 0 1 0-16 0" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 4 }}>
                {character.name}
              </div>
              <div style={{ fontSize: 12, color: T.textGhost }}>
                Complete the builder steps to generate
              </div>
            </div>
          </div>
        ) : (
          <EmptyCanvas />
        )}
      </div>
    </div>
  );
}
