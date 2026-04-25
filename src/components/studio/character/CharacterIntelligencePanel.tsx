"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CharacterIntelligencePanel — right panel
// Version Timeline + Intelligence scores + Embedding + Recent Outputs
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { SoulId, CharacterVersion } from "@/lib/character";
import type { CharacterAsset } from "@/lib/character";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.15)",
  amberBorder: "rgba(245,158,11,0.25)",
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
      fontSize: 10, fontWeight: 800, color: T.textMuted,
      letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.textSec }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{value}%</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${value}%`,
          background: color, borderRadius: 2,
          transition: "width 0.6s ease",
          boxShadow: `0 0 8px ${color}55`,
        }} />
      </div>
      {hint && (
        <div style={{ fontSize: 10, color: T.textGhost, marginTop: 4, fontStyle: "italic" }}>
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
  const date  = new Date(version.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "8px 10px", borderRadius: 8,
        border: isActive ? `1px solid ${T.amberBorder}` : `1px solid ${T.border}`,
        background: isActive ? T.amberDim : "transparent",
        cursor: "pointer", transition: "all 0.15s", marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isActive && (
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: T.amber, boxShadow: `0 0 6px ${T.amber}`,
            }} />
          )}
          <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? T.amber : T.textSec }}>
            {label}
          </span>
        </div>
        <span style={{ fontSize: 10, color: T.textGhost }}>{date}</span>
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

  const consistency = soul?.consistency_score   ? Math.round(soul.consistency_score * 100) : 87;
  const identity    = soul?.identity_strength   ? Math.round(soul.identity_strength * 100) : 92;
  const styleMatch  = soul?.style_match_score   ? Math.round(soul.style_match_score * 100) : 78;

  const sectionStyle: React.CSSProperties = {
    padding: "14px 0",
    borderBottom: `1px solid ${T.border}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Version Timeline ── */}
      <div style={sectionStyle}>
        <SectionHeading label="Version Timeline" />
        {versions.length === 0 ? (
          <div style={{ fontSize: 11, color: T.textGhost, textAlign: "center", padding: "8px 0" }}>
            No versions yet
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
        <button style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "transparent", border: `1px dashed ${T.border}`,
          borderRadius: 8, width: "100%", padding: "7px 10px",
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
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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
            padding: 0, marginBottom: embeddingExpanded ? 10 : 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SectionHeading label="Embedding" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot status={soul?.embedding_status ?? "pending"} />
            <span style={{ fontSize: 10, color: T.textMuted }}>
              {soul?.embedding_status ?? "pending"}
            </span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke={T.textGhost} strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: embeddingExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {embeddingExpanded && (
          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: "rgba(9,12,19,0.5)", border: `1px solid ${T.border}`,
            fontSize: 11, lineHeight: 1.8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textMuted }}>Provider</span>
              <span style={{ color: T.textSec }}>{soul?.embedding_provider ?? "fal-v2"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textMuted }}>Version</span>
              <span style={{ color: T.textSec }}>{soul?.embedding_version ?? "flux-char-1"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
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
      <div style={{ paddingTop: 14 }}>
        <SectionHeading label="Recent Outputs" />
        {assets.length === 0 ? (
          <div style={{ fontSize: 11, color: T.textGhost, textAlign: "center", padding: "8px 0" }}>
            No outputs yet
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {assets.slice(0, 4).map(asset => (
                <div key={asset.id} style={{
                  aspectRatio: "1",
                  borderRadius: 8, overflow: "hidden",
                  border: `1px solid ${T.border}`,
                  background: "#090c13",
                  cursor: "pointer",
                  position: "relative",
                }}>
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
                    }}>
                      <div style={{ width: 20, height: 20, opacity: 0.2 }}>
                        <svg viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="18" height="18" rx="3" stroke="#f59e0b" strokeWidth="1.5" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {assets.length > 4 && (
              <button style={{
                display: "block", width: "100%", marginTop: 8,
                background: "transparent", border: "none",
                color: T.amber, fontSize: 11, cursor: "pointer",
                textAlign: "center",
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
