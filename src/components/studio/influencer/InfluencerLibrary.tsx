"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Influencer Library — Left panel
// Cinematic cast roster — 9:16 portrait grid with atmospheric hover polish.
// Props unchanged: onNew / onSelect / activeId
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useMemo, useCallback } from "react";
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

// Per-style color palette — matches the Builder card accent language on the right panel.
// ALL stays amber. Hyper stays neutral white. Style-specific chips inherit their card's accent.
const CHIP_PALETTE: Record<StyleCategory | "all", {
  r: number; g: number; b: number;   // RGB for rgba() composition
  text: string;                       // Active text color
}> = {
  "all":              { r: 226, g: 232, b: 240, text: "#f1f5f9" }, // neutral white
  "hyper-real":       { r: 245, g: 158, b: 11,  text: "#fbbf24" }, // amber
  "3d-animation":     { r: 6,   g: 182, b: 212, text: "#22d3ee" }, // cyan
  "anime-manga":      { r: 236, g: 72,  b: 153, text: "#f472b6" }, // pink
  "fine-art":         { r: 249, g: 115, b: 22,  text: "#fb923c" }, // warm orange
  "game-concept":     { r: 139, g: 92,  b: 246, text: "#c4b5fd" }, // violet
  "physical-texture": { r: 194, g: 120, b: 68,  text: "#e8a07a" }, // warm clay / terracotta
  "retro-pixel":      { r: 132, g: 204, b: 22,  text: "#a3e635" }, // lime
};

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
  const [activeTag,   setActiveTag]   = useState<string | "all">("all");

  // Slot info
  const [slotsUsed,  setSlotsUsed]  = useState(0);
  const [slotsLimit, setSlotsLimit] = useState(8);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AIInfluencer | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  // Auth token helper
  const getToken = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    } catch { return {}; }
  }, []);

  // Fetch influencers + slots
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let token: Record<string, string> = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) token = { Authorization: `Bearer ${session.access_token}` };
      } catch { /* non-fatal */ }

      if (cancelled) return;

      try {
        const [infRes, slotRes] = await Promise.all([
          fetch("/api/character/ai-influencers", { headers: token }),
          fetch("/api/character/ai-influencers/slots", { headers: token }),
        ]);
        const d = await infRes.json();
        if (!cancelled) setInfluencers(d.data?.influencers ?? d.influencers ?? []);
        if (slotRes.ok) {
          const sd = await slotRes.json();
          const { used, limit } = sd.data ?? sd;
          if (!cancelled) { setSlotsUsed(used ?? 0); setSlotsLimit(limit ?? 8); }
        }
      } catch (err) {
        console.error("[InfluencerLibrary] fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Delete handler
  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const headers = await getToken();
      const res = await fetch(
        `/api/character/ai-influencers/${deleteTarget.id}`,
        { method: "DELETE", headers },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setDeleteError(d?.error ?? "Delete failed. Please try again.");
        setDeleting(false);
        return;
      }
      const d = await res.json();
      setInfluencers(prev => prev.filter(i => i.id !== deleteTarget.id));
      setSlotsUsed(s => Math.max(0, s - 1));
      if (d.data?.slots_remaining !== undefined) {
        setSlotsUsed(slotsLimit - d.data.slots_remaining);
      }
      setDeleteTarget(null);
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  // ── All unique tags across influencers ───────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const inf of influencers) {
      for (const t of (inf.tags ?? [])) set.add(t);
    }
    return Array.from(set).sort();
  }, [influencers]);

  // ── Client-side filter + roster views ───────────────────────────────────
  // `flat`  — preserves the API's DESC created_at order. Used for "All" tab:
  //           newest globally appears first regardless of style category.
  // `map`   — grouped by style (newest-first within each group). Used for
  //           specific-style tabs so the section header still appears.
  // This replaces the old STYLE_ORDER-indexed map that always put Hyper Real
  // first and buried newly created 3D/Anime influencers at the bottom.
  const roster = useMemo(() => {
    const q = query.toLowerCase().trim();

    const filtered = influencers.filter(inf => {
      if (activeStyle !== "all" && inf.style_category !== activeStyle) return false;
      if (activeTag !== "all" && !(inf.tags ?? []).includes(activeTag)) return false;
      if (!q) return true;
      const handle      = (inf.handle       ?? "").toLowerCase();
      const displayName = (inf.display_name ?? "").toLowerCase();
      const styleLabel  = (STYLE_LABELS[inf.style_category] ?? "").toLowerCase();
      return handle.includes(q) || displayName.includes(q) || styleLabel.includes(q);
    });

    // Flat list — order comes from the API (created_at DESC). Do not sort here.
    const flat = filtered;

    // Style-grouped map — used only when a specific style tab is active.
    // Iterates STYLE_ORDER so section headers appear in canonical order,
    // but members within each section are newest-first (preserved from `filtered`).
    const map = new Map<StyleCategory, AIInfluencer[]>();
    for (const cat of STYLE_ORDER) {
      const members = filtered.filter(i => i.style_category === cat);
      if (members.length > 0) map.set(cat, members);
    }

    return { flat, map };
  }, [influencers, query, activeStyle, activeTag]);

  // ── Slot fill ratio ──────────────────────────────────────────────────────
  const slotRatio = slotsLimit > 0 ? slotsUsed / slotsLimit : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#07090f" }}>

      {/* ── Global styles ──────────────────────────────────────────────────── */}
      <style>{`
        @keyframes castPulse  { 0%,100%{opacity:0.22} 50%{opacity:0.50} }
        @keyframes castReveal { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .inf-chip-scroll::-webkit-scrollbar { display: none; }
        .inf-list::-webkit-scrollbar { width: 2px; }
        .inf-list::-webkit-scrollbar-track { background: transparent; }
        .inf-list::-webkit-scrollbar-thumb { background: #161b28; border-radius: 2px; }
      `}</style>

      {/* ── Delete / Archive Confirm Modal ──────────────────────────────────── */}
      {deleteTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(6px)",
        }} onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 340, background: "#0a0d15",
              border: "1px solid rgba(255,255,255,0.10)",
              padding: "24px 24px 20px",
              boxShadow: "0 32px 80px rgba(0,0,0,0.70)",
            }}
          >
            {/* Icon */}
            <div style={{
              width: 40, height: 40, marginBottom: 16,
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </div>

            {/* Title */}
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 15, fontWeight: 700, color: "#e8eaf0",
              letterSpacing: "-0.01em", marginBottom: 8,
            }}>
              Archive Influencer?
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 13, color: "rgba(255,255,255,0.48)",
              lineHeight: 1.6, marginBottom: 20,
            }}>
              This removes{" "}
              <strong style={{ color: "#e8eaf0" }}>
                {deleteTarget.display_name ?? deleteTarget.handle ?? "this influencer"}
              </strong>{" "}
              from your roster and frees 1 identity slot. Generated assets are preserved.
            </div>

            {deleteError && (
              <div style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 11, color: "#fca5a5", fontWeight: 600,
                letterSpacing: "0.07em", textTransform: "uppercase" as const,
                marginBottom: 12,
              }}>
                {deleteError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => !deleting && setDeleteTarget(null)}
                style={{
                  flex: 1, height: 36,
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 13, fontWeight: 600,
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, height: 36,
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  background: deleting ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.14)",
                  border: "1px solid rgba(239,68,68,0.32)",
                  color: deleting ? "rgba(252,165,165,0.45)" : "#fca5a5",
                  fontSize: 13, fontWeight: 700,
                  cursor: deleting ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  if (!deleting) (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.24)";
                }}
                onMouseLeave={e => {
                  if (!deleting) (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.14)";
                }}
              >
                {deleting ? "Archiving…" : "Remove From Cast"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 14px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 16, fontWeight: 700, color: "#eceef5",
              letterSpacing: "0.01em",
            }}>
              AI Talent Roster
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 13, color: "rgba(255,255,255,0.52)", marginTop: 3,
              letterSpacing: "0.04em",
            }}>
              Your locked digital cast
            </div>
          </div>

          <button
            onClick={onNew}
            title="Create new influencer"
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 10px",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.20)",
              color: "#f59e0b",
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer", letterSpacing: "0.02em",
              transition: "all 0.18s", flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background  = "rgba(245,158,11,0.14)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.38)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background  = "rgba(245,158,11,0.08)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.20)";
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

        {/* ── Slot Meter ───────────────────────────────────────────────────── */}
        <div style={{ marginTop: 12 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 5,
          }}>
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.58)",
              letterSpacing: "0.10em", textTransform: "uppercase" as const,
            }}>
              Roster Slots
            </span>
            <span style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 13, fontWeight: 700,
              color: slotsUsed >= slotsLimit ? "#fca5a5" : "#f59e0b",
              letterSpacing: "-0.01em",
            }}>
              {slotsUsed}/{slotsLimit}
            </span>
          </div>
          <div style={{
            height: 2, borderRadius: 1, background: "rgba(255,255,255,0.05)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.min(100, slotRatio * 100)}%`,
              background: slotsUsed >= slotsLimit
                ? "linear-gradient(90deg,#ef4444,#dc2626)"
                : slotRatio >= 0.75
                ? "linear-gradient(90deg,#f59e0b,#ea8d00)"
                : "linear-gradient(90deg,#f59e0b,#fbbf24)",
              borderRadius: 1,
              transition: "width 0.45s ease",
            }} />
          </div>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "10px 10px 0", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round"
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
            placeholder="Search by @handle or name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: "100%", height: 36, boxSizing: "border-box",
              paddingLeft: 28, paddingRight: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#d8dbe8",
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 14,
              outline: "none",
              transition: "border-color 0.18s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.28)"; }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
        </div>
      </div>

      {/* ── Style Filter Chips ──────────────────────────────────────────────── */}
      <div
        className="inf-chip-scroll"
        style={{
          display: "flex", gap: 4, padding: "7px 10px 0",
          overflowX: "auto", flexShrink: 0,
          scrollbarWidth: "none",
        }}
      >
        {STYLE_CHIPS.map(chip => {
          const on  = activeStyle === chip.value;
          const pal = CHIP_PALETTE[chip.value as StyleCategory | "all"] ?? CHIP_PALETTE["all"];
          const { r, g, b } = pal;
          return (
            <button
              key={chip.value}
              onClick={() => setActiveStyle(chip.value as StyleCategory | "all")}
              style={{
                flexShrink: 0, padding: "6px 11px",
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 14, fontWeight: on ? 800 : 500,
                border: on
                  ? `1.5px solid rgba(${r},${g},${b},0.65)`
                  : `1px solid rgba(${r},${g},${b},0.12)`,
                background: on
                  ? `rgba(${r},${g},${b},0.16)`
                  : `rgba(${r},${g},${b},0.04)`,
                color: on ? pal.text : `rgba(${r},${g},${b},0.65)`,
                boxShadow: on
                  ? `0 0 14px rgba(${r},${g},${b},0.28), 0 0 4px rgba(${r},${g},${b},0.16), inset 0 0 10px rgba(${r},${g},${b},0.07)`
                  : "none",
                cursor: "pointer", transition: "all 0.15s",
                whiteSpace: "nowrap",
                letterSpacing: on ? "0.01em" : "0",
                borderRadius: 6,
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* ── Tag Filter Chips ────────────────────────────────────────────────── */}
      {allTags.length > 0 && (
        <div
          className="inf-chip-scroll"
          style={{
            display: "flex", gap: 4, padding: "5px 10px 0",
            overflowX: "auto", flexShrink: 0,
            scrollbarWidth: "none",
          }}
        >
          {(["all" as const, ...allTags]).map(tag => {
            const on = activeTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                style={{
                  flexShrink: 0, padding: "5px 10px",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                  fontSize: 13, fontWeight: on ? 800 : 500,
                  border: on
                    ? "1.5px solid rgba(167,139,250,0.65)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: on
                    ? "rgba(167,139,250,0.16)"
                    : "rgba(255,255,255,0.03)",
                  color: on ? "#c4b5fd" : "rgba(255,255,255,0.55)",
                  boxShadow: on
                    ? "0 0 12px rgba(167,139,250,0.22), inset 0 0 8px rgba(167,139,250,0.06)"
                    : "none",
                  cursor: "pointer", transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {tag === "all" ? "All Tags" : tag}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Scrollable roster ───────────────────────────────────────────────── */}
      <div
        className="inf-list"
        style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          padding: "10px 8px 96px",
          scrollbarWidth: "thin",
          scrollbarColor: "#161b28 transparent",
        }}
      >

        {/* Loading — portrait skeleton grid */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 5 }}>
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                style={{
                  aspectRatio: "9 / 16",
                  background: "rgba(255,255,255,0.03)",
                  animation: "castPulse 1.8s ease-in-out infinite",
                  animationDelay: `${(i - 1) * 0.14}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Empty state — no influencers */}
        {!loading && influencers.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "40px 16px 20px", textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, marginBottom: 16,
              background: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.08), transparent 70%)",
              border: "1px solid rgba(245,158,11,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="rgba(245,158,11,0.38)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
                <path d="M20 21a8 8 0 1 0-16 0"/>
              </svg>
            </div>
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 12, fontWeight: 700, color: "#6b7391", marginBottom: 7,
              letterSpacing: "0.01em",
            }}>
              No cast members yet
            </div>
            <div style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.7,
            }}>
              Create your first AI Influencer to start building your digital cast.
            </div>
          </div>
        )}

        {/* Empty search result */}
        {!loading && influencers.length > 0 && roster.flat.length === 0 && (
          <div style={{
            padding: "28px 12px", textAlign: "center",
            fontFamily: "'Familjen Grotesk', sans-serif",
            fontSize: 12, color: "rgba(255,255,255,0.38)",
          }}>
            No cast members match &ldquo;{query}&rdquo;
          </div>
        )}

        {/* ALL tab — flat list, newest globally first. No style grouping.
            The API returns created_at DESC so roster.flat preserves that order. */}
        {!loading && activeStyle === "all" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 5 }}>
            {roster.flat.map(inf => (
              <InfluencerCard
                key={inf.id}
                influencer={inf}
                active={inf.id === activeId}
                onOpen={() => onSelect(inf)}
                onImage={() => router.push(`/studio/image?handle=${inf.handle ?? ""}`)}
                onVideo={() => router.push(`/studio/video?handle=${inf.handle ?? ""}&mode=start-frame`)}
                onLookPack={() => router.push(`/studio/character?tab=look-pack&influencer=${inf.id}`)}
                onDelete={() => setDeleteTarget(inf)}
              />
            ))}
          </div>
        )}

        {/* STYLE tabs — grouped with section header, newest-first within style */}
        {!loading && activeStyle !== "all" && [...roster.map.entries()].map(([cat, members]) => (
          <div key={cat} style={{ marginBottom: 22 }}>

            {/* Section header — Syne architectural label */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "0 2px 8px",
            }}>
              <span style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.14em", textTransform: "uppercase" as const,
              }}>
                {STYLE_LABELS[cat]}
              </span>
              <span style={{
                fontFamily: "'Familjen Grotesk', sans-serif",
                fontSize: 10, color: "rgba(255,255,255,0.30)", fontWeight: 600,
              }}>
                {members.length}
              </span>
            </div>

            {/* Single-column full-width portrait grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 5 }}>
              {members.map(inf => (
                <InfluencerCard
                  key={inf.id}
                  influencer={inf}
                  active={inf.id === activeId}
                  onOpen={() => onSelect(inf)}
                  onImage={() => router.push(`/studio/image?handle=${inf.handle ?? ""}`)}
                  onVideo={() => router.push(`/studio/video?handle=${inf.handle ?? ""}&mode=start-frame`)}
                  onLookPack={() => router.push(`/studio/character?tab=look-pack&influencer=${inf.id}`)}
                  onDelete={() => setDeleteTarget(inf)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Portrait Card ─────────────────────────────────────────────────────────────

function InfluencerCard({
  influencer, active, onOpen, onImage, onVideo, onLookPack, onDelete,
}: {
  influencer: AIInfluencer;
  active:      boolean;
  onOpen:      () => void;
  onImage:     () => void;
  onVideo:     () => void;
  onLookPack:  () => void;
  onDelete:    () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const isLocked    = !!influencer.identity_lock_id;
  const isActive    = influencer.status === "active";
  const handle      = influencer.handle      ? `@${influencer.handle}` : null;
  const displayName = influencer.display_name ?? null;
  const label       = handle ?? displayName;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      style={{
        position: "relative",
        aspectRatio: "9 / 16",
        overflow: "hidden",
        background: active ? "#0d0e0a" : "#0a0d15",
        border: active
          ? "1.5px solid rgba(245,158,11,0.72)"
          : hovered
          ? "1px solid rgba(255,255,255,0.22)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: active
          ? [
              "0 0 36px rgba(245,158,11,0.24)",
              "0 0 12px rgba(245,158,11,0.14)",
              "inset 0 0 24px rgba(245,158,11,0.07)",
              "inset 0 0 0 1px rgba(245,158,11,0.12)",
            ].join(", ")
          : hovered
          ? "0 10px 36px rgba(0,0,0,0.60)"
          : "0 2px 10px rgba(0,0,0,0.40)",
        transform: hovered && !active ? "scale(1.025)" : "scale(1)",
        transition: "all 270ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        cursor: "pointer",
      }}
    >
      {/* Active top-edge amber bar */}
      {active && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 2, zIndex: 10,
          background: "linear-gradient(90deg, transparent 0%, #f59e0b 30%, #fbbf24 50%, #f59e0b 70%, transparent 100%)",
          boxShadow: "0 0 10px rgba(245,158,11,0.70)",
        }} />
      )}

      {/* Portrait image */}
      <div style={{ position: "absolute", inset: 0 }}>
        {influencer.thumbnail_url ? (
          <img
            src={influencer.thumbnail_url}
            alt={label ?? "Cast member"}
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              display: "block",
              transform: hovered ? "scale(1.055)" : "scale(1)",
              transition: "transform 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
            draggable={false}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: "radial-gradient(ellipse at 50% 35%, rgba(245,158,11,0.06), transparent 65%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#1e2435" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
              <path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
          </div>
        )}
      </div>

      {/* Atmospheric vignette — always on, deepens on hover */}
      <div style={{
        position: "absolute", inset: 0,
        background: hovered
          ? "linear-gradient(to top, rgba(5,7,12,0.96) 0%, rgba(5,7,12,0.50) 38%, transparent 66%)"
          : "linear-gradient(to top, rgba(7,9,15,0.88) 0%, rgba(7,9,15,0.38) 38%, transparent 66%)",
        transition: "background 270ms ease",
        pointerEvents: "none",
      }} />

      {/* Bottom content stack */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        display: "flex", flexDirection: "column",
      }}>

        {/* Action strip — hover reveal */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            padding: "5px 5px 4px",
            background: "rgba(4,6,11,0.90)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex", gap: 3, alignItems: "center",
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateY(0)" : "translateY(4px)",
            transition: "opacity 220ms ease, transform 240ms ease",
          }}
        >
          <PortraitButton label="Open"  onClick={onOpen} />
          <PortraitButton label="Img"   onClick={onImage}    disabled={!isLocked} />
          <PortraitButton label="Vid"   onClick={onVideo}    disabled={!isLocked} />
          <PortraitButton label="Looks" onClick={onLookPack} disabled={!isLocked} />

          {/* Trash */}
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Remove from cast"
            style={{
              marginLeft: "auto",
              width: 20, height: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
              cursor: "pointer", flexShrink: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background   = "rgba(239,68,68,0.20)";
              (e.currentTarget as HTMLButtonElement).style.borderColor  = "rgba(239,68,68,0.42)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background   = "rgba(239,68,68,0.08)";
              (e.currentTarget as HTMLButtonElement).style.borderColor  = "rgba(239,68,68,0.18)";
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="rgba(239,68,68,0.72)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>

        {/* Identity info — always visible, lifts on hover */}
        <div style={{
          padding: "4px 7px 7px",
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          transition: "transform 270ms ease",
        }}>
          {label && (
            <div style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 12.5, fontWeight: 700,
              color: active ? "#fbbf24" : "#cdd0de",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              letterSpacing: "0.01em", marginBottom: 3,
              textShadow: "0 1px 5px rgba(0,0,0,0.90)",
            }}>
              {label}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
              background:  isActive ? "#10b981" : isLocked ? "#f59e0b" : "rgba(255,255,255,0.18)",
              boxShadow:   isActive
                ? "0 0 5px rgba(16,185,129,0.65)"
                : isLocked
                ? "0 0 5px rgba(245,158,11,0.65)"
                : "none",
            }} />
            <span style={{
              fontFamily: "'Familjen Grotesk', sans-serif",
              fontSize: 11, fontWeight: 500,
              color: isActive
                ? "rgba(16,185,129,0.80)"
                : isLocked
                ? "rgba(245,158,11,0.72)"
                : "rgba(255,255,255,0.32)",
              textShadow: "0 1px 4px rgba(0,0,0,0.95)",
            }}>
              {isActive ? "Active" : isLocked ? "Draft" : "Pending"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Portrait action button ────────────────────────────────────────────────────

function PortraitButton({
  label, onClick, disabled,
}: {
  label:    string;
  onClick:  () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        padding: "3px 7px",
        fontSize: 11, fontWeight: 600,
        fontFamily: "'Familjen Grotesk', sans-serif",
        letterSpacing: "0.03em",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.05)",
        color:   disabled ? "#1e2435" : "#6a738f",
        cursor:  disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.38 : 1,
        flexShrink: 0,
        transition: "all 0.12s",
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background  = "rgba(255,255,255,0.12)";
          (e.currentTarget as HTMLElement).style.color       = "#e8eaf0";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background  = "rgba(255,255,255,0.05)";
          (e.currentTarget as HTMLElement).style.color       = "#6a738f";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
        }
      }}
    >
      {label}
    </button>
  );
}
