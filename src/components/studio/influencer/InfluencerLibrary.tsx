"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Library — Left panel
// List of saved influencers + "Create New" CTA
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import type { AIInfluencer } from "@/lib/influencer/types";

const T = {
  border:  "#111827",
  surface: "#0b0e17",
  text:    "#e8eaf0",
  muted:   "#8b92a8",
  ghost:   "#3d4560",
  amber:   "#f59e0b",
} as const;

interface Props {
  onNew:    () => void;
  onSelect: (influencer: AIInfluencer) => void;
  activeId: string | null;
}

export default function InfluencerLibrary({ onNew, onSelect, activeId }: Props) {
  const [influencers, setInfluencers] = useState<AIInfluencer[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/character/ai-influencers", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (!cancelled) setInfluencers(d.influencers ?? []); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{
        padding: "18px 16px 14px",
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: T.ghost,
          letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12,
        }}>
          AI Influencers
        </div>
        <button
          onClick={onNew}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 9,
            background: "rgba(245,158,11,0.09)",
            border: "1px solid rgba(245,158,11,0.22)",
            color: T.amber, fontSize: 13, fontWeight: 700,
            cursor: "pointer", letterSpacing: "0.02em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.15)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.40)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.09)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.22)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create New Influencer
        </button>
      </div>

      {/* Influencer list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>

        {loading && (
          <div style={{ padding: "20px 8px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 60, borderRadius: 8, marginBottom: 8,
                background: "rgba(255,255,255,0.03)",
                animation: "pulse 1.8s ease-in-out infinite",
              }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}`}</style>
          </div>
        )}

        {!loading && influencers.length === 0 && (
          <div style={{
            padding: "32px 12px", textAlign: "center",
            fontSize: 13, color: T.ghost, lineHeight: 1.6,
          }}>
            No influencers yet.
            <br />Create your first one.
          </div>
        )}

        {!loading && influencers.map(inf => (
          <InfluencerCard
            key={inf.id}
            influencer={inf}
            active={inf.id === activeId}
            onClick={() => onSelect(inf)}
          />
        ))}
      </div>
    </div>
  );
}

function InfluencerCard({
  influencer, active, onClick,
}: {
  influencer: AIInfluencer; active: boolean; onClick: () => void;
}) {
  const isReady = influencer.status === "active" && !!influencer.identity_lock_id;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "10px 10px",
        borderRadius: 8, marginBottom: 4,
        background: active ? "rgba(245,158,11,0.08)" : "transparent",
        border: active ? "1px solid rgba(245,158,11,0.20)" : "1px solid transparent",
        cursor: "pointer", textAlign: "left",
        display: "flex", alignItems: "center", gap: 10,
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 40, height: 50, borderRadius: 6, flexShrink: 0,
        background: "rgba(255,255,255,0.05)",
        overflow: "hidden", position: "relative",
      }}>
        {influencer.thumbnail_url ? (
          <img
            src={influencer.thumbnail_url}
            alt={influencer.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.15), transparent 70%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#3d4560" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
              <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: active ? "#f59e0b" : "#e8eaf0",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginBottom: 3,
        }}>
          {influencer.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: isReady ? "#10b981" : "#4a5168",
            boxShadow: isReady ? "0 0 5px #10b981" : "none",
          }} />
          <span style={{ fontSize: 11, color: "#4a5168" }}>
            {isReady ? "Identity saved" : influencer.status === "draft" ? "Draft" : "In progress"}
          </span>
        </div>
      </div>
    </button>
  );
}
