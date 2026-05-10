"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Library — Left panel
// Premium cast gallery grouped by style category.
// Props unchanged: onNew / onSelect / activeId
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AIInfluencer, StyleCategory } from "@/lib/influencer/types";

// ── Style metadata ────────────────────────────────────────────────────────────

const STYLE_ORDER: StyleCategory[] = [
  "hyper-real",
  "3d-animation",
  "anime-manga",
  "fine-art",
  "game-concept",
  "physical-texture",
  "retro-pixel",
];

const STYLE_LABELS: Record<StyleCategory, string> = {
  "hyper-real":       "Hyper Real",
  "3d-animation":     "3D Animation",
  "anime-manga":      "Anime / Manga",
  "fine-art":         "Fine Art",
  "game-concept":     "Game Concept",
  "physical-texture": "Physical Texture",
  "retro-pixel":      "Retro Pixel",
};

const STYLE_CHIPS: { value: StyleCategory | "all"; label: string }[] = [
  { value: "all",              label: "All"     },
  { value: "hyper-real",       label: "Hyper"   },
  { value: "3d-animation",     label: "3D"      },
  { value: "anime-manga",      label: "Anime"   },
  { value: "fine-art",         label: "Fine Art"},
  { value: "game-concept",     label: "Game"    },
  { value: "physical-texture", label: "Texture" },
  { value: "retro-pixel",      label: "Pixel"   },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onNew:    () => void;
  onSelect: (influencer: AIInfluencer) => void;
  activeId: string | null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InfluencerLibrary({ onNew, onSelect, activeId }: Props) {
  const router = useRouter();

  const [influencers, setInfluencers] = useState<AIInfluencer[]>([]);
  const [loading, setLoading]         = useState(true);
  const [query, setQuery]             = useState("");
  const [activeStyle, setActiveStyle] = useState<StyleCategory | "all">("all");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Resolve a live token — same pattern as AIInfluencerBuilder.
      // Supabase auth is localStorage-backed so Authorization header is required;
      // credentials:"include" sends no useful cookies.
      let token: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
      } catch { /* non-fatal — request will 401 if token missing */ }

      if (cancelled) return;

      try {
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch("/api/character/ai-influencers", { headers });
        const d   = await res.json();
        if (!cancelled) setInfluencers(d.data?.influencers ?? d.influencers ?? []);
      } catch (err) {
        console.error("[InfluencerLibrary] fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Client-side filter + style grouping ──────────────────────────────────
  const grouped = useMemo(() => {
    const q = query.toLowerCase().trim();

    const filtered = influencers.filter(inf => {
      if (activeStyle !== "all" && inf.style_category !== activeStyle) return false;
      if (!q) return true;
      const handle      = (inf.handle       ?? "").toLowerCase();
      const displayName = (inf.display_name ?? "").toLowerCase();
      const styleLabel  = (STYLE_LABELS[inf.style_category] ?? "").toLowerCase();
      return handle.includes(q) || displayName.includes(q) || styleLabel.includes(q);
    });

    const map = new Map<StyleCategory, AIInfluencer[]>();
    for (const cat of STYLE_ORDER) {
      const members = filtered.filter(i => i.style_category === cat);
      if (members.length > 0) map.set(cat, members);
    }
    return map;
  }, [influencers, query, activeStyle]);

  const totalCount = influencers.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#07090f" }}>

      {/* ── Global styles ──────────────────────────────────────────────────── */}
      <style>{`
        @keyframes castPulse { 0%,100%{opacity:0.3} 50%{opacity:0.65} }
        .inf-chip-scroll::-webkit-scrollbar { display: none; }
        .inf-list::-webkit-scrollbar { width: 3px; }
        .inf-list::-webkit-scrollbar-track { background: transparent; }
        .inf-list::-webkit-scrollbar-thumb { background: #1a1f2e; border-radius: 2px; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 14px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#e8eaf0",
              letterSpacing: "0.01em",
            }}>
              AI Influencers
            </div>
            <div style={{ fontSize: 11, color: "#3d4560", marginTop: 2 }}>
              Your locked digital cast
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            {totalCount > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#3d4560",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "2px 7px",
              }}>
                {totalCount}
              </span>
            )}
            <button
              onClick={onNew}
              title="Create new influencer"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "5px 10px", borderRadius: 7,
                background: "rgba(245,158,11,0.09)",
                border: "1px solid rgba(245,158,11,0.22)",
                color: "#f59e0b", fontSize: 12, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.01em",
                transition: "all 0.15s", flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background  = "rgba(245,158,11,0.15)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.40)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background  = "rgba(245,158,11,0.09)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.22)";
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New
            </button>
          </div>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "10px 10px 0", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="#3d4560" strokeWidth="2.5" strokeLinecap="round"
            style={{
              position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)", pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search cast…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: "100%", height: 38, boxSizing: "border-box",
              paddingLeft: 30, paddingRight: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 8, color: "#e8eaf0", fontSize: 12,
              outline: "none", fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.30)"; }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
          />
        </div>
      </div>

      {/* ── Style Filter Chips ──────────────────────────────────────────────── */}
      <div
        className="inf-chip-scroll"
        style={{
          display: "flex", gap: 5, padding: "8px 10px 0",
          overflowX: "auto", flexShrink: 0,
          scrollbarWidth: "none",
        }}
      >
        {STYLE_CHIPS.map(chip => {
          const on = activeStyle === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setActiveStyle(chip.value as StyleCategory | "all")}
              style={{
                flexShrink: 0, padding: "3px 8px", borderRadius: 20,
                fontSize: 11, fontWeight: on ? 700 : 500,
                border: on
                  ? "1px solid rgba(245,158,11,0.40)"
                  : "1px solid rgba(255,255,255,0.08)",
                background: on
                  ? "rgba(245,158,11,0.10)"
                  : "rgba(255,255,255,0.03)",
                color:  on ? "#f59e0b" : "#4a5168",
                cursor: "pointer", transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div
        className="inf-list"
        style={{
          flex: 1, overflowY: "auto",
          padding: "10px 8px 20px",
          scrollbarWidth: "thin",
          scrollbarColor: "#1a1f2e transparent",
        }}
      >

        {/* Loading */}
        {loading && (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 96, borderRadius: 8, marginBottom: 6,
                background: "rgba(255,255,255,0.03)",
                animation: "castPulse 1.8s ease-in-out infinite",
                animationDelay: `${(i - 1) * 0.15}s`,
              }} />
            ))}
          </>
        )}

        {/* Empty state — no influencers at all */}
        {!loading && influencers.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "36px 16px 20px", textAlign: "center",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, marginBottom: 14,
              background: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.10), transparent 70%)",
              border: "1px solid rgba(245,158,11,0.14)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="rgba(245,158,11,0.45)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
                <path d="M20 21a8 8 0 1 0-16 0"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#8b92a8", marginBottom: 6 }}>
              No influencers yet
            </div>
            <div style={{ fontSize: 12, color: "#3d4560", lineHeight: 1.65 }}>
              Create your first AI Influencer to start building your digital cast.
            </div>
          </div>
        )}

        {/* Empty search result */}
        {!loading && influencers.length > 0 && grouped.size === 0 && (
          <div style={{ padding: "28px 12px", textAlign: "center", fontSize: 12, color: "#3d4560" }}>
            No cast members match &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Style-grouped cards */}
        {!loading && [...grouped.entries()].map(([cat, members]) => (
          <div key={cat} style={{ marginBottom: 18 }}>

            {/* Section header */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "0 4px 7px",
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#3d4560",
                letterSpacing: "0.11em", textTransform: "uppercase",
              }}>
                {STYLE_LABELS[cat]}
              </span>
              <span style={{ fontSize: 10, color: "#3d4560", fontWeight: 600 }}>
                {members.length}
              </span>
            </div>

            {/* Cards */}
            {members.map(inf => (
              <InfluencerCard
                key={inf.id}
                influencer={inf}
                active={inf.id === activeId}
                onOpen={() => onSelect(inf)}
                onImage={() => router.push(`/studio/image?handle=${inf.handle ?? ""}`)}
                onVideo={() => router.push(`/studio/video?handle=${inf.handle ?? ""}&mode=start-frame`)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function InfluencerCard({
  influencer, active, onOpen, onImage, onVideo,
}: {
  influencer: AIInfluencer;
  active:     boolean;
  onOpen:     () => void;
  onImage:    () => void;
  onVideo:    () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const isLocked    = !!influencer.identity_lock_id;
  const handle      = influencer.handle      ? `@${influencer.handle}`  : null;
  const displayName = influencer.display_name ?? null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 96, marginBottom: 6,
        borderRadius: 8, overflow: "hidden",
        border: active
          ? "1px solid rgba(245,158,11,0.45)"
          : hovered
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(255,255,255,0.10)",
        background: active
          ? "rgba(245,158,11,0.06)"
          : hovered
          ? "rgba(255,255,255,0.065)"
          : "rgba(255,255,255,0.035)",
        boxShadow: active ? "0 0 28px rgba(245,158,11,0.12)" : "none",
        transform:  (!active && hovered) ? "translateY(-1px)" : "translateY(0)",
        display: "flex",
        transition: "all 0.15s",
      }}
    >
      {/* Thumbnail — sharp corners, no radius on media */}
      <div style={{
        width: 64, height: 96, flexShrink: 0,
        background: "rgba(255,255,255,0.04)",
        overflow: "hidden", borderRadius: 0,
      }}>
        {influencer.thumbnail_url ? (
          <img
            src={influencer.thumbnail_url}
            alt={handle ?? "Influencer"}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", borderRadius: 0,
              display: "block",
            }}
            draggable={false}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.09), transparent 70%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#3d4560" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
              <path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
          </div>
        )}
      </div>

      {/* Info + Actions */}
      <div style={{
        flex: 1, minWidth: 0,
        padding: "9px 8px 8px",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
      }}>

        {/* Top: identity info */}
        <div style={{ minWidth: 0 }}>
          {handle && (
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: active ? "#f59e0b" : "#e8eaf0",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              letterSpacing: "0.01em", marginBottom: 1,
            }}>
              {handle}
            </div>
          )}
          {displayName && (
            <div style={{
              fontSize: 11, color: "#4a5168",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              marginBottom: 4,
            }}>
              {displayName}
            </div>
          )}
          {/* Identity status */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
              background:  isLocked ? "#f59e0b" : "rgba(255,255,255,0.18)",
              boxShadow:   isLocked ? "0 0 5px rgba(245,158,11,0.55)" : "none",
              transition: "all 0.15s",
            }} />
            <span style={{
              fontSize: 10, fontWeight: 500,
              color: isLocked ? "rgba(245,158,11,0.80)" : "#3d4560",
            }}>
              {isLocked ? "Identity Locked" : "Needs Selection"}
            </span>
          </div>
        </div>

        {/* Bottom: action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

          {/* Open — always visible */}
          <MicroButton label="Open" onClick={onOpen} />

          {/* Image + Video — appear on hover */}
          {hovered && (
            <>
              <MicroButton
                label="Image"
                onClick={onImage}
                disabled={!isLocked}
                tooltip={!isLocked ? "Finish identity selection first" : undefined}
              />
              <MicroButton
                label="Video"
                onClick={onVideo}
                disabled={!isLocked}
                tooltip={!isLocked ? "Finish identity selection first" : undefined}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Micro action button ───────────────────────────────────────────────────────

function MicroButton({
  label, onClick, disabled, tooltip,
}: {
  label:    string;
  onClick:  () => void;
  disabled?: boolean;
  tooltip?:  string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={tooltip}
      style={{
        padding: "3px 7px", borderRadius: 5,
        fontSize: 10, fontWeight: 600, letterSpacing: "0.02em",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.05)",
        color:   disabled ? "#2d3347" : "#8b92a8",
        cursor:  disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.12s",
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background   = "rgba(255,255,255,0.10)";
          (e.currentTarget as HTMLElement).style.color        = "#e8eaf0";
          (e.currentTarget as HTMLElement).style.borderColor  = "rgba(255,255,255,0.20)";
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background   = "rgba(255,255,255,0.05)";
          (e.currentTarget as HTMLElement).style.color        = "#8b92a8";
          (e.currentTarget as HTMLElement).style.borderColor  = "rgba(255,255,255,0.10)";
        }
      }}
    >
      {label}
    </button>
  );
}
