"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterCanvas — cinematic hero stage (Phase 3C upgrade)
// States: empty | generating | result
// Design: full-bleed, floating overview card, hover action bar
// Props interface UNCHANGED — safe visual upgrade only
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { CharacterMode, Character, SoulId, CharacterVersion } from "@/lib/character";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  surface:      "#090c13",
  surfaceUp:    "#0b0e17",
  border:       "rgba(255,255,255,0.07)",
  borderAmber:  "rgba(245,158,11,0.3)",
  amber:        "#f59e0b",
  amberGlow:    "rgba(245,158,11,0.18)",
  amberSoft:    "rgba(245,158,11,0.08)",
  textPrimary:  "#e8eaf0",
  textSec:      "#8b92a8",
  textMuted:    "#4a5168",
  textGhost:    "#3d4560",
} as const;

// ── Mode tag definitions ──────────────────────────────────────────────────────

const VISUAL_TAGS: string[] = ["Cinematic", "Editorial", "Portrait", "High-Fidelity"];

// ── Keyframe injection ────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes ccSweep    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes ccBar      { from{transform:scaleY(0.45)} to{transform:scaleY(1)} }
@keyframes ccShimmer  { 0%{transform:translateX(-200%)} 100%{transform:translateX(400%)} }
@keyframes ccFadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes ccPulse    { 0%,100%{opacity:0.32} 50%{opacity:0.55} }
@keyframes ccGlow     { 0%,100%{box-shadow:0 0 20px rgba(245,158,11,0.08)} 50%{box-shadow:0 0 40px rgba(245,158,11,0.18)} }
`;

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyStage() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      width: "100%", height: "100%", gap: 20,
      animation: "ccFadeUp 0.5s ease forwards",
    }}>
      <style>{KEYFRAMES}</style>
      {/* Silhouette */}
      <div style={{
        width: 100, height: 128, position: "relative",
        opacity: 0.42,
        animation: "ccPulse 3.5s ease-in-out infinite",
      }}>
        <svg viewBox="0 0 100 128" fill="none" xmlns="http://www.w3.org/2000/svg" width="100" height="128">
          {/* Head */}
          <circle cx="50" cy="30" r="22" stroke="#f59e0b" strokeWidth="1.5" />
          {/* Shoulders */}
          <path d="M8 118 C8 82 28 65 50 65 C72 65 92 82 92 118"
            stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
          {/* Neck */}
          <path d="M42 52 L42 65 M58 52 L58 65"
            stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        </svg>
      </div>

      {/* Text */}
      <div style={{ textAlign: "center", maxWidth: 240 }}>
        <div style={{
          fontSize: 20, fontWeight: 700, color: T.textPrimary,
          marginBottom: 8, letterSpacing: "-0.02em",
        }}>
          Create your character
        </div>
        <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.7 }}>
          Select a starter or build your own
          <br />identity from scratch
        </div>
      </div>

      {/* Corner decorators */}
      <div style={{ position: "absolute", top: 14, left: 14, width: 18, height: 18,
        borderTop: "1px solid rgba(245,158,11,0.18)", borderLeft: "1px solid rgba(245,158,11,0.18)",
        borderTopLeftRadius: 3, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 14, right: 14, width: 18, height: 18,
        borderTop: "1px solid rgba(245,158,11,0.18)", borderRight: "1px solid rgba(245,158,11,0.18)",
        borderTopRightRadius: 3, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 14, left: 14, width: 18, height: 18,
        borderBottom: "1px solid rgba(245,158,11,0.18)", borderLeft: "1px solid rgba(245,158,11,0.18)",
        borderBottomLeftRadius: 3, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 14, right: 14, width: 18, height: 18,
        borderBottom: "1px solid rgba(245,158,11,0.18)", borderRight: "1px solid rgba(245,158,11,0.18)",
        borderBottomRightRadius: 3, pointerEvents: "none" }} />
    </div>
  );
}

// ── Generating shimmer ────────────────────────────────────────────────────────

function GeneratingStage() {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      background: "rgba(9,12,19,0.88)",
      backdropFilter: "blur(8px)",
      borderRadius: "inherit",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 22,
    }}>
      <style>{KEYFRAMES}</style>
      {/* Top sweep */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.8) 50%, transparent 100%)",
        animation: "ccSweep 2.4s ease-in-out infinite",
      }} />

      {/* Pulse bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48 }}>
        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.85, 0.55, 0.8, 0.65].map((h, i) => (
          <div key={i} style={{
            width: 4, borderRadius: 2, height: `${h * 100}%`,
            background: `linear-gradient(to top, rgba(180,83,9,0.6), #f59e0b)`,
            animation: `ccBar ${0.7 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${(i * 0.08).toFixed(2)}s`,
            boxShadow: "0 0 10px rgba(245,158,11,0.35)",
          }} />
        ))}
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, marginBottom: 6, letterSpacing: "-0.01em" }}>
          Building your character…
        </div>
        <div style={{ fontSize: 13, color: T.textMuted }}>
          Soul ID embedding in progress
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: 200, height: 2,
        background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: "38%",
          background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.95), transparent)",
          animation: "ccShimmer 1.6s ease-in-out infinite", borderRadius: 2,
        }} />
      </div>

      {/* Bottom sweep */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(180,83,9,0.5), transparent)",
        animation: "ccSweep 2.4s ease-in-out infinite", animationDirection: "reverse",
      }} />
    </div>
  );
}

// ── Floating character overview card ─────────────────────────────────────────

function CharacterOverviewCard({ character, soul }: { character: Character; soul: SoulId | null }) {
  const consistency = soul?.consistency_score ? Math.round(soul.consistency_score * 100) : 92;
  const identity    = soul?.identity_strength ? Math.round(soul.identity_strength * 100) : 87;

  return (
    <div style={{
      position: "absolute", top: 14, right: 14, zIndex: 15,
      background: "rgba(9,12,19,0.88)",
      backdropFilter: "blur(16px)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: "12px 14px", minWidth: 180,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      animation: "ccFadeUp 0.35s ease forwards",
    }}>
      <style>{KEYFRAMES}</style>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, marginBottom: 2 }}>
        {character.name || "Unnamed Character"}
      </div>
      <div style={{ fontSize: 10, color: T.amber, fontWeight: 600, marginBottom: 10, letterSpacing: "0.04em" }}>
        {character.notes ?? "AI Character"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: T.textMuted }}>Consistency</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber }}>{consistency}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${consistency}%`,
              background: T.amber, borderRadius: 2,
            }} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: T.textMuted }}>Identity</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6" }}>{identity}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${identity}%`,
              background: "#3b82f6", borderRadius: 2,
            }} />
          </div>
        </div>
      </div>

      {soul && (
        <div style={{
          marginTop: 10, paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 9, color: T.textGhost, fontFamily: "monospace",
          letterSpacing: "0.04em",
        }}>
          {soul.soul_code}
        </div>
      )}
    </div>
  );
}

// ── Version badge ─────────────────────────────────────────────────────────────

function VersionBadge({ version }: { version: CharacterVersion }) {
  const modeLabel = version.version_name ?? (version.mode ?? "base") + " v" + version.id.slice(-2);
  return (
    <div style={{
      position: "absolute", top: 14, left: 14, zIndex: 15,
      padding: "4px 12px", borderRadius: 20,
      background: "rgba(9,12,19,0.88)",
      border: "1px solid rgba(245,158,11,0.3)",
      fontSize: 10, fontWeight: 700, color: "#f59e0b",
      letterSpacing: "0.06em", textTransform: "uppercase",
      backdropFilter: "blur(10px)",
    }}>
      {modeLabel}
    </div>
  );
}

// ── Version switcher dropdown ─────────────────────────────────────────────────

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
    <div
      style={{ position: "absolute", top: 14, right: 14, zIndex: 15 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button style={{
        padding: "5px 12px", borderRadius: 8,
        background: "rgba(9,12,19,0.88)", backdropFilter: "blur(10px)",
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
          minWidth: 168, zIndex: 50,
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
                    padding: "8px 12px", borderRadius: 6, border: "none",
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

// ── Hover action bar ──────────────────────────────────────────────────────────

const ACTION_MODES: CharacterMode[] = ["refine", "lookbook", "scene", "motion"];
const ACTION_LABELS: Record<string, string> = {
  refine: "Refine", lookbook: "Lookbook", scene: "Scene", motion: "Animate",
};

function HoverActionBar({
  mode, onModeAction, onGenerate,
}: {
  mode: CharacterMode;
  onModeAction: (m: CharacterMode) => void;
  onGenerate: () => void;
}) {
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 15,
      background: "linear-gradient(to top, rgba(9,12,19,0.97) 0%, rgba(9,12,19,0.7) 60%, transparent 100%)",
      padding: "48px 16px 16px",
      display: "flex", gap: 8, alignItems: "center", justifyContent: "center",
      animation: "ccFadeUp 0.2s ease forwards",
    }}>
      <style>{KEYFRAMES}</style>
      {/* Generate New */}
      <button
        onClick={onGenerate}
        style={{
          padding: "9px 18px", borderRadius: 10,
          background: "linear-gradient(135deg, #b45309, #f59e0b)",
          border: "none", color: "#090c13",
          fontSize: 13, fontWeight: 800, cursor: "pointer",
          letterSpacing: "0.02em",
          boxShadow: "0 0 20px rgba(245,158,11,0.4)",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        Generate New
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)" }} />

      {/* Mode actions */}
      {ACTION_MODES.map(m => (
        <button key={m}
          onClick={() => onModeAction(m)}
          style={{
            padding: "8px 14px", borderRadius: 8,
            border: mode === m ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.1)",
            background: mode === m ? "rgba(245,158,11,0.15)" : "rgba(9,12,19,0.6)",
            color: mode === m ? "#f59e0b" : T.textSec,
            fontSize: 12, fontWeight: mode === m ? 700 : 500,
            cursor: "pointer", transition: "all 0.15s",
            backdropFilter: "blur(8px)",
          }}
        >
          {ACTION_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

// ── Visual tags row ────────────────────────────────────────────────────────────

function VisualTagsRow({ styleDna }: { styleDna?: string[] }) {
  const tags = styleDna && styleDna.length > 0 ? styleDna : VISUAL_TAGS;
  return (
    <div style={{
      position: "absolute", bottom: 80, left: 16, zIndex: 14,
      display: "flex", gap: 6, flexWrap: "wrap",
    }}>
      {tags.slice(0, 4).map(tag => (
        <div key={tag} style={{
          padding: "3px 10px", borderRadius: 20,
          background: "rgba(9,12,19,0.75)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontSize: 10, fontWeight: 600, color: T.textSec,
          backdropFilter: "blur(8px)", letterSpacing: "0.04em",
        }}>
          {tag}
        </div>
      ))}
    </div>
  );
}

// ── Props (UNCHANGED) ─────────────────────────────────────────────────────────

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
  mode, character, soul, isGenerating,
  versions, activeVersionId,
  onModeAction, onVersionSelect,
}: CharacterCanvasProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const activeVersion = versions.find(v => v.id === activeVersionId) ?? versions[0] ?? null;
  const hasResult = !!activeVersion?.asset_id;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 220px)",
        minHeight: 440,
        maxHeight: 820,
        borderRadius: 16,
        background: T.surface,
        overflow: "hidden",
        // Cinematic glow — not a box border
        boxShadow: [
          "0 0 0 1px rgba(255,255,255,0.05)",
          "0 0 60px rgba(245,158,11,0.06)",
          "0 24px 80px rgba(0,0,0,0.8)",
        ].join(", "),
      }}
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
    >
      <style>{KEYFRAMES}</style>

      {/* Ambient radial glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 70% 60% at 50% 44%, rgba(245,158,11,0.05) 0%, transparent 100%)",
      }} />

      {/* Subtle grain texture */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
        opacity: 0.4,
      }} />

      {/* Content layer */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        display: "flex", alignItems: "stretch", justifyContent: "center",
      }}>
        {isGenerating ? (
          <>
            {hasResult && (
              <div style={{ position: "absolute", inset: 0, opacity: 0.3, background: "rgba(245,158,11,0.03)" }} />
            )}
            <GeneratingStage />
          </>
        ) : hasResult ? (
          <>
            {/* Full-bleed image placeholder (will show actual image via asset URL in production) */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(160deg, #0c1020 0%, #0a0d1a 40%, #090c13 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ opacity: 0.1 }}>
                <svg viewBox="0 0 80 100" width="80" height="100" fill="none">
                  <circle cx="40" cy="22" r="16" stroke="#f59e0b" strokeWidth="1.5" />
                  <path d="M10 90 C10 65 30 52 40 52 C50 52 70 65 70 90" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {activeVersion && !showOverlay && <VersionBadge version={activeVersion} />}
            {showOverlay && character && (
              <CharacterOverviewCard character={character} soul={soul} />
            )}

            {/* Version switcher (no character card) */}
            {!showOverlay && (
              <VersionSwitcher
                versions={versions}
                activeVersionId={activeVersionId}
                onSelect={onVersionSelect}
              />
            )}

            {/* Tags + action bar on hover */}
            {showOverlay && <VisualTagsRow />}
            {showOverlay && (
              <HoverActionBar
                mode={mode}
                onModeAction={onModeAction}
                onGenerate={() => onModeAction("base")}
              />
            )}
          </>
        ) : character ? (
          /* Character selected but no result yet */
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            width: "100%", height: "100%", gap: 14,
            animation: "ccFadeUp 0.3s ease forwards",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              border: "1px solid rgba(245,158,11,0.25)",
              background: "rgba(245,158,11,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px rgba(245,158,11,0.08)",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                <path d="M20 21a8 8 0 1 0-16 0" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 5 }}>
                {character.name || "New Character"}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                Complete the builder to generate
              </div>
            </div>
          </div>
        ) : (
          <EmptyStage />
        )}
      </div>
    </div>
  );
}
