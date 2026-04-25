"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterIntelligencePanel — right panel (Phase 3D layout rebuild)
// Section order: Latest Outputs → Version History → Character Intelligence → Metadata
// Outputs always visible (rich placeholders when empty)
// Version rows with 48×56px thumbnail slots
// Props UNCHANGED from Phase 3A
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { SoulId, CharacterVersion, CharacterAsset } from "@/lib/character";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.15)",
  amberBorder: "rgba(245,158,11,0.28)",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Section heading ────────────────────────────────────────────────────────────

function SectionHeading({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 14,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 900, color: T.textMuted,
        letterSpacing: "0.12em", textTransform: "uppercase",
      }}>
        {label}
      </div>
      {count !== undefined && count > 0 && (
        <div style={{
          padding: "2px 7px", borderRadius: 10,
          background: T.amberDim, border: `1px solid ${T.amberBorder}`,
          fontSize: 10, fontWeight: 700, color: T.amber,
        }}>
          {count}
        </div>
      )}
    </div>
  );
}

// ── Output thumbnail (with rich placeholder when no URL) ──────────────────────

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, #1a120a 0%, #0d0a06 100%)",
  "linear-gradient(135deg, #0a0d1a 0%, #060810 100%)",
  "linear-gradient(135deg, #120a1a 0%, #0a0610 100%)",
  "linear-gradient(135deg, #071510 0%, #040d09 100%)",
];

const PLACEHOLDER_COLORS = [
  "rgba(245,158,11,0.25)",
  "rgba(59,130,246,0.20)",
  "rgba(168,85,247,0.20)",
  "rgba(52,211,153,0.20)",
];

function OutputThumbnail({ asset, idx }: { asset?: CharacterAsset; idx: number }) {
  const gradient = PLACEHOLDER_GRADIENTS[idx % 4];
  const color    = PLACEHOLDER_COLORS[idx % 4];

  return (
    <div style={{
      aspectRatio: "3/4",
      borderRadius: 9, overflow: "hidden",
      border: `1px solid ${T.border}`,
      background: asset?.url ? "#090c13" : gradient,
      cursor: "pointer", position: "relative",
      transition: "border-color 0.15s, transform 0.15s",
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = T.amberBorder;
        (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = T.border;
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
      }}
    >
      {asset?.url ? (
        <img src={asset.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 6,
        }}>
          {/* Atmospheric silhouette suggestion */}
          <div style={{
            width: 28, height: 36,
            background: `radial-gradient(ellipse at center, ${color} 0%, transparent 70%)`,
            borderRadius: "50% 50% 40% 40%",
          }} />
          <div style={{
            width: 42, height: 28,
            background: `radial-gradient(ellipse at center, ${color.replace("0.20", "0.12").replace("0.25", "0.14")} 0%, transparent 70%)`,
            borderRadius: "40% 40% 50% 50%",
            marginTop: -8,
          }} />
          {/* Label */}
          <div style={{
            position: "absolute", bottom: 8, left: 0, right: 0,
            textAlign: "center",
            fontSize: 9, color: T.textGhost, fontWeight: 600,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Output {idx + 1}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Version row with thumbnail ─────────────────────────────────────────────────

function VersionRow({
  version, isActive, onClick,
}: {
  version: CharacterVersion; isActive: boolean; onClick: () => void;
}) {
  const label = version.version_name ?? (version.mode ?? "base");
  const date  = new Date(version.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        width: "100%", textAlign: "left",
        padding: "9px 10px", borderRadius: 10,
        border: isActive ? `1px solid ${T.amberBorder}` : `1px solid ${T.border}`,
        background: isActive ? T.amberDim : "transparent",
        cursor: "pointer", transition: "all 0.15s", marginBottom: 6,
      }}
    >
      {/* Thumbnail slot — 44×56px */}
      <div style={{
        width: 44, height: 56, borderRadius: 7, flexShrink: 0,
        background: isActive
          ? "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(180,83,9,0.12))"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${isActive ? T.amberBorder : T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={isActive ? T.amber : T.textGhost} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" opacity={0.6}>
          <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          {isActive && (
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: T.amber, boxShadow: `0 0 6px ${T.amber}`,
              flexShrink: 0,
            }} />
          )}
          <span style={{
            fontSize: 13, fontWeight: isActive ? 700 : 500,
            color: isActive ? T.amber : T.textSec,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: T.textGhost }}>{date}</div>
      </div>

      {/* Chevron */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke={isActive ? T.amber : T.textGhost} strokeWidth="2.5" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color, hint }: {
  label: string; value: number; color: string; hint?: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textSec }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>
          {value}<span style={{ fontSize: 12, fontWeight: 700 }}>%</span>
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${value}%`,
          background: color, borderRadius: 3,
          transition: "width 0.7s ease",
          boxShadow: `0 0 10px ${color}55`,
        }} />
      </div>
      {hint && (
        <div style={{ fontSize: 10, color: T.textGhost, marginTop: 5, fontStyle: "italic" }}>
          → {hint}
        </div>
      )}
    </div>
  );
}

// ── Embedding status dot ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ready"   ? "#10b981" :
    status === "failed"  ? "#ef4444" :
    status === "pending" ? "#f59e0b" : "#4a5168";
  return (
    <div style={{
      width: 7, height: 7, borderRadius: "50%",
      background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0,
    }} />
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CharacterIntelligencePanelProps {
  soul: SoulId | null;
  versions: CharacterVersion[];
  activeVersionId: string | null;
  onVersionSelect: (id: string) => void;
  assets: CharacterAsset[];
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CharacterIntelligencePanel({
  soul, versions, activeVersionId, onVersionSelect, assets,
}: CharacterIntelligencePanelProps) {
  const [scoresOpen, setScoresOpen] = useState(true);
  const [metaOpen,   setMetaOpen]   = useState(false);

  const consistency = soul?.consistency_score ? Math.round(soul.consistency_score * 100) : 87;
  const identity    = soul?.identity_strength ? Math.round(soul.identity_strength * 100) : 92;
  const styleMatch  = soul?.style_match_score ? Math.round(soul.style_match_score * 100) : 78;

  const sectionDivider: React.CSSProperties = {
    borderTop: `1px solid ${T.border}`,
    paddingTop: 20, marginTop: 4,
  };

  // Show 4 slots always — real assets + placeholders
  const outputSlots = Array.from({ length: 4 }, (_, i) => assets[i]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── LATEST OUTPUTS — always first, always visible ── */}
      <div style={{ paddingBottom: 20 }}>
        <SectionHeading label="Latest Outputs" count={assets.length > 0 ? assets.length : undefined} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {outputSlots.map((asset, i) => (
            <OutputThumbnail key={asset?.id ?? `placeholder-${i}`} asset={asset} idx={i} />
          ))}
        </div>
        {assets.length > 4 && (
          <button style={{
            display: "block", width: "100%", marginTop: 10,
            background: "transparent", border: "none",
            color: T.amber, fontSize: 12, cursor: "pointer",
            textAlign: "center", fontWeight: 600,
          }}>
            + {assets.length - 4} more
          </button>
        )}
      </div>

      {/* ── VERSION HISTORY ── */}
      <div style={sectionDivider}>
        <SectionHeading label="Version History" count={versions.length > 0 ? versions.length : undefined} />
        {versions.length === 0 ? (
          <div style={{
            padding: "14px 12px", borderRadius: 9,
            background: "rgba(255,255,255,0.02)",
            border: `1px dashed ${T.border}`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 12, color: T.textGhost, marginBottom: 4 }}>
              No versions yet
            </div>
            <div style={{ fontSize: 11, color: T.textGhost, opacity: 0.6 }}>
              Generate to create your first version
            </div>
          </div>
        ) : (
          <>
            {versions.map(v => (
              <VersionRow
                key={v.id}
                version={v}
                isActive={v.id === activeVersionId}
                onClick={() => onVersionSelect(v.id)}
              />
            ))}
          </>
        )}

        {/* Add version button */}
        <button style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "transparent", border: `1px dashed ${T.border}`,
          borderRadius: 10, width: "100%", padding: "9px 10px",
          color: T.textGhost, fontSize: 12, cursor: "pointer",
          transition: "all 0.15s", marginTop: 6,
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = T.amberBorder;
            (e.currentTarget as HTMLElement).style.color = T.amber;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = T.border;
            (e.currentTarget as HTMLElement).style.color = T.textGhost;
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add version
        </button>
      </div>

      {/* ── CHARACTER INTELLIGENCE — collapsible ── */}
      <div style={sectionDivider}>
        <button
          onClick={() => setScoresOpen(o => !o)}
          style={{
            display: "flex", width: "100%", background: "transparent", border: "none",
            cursor: "pointer", padding: 0, marginBottom: scoresOpen ? 14 : 0,
            alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 900, color: T.textMuted,
            letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            Character Intelligence
          </div>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke={T.textGhost} strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: scoresOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {scoresOpen && (
          <>
            <ScoreBar
              label="Consistency Score" value={consistency} color={T.amber}
              hint={consistency < 90 ? "Add side angle for better stability" : "Excellent consistency"}
            />
            <ScoreBar
              label="Identity Strength" value={identity} color="#3b82f6"
              hint={identity >= 90 ? "Strong — ready for lookbook" : "Add more reference angles"}
            />
            <ScoreBar
              label="Style Match" value={styleMatch} color="#10b981"
              hint={styleMatch < 85 ? "Try adding Editorial style" : "Style well matched"}
            />
          </>
        )}
      </div>

      {/* ── METADATA — collapsible ── */}
      <div style={sectionDivider}>
        <button
          onClick={() => setMetaOpen(o => !o)}
          style={{
            display: "flex", width: "100%", background: "transparent", border: "none",
            cursor: "pointer", padding: 0, marginBottom: metaOpen ? 14 : 0,
            alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 900, color: T.textMuted,
            letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            Embedding Metadata
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot status={soul?.embedding_status ?? "pending"} />
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke={T.textGhost} strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: metaOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {metaOpen && (
          <div style={{
            padding: "12px 14px", borderRadius: 9,
            background: "rgba(9,12,19,0.6)",
            border: `1px solid ${T.border}`,
            fontSize: 12, lineHeight: 2,
          }}>
            {[
              { label: "Provider", value: soul?.embedding_provider ?? "fal-v2" },
              { label: "Version",  value: soul?.embedding_version  ?? "flux-char-1" },
              { label: "Status",   value: soul?.embedding_status   ?? "pending", isStatus: true },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: T.textMuted }}>{row.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {row.isStatus && <StatusDot status={row.value} />}
                  <span style={{ color: T.textSec, fontFamily: "monospace", fontSize: 11 }}>
                    {row.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
