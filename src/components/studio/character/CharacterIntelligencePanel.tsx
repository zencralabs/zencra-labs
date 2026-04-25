"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterIntelligencePanel — right panel
// Version Timeline (with thumbnail slots) + Intelligence scores (6px bars)
// + Embedding + Recent Outputs image grid
// Props UNCHANGED from Phase 3A
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { SoulId, CharacterVersion } from "@/lib/character";
import type { CharacterAsset } from "@/lib/character";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.15)",
  amberBorder: "rgba(245,158,11,0.28)",
  surface:     "#0b0e17",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Section heading ────────────────────────────────────────────────────────────

function SectionHeading({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 900, color: T.textMuted,
      letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12,
    }}>
      {label}
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({
  label, value, color, hint,
}: {
  label: string; value: number; color: string; hint?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textSec }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>
          {value}<span style={{ fontSize: 11 }}>%</span>
        </span>
      </div>
      {/* 6px bar — upgrade from 4px */}
      <div style={{
        height: 6, background: "rgba(255,255,255,0.05)",
        borderRadius: 3, overflow: "hidden",
      }}>
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

// ── Version card ──────────────────────────────────────────────────────────────

function VersionCard({
  version, isActive, onClick,
}: {
  version: CharacterVersion;
  isActive: boolean;
  onClick: () => void;
}) {
  const label = version.version_name ?? (version.mode ?? "base");
  const date  = new Date(version.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", textAlign: "left",
        padding: "9px 10px", borderRadius: 9,
        border: isActive ? `1px solid ${T.amberBorder}` : `1px solid ${T.border}`,
        background: isActive ? T.amberDim : "transparent",
        cursor: "pointer", transition: "all 0.15s", marginBottom: 6,
      }}
    >
      {/* Thumbnail slot */}
      <div style={{
        width: 36, height: 44, borderRadius: 6, flexShrink: 0,
        background: isActive
          ? "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(180,83,9,0.1))"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${isActive ? T.amberBorder : T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* If version ever has an image URL, render it here */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={isActive ? T.amber : T.textGhost} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" opacity={0.6}>
          <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          {isActive && (
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: T.amber, boxShadow: `0 0 6px ${T.amber}`,
              flexShrink: 0,
            }} />
          )}
          <span style={{
            fontSize: 12, fontWeight: isActive ? 700 : 500,
            color: isActive ? T.amber : T.textSec,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: 10, color: T.textGhost }}>{date}</div>
      </div>
    </button>
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
      background: color, boxShadow: `0 0 6px ${color}`,
      flexShrink: 0,
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
  const [embeddingExpanded, setEmbeddingExpanded] = useState(false);

  const consistency = soul?.consistency_score ? Math.round(soul.consistency_score * 100) : 87;
  const identity    = soul?.identity_strength ? Math.round(soul.identity_strength * 100) : 92;
  const styleMatch  = soul?.style_match_score ? Math.round(soul.style_match_score * 100) : 78;

  const sectionStyle: React.CSSProperties = {
    padding: "16px 0",
    borderBottom: `1px solid ${T.border}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Version Timeline ── */}
      <div style={sectionStyle}>
        <SectionHeading label="Version Timeline" />
        {versions.length === 0 ? (
          <div style={{
            fontSize: 11, color: T.textGhost,
            textAlign: "center", padding: "14px 0",
            lineHeight: 1.6,
          }}>
            No versions yet
            <div style={{ fontSize: 10, color: T.textGhost, marginTop: 4 }}>
              Generate to create your first version
            </div>
          </div>
        ) : (
          versions.map(v => (
            <VersionCard
              key={v.id}
              version={v}
              isActive={v.id === activeVersionId}
              onClick={() => onVersionSelect(v.id)}
            />
          ))
        )}
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: `1px dashed ${T.border}`,
            borderRadius: 9, width: "100%", padding: "8px 10px",
            color: T.textGhost, fontSize: 11, cursor: "pointer",
            transition: "all 0.15s",
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add version
        </button>
      </div>

      {/* ── Character Intelligence ── */}
      <div style={sectionStyle}>
        <SectionHeading label="Character Intelligence" />
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
      </div>

      {/* ── Embedding ── */}
      <div style={sectionStyle}>
        <button
          onClick={() => setEmbeddingExpanded(e => !e)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", background: "transparent", border: "none", cursor: "pointer",
            padding: 0, marginBottom: embeddingExpanded ? 12 : 0,
          }}
        >
          <SectionHeading label="Embedding" />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <StatusDot status={soul?.embedding_status ?? "pending"} />
            <span style={{ fontSize: 10, color: T.textMuted }}>
              {soul?.embedding_status ?? "pending"}
            </span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke={T.textGhost} strokeWidth="2.5" strokeLinecap="round"
              style={{
                transform: embeddingExpanded ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {embeddingExpanded && (
          <div style={{
            padding: "11px 13px", borderRadius: 9,
            background: "rgba(9,12,19,0.6)",
            border: `1px solid ${T.border}`,
            fontSize: 11, lineHeight: 2,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textMuted }}>Provider</span>
              <span style={{ color: T.textSec, fontFamily: "monospace" }}>
                {soul?.embedding_provider ?? "fal-v2"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textMuted }}>Version</span>
              <span style={{ color: T.textSec, fontFamily: "monospace" }}>
                {soul?.embedding_version ?? "flux-char-1"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: T.textMuted }}>Status</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <StatusDot status={soul?.embedding_status ?? "pending"} />
                <span style={{ color: T.textSec }}>{soul?.embedding_status ?? "pending"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Recent Outputs ── */}
      <div style={{ paddingTop: 16 }}>
        <SectionHeading label="Recent Outputs" />
        {assets.length === 0 ? (
          <div style={{
            fontSize: 11, color: T.textGhost, textAlign: "center",
            padding: "14px 0", lineHeight: 1.6,
          }}>
            No outputs yet
            <div style={{ fontSize: 10, marginTop: 4 }}>
              Generated assets will appear here
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {assets.slice(0, 4).map(asset => (
                <div key={asset.id} style={{
                  aspectRatio: "3/4",
                  borderRadius: 9, overflow: "hidden",
                  border: `1px solid ${T.border}`,
                  background: "#090c13",
                  cursor: "pointer", position: "relative",
                  transition: "border-color 0.15s",
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = T.amberBorder;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = T.border;
                  }}
                >
                  {asset.url ? (
                    <img
                      src={asset.url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "linear-gradient(135deg, #0b0e17, #0d1020)",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" opacity={0.18}>
                        <rect x="3" y="3" width="18" height="18" rx="3"
                          stroke={T.amber} strokeWidth="1.5" />
                        <circle cx="8.5" cy="8.5" r="1.5" fill={T.amber} />
                        <path d="M21 15l-5-5L5 21" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {assets.length > 4 && (
              <button style={{
                display: "block", width: "100%", marginTop: 10,
                background: "transparent", border: "none",
                color: T.amber, fontSize: 11, cursor: "pointer",
                textAlign: "center", fontWeight: 600,
              }}>
                + {assets.length - 4} more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
