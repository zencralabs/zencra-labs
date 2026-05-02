"use client";

/**
 * CDv2TopBar — 64px premium sub-header for Creative Director v2.
 *
 * Layout:
 *   [← Studio]  [Scene name]   [  Explore ●● Locked  ]   [Director]  [⤢ Fullscreen]
 *
 * Mode switch: sliding 3D pill highlight with CSS left: transition.
 * Director button: 48px, cinematic glow on active.
 * Fullscreen: cinema frame icon — toggles position:fixed layout.
 */

import { useState }            from "react";
import { useDirectionStore }   from "@/lib/creative-director/store";
import type { DirectionMode }  from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface CDv2TopBarProps {
  onExitDirectorMode?:    () => void;
  isFullscreen:           boolean;
  onToggleFullscreen:     () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function CDv2TopBar({ onExitDirectorMode, isFullscreen, onToggleFullscreen }: CDv2TopBarProps) {
  const {
    mode,
    directionId,
    directionCreated,
    sceneIntent,
    toggleDirectorPanel,
    directorPanelOpen,
    setMode,
  } = useDirectionStore();

  const [backHover, setBackHover]       = useState(false);
  const [directorHover, setDirectorHover] = useState(false);
  const [fsHover, setFsHover]           = useState(false);

  async function handleModeToggle(next: DirectionMode) {
    if (next === mode) return;
    setMode(next);
    if (!directionId || !directionCreated) return;
    try {
      await fetch(`/api/creative-director/directions/${directionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_locked: next === "locked" }),
      });
    } catch { /* silent — store already updated */ }
  }

  const sceneName = sceneIntent.text.trim() || "Untitled Scene";

  // Pill highlight: left = 2px for explore, 50% for locked
  const pillLeft = mode === "locked" ? "calc(50% + 2px)" : "2px";

  return (
    <div
      style={{
        height:          64,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        padding:         "0 20px",
        borderBottom:    "1px solid rgba(255,255,255,0.07)",
        background:      "rgba(8,8,11,0.98)",
        backdropFilter:  "blur(20px)",
        gap:             16,
        flexShrink:      0,
        position:        "relative",
        zIndex:          50,
      }}
    >
      {/* ── Left: back + breadcrumb ────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
        <button
          onClick={onExitDirectorMode}
          onMouseEnter={() => setBackHover(true)}
          onMouseLeave={() => setBackHover(false)}
          style={{
            background:   backHover ? "rgba(255,255,255,0.06)" : "transparent",
            border:       "1px solid",
            borderColor:  backHover ? "rgba(255,255,255,0.12)" : "transparent",
            borderRadius: 8,
            color:        backHover ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
            fontSize:     12,
            cursor:       "pointer",
            padding:      "6px 12px",
            display:      "flex",
            alignItems:   "center",
            gap:          6,
            fontFamily:   "var(--font-sans)",
            whiteSpace:   "nowrap",
            transition:   "all 0.15s ease",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Image Studio
        </button>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />

        {/* Scene name */}
        <span
          style={{
            fontSize:     13,
            fontFamily:   "var(--font-display)",
            color:        "rgba(255,255,255,0.6)",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
            maxWidth:     220,
          }}
        >
          {sceneName}
        </span>

        {/* Animated mode badge */}
        <span
          style={{
            fontSize:      10,
            fontFamily:    "var(--font-sans)",
            color:         mode === "locked" ? "rgba(251,191,36,0.85)" : "rgba(139,92,246,0.85)",
            background:    mode === "locked" ? "rgba(251,191,36,0.08)" : "rgba(139,92,246,0.08)",
            border:        `1px solid ${mode === "locked" ? "rgba(251,191,36,0.18)" : "rgba(139,92,246,0.18)"}`,
            borderRadius:  100,
            padding:       "3px 10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            flexShrink:    0,
            transition:    "all 0.3s ease",
          }}
        >
          {mode === "locked" ? "🔒 Locked" : "◎ Explore"}
        </span>
      </div>

      {/* ── Center: 3D pill mode switch ────────────────────────────────── */}
      <div
        style={{
          position:      "relative",
          display:       "flex",
          alignItems:    "center",
          background:    "rgba(255,255,255,0.04)",
          border:        "1px solid rgba(255,255,255,0.09)",
          borderRadius:  12,
          padding:       2,
          gap:           0,
          flexShrink:    0,
          width:         220,
          height:        44,
        }}
      >
        {/* Sliding highlight */}
        <div
          style={{
            position:     "absolute",
            top:          2,
            left:         pillLeft,
            width:        "calc(50% - 4px)",
            height:       "calc(100% - 4px)",
            borderRadius: 9,
            background:   mode === "locked"
              ? "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(245,158,11,0.12) 100%)"
              : "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(109,40,217,0.12) 100%)",
            border:       `1px solid ${mode === "locked" ? "rgba(251,191,36,0.25)" : "rgba(139,92,246,0.25)"}`,
            boxShadow:    mode === "locked"
              ? "0 0 12px rgba(251,191,36,0.15)"
              : "0 0 12px rgba(139,92,246,0.15)",
            transition:   "left 0.25s cubic-bezier(0.16,1,0.3,1), background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
            pointerEvents: "none",
          }}
        />

        {/* Explore button */}
        <button
          onClick={() => void handleModeToggle("explore")}
          style={{
            flex:         1,
            background:   "transparent",
            border:       "none",
            borderRadius: 9,
            color:        mode === "explore" ? "rgba(139,92,246,1)" : "rgba(255,255,255,0.35)",
            fontSize:     12,
            fontFamily:   "var(--font-sans)",
            fontWeight:   mode === "explore" ? 600 : 400,
            cursor:       "pointer",
            height:       "100%",
            letterSpacing: "0.03em",
            transition:   "color 0.25s ease",
            position:     "relative",
            zIndex:       1,
          }}
        >
          Explore
        </button>

        {/* Locked button */}
        <button
          onClick={() => void handleModeToggle("locked")}
          style={{
            flex:         1,
            background:   "transparent",
            border:       "none",
            borderRadius: 9,
            color:        mode === "locked" ? "rgba(251,191,36,1)" : "rgba(255,255,255,0.35)",
            fontSize:     12,
            fontFamily:   "var(--font-sans)",
            fontWeight:   mode === "locked" ? 600 : 400,
            cursor:       "pointer",
            height:       "100%",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            gap:          5,
            letterSpacing: "0.03em",
            transition:   "color 0.25s ease",
            position:     "relative",
            zIndex:       1,
          }}
        >
          {mode === "locked" && <span style={{ fontSize: 11 }}>🔒</span>}
          Locked
        </button>
      </div>

      {/* ── Right: Director + Fullscreen ───────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>

        {/* Director Panel toggle */}
        <button
          onClick={toggleDirectorPanel}
          onMouseEnter={() => setDirectorHover(true)}
          onMouseLeave={() => setDirectorHover(false)}
          style={{
            background:   directorPanelOpen
              ? "rgba(139,92,246,0.15)"
              : directorHover ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
            border:       `1px solid ${directorPanelOpen ? "rgba(139,92,246,0.35)" : directorHover ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.09)"}`,
            borderRadius: 10,
            color:        directorPanelOpen ? "rgba(139,92,246,1)" : directorHover ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.45)",
            fontSize:     12,
            fontFamily:   "var(--font-sans)",
            cursor:       "pointer",
            padding:      "0 16px",
            height:       44,
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            transition:   "all 0.18s ease",
            letterSpacing: "0.02em",
            boxShadow:    directorPanelOpen ? "0 0 20px rgba(139,92,246,0.2)" : "none",
          }}
        >
          {/* Cine settings icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.42 1.42M11.18 11.18l1.42 1.42M3.4 12.6l1.42-1.42M11.18 4.82l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Director
          {directorPanelOpen && (
            <div
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "rgba(139,92,246,1)",
                boxShadow: "0 0 6px rgba(139,92,246,0.8)",
              }}
            />
          )}
        </button>

        {/* Fullscreen / Cinema Mode button */}
        <button
          onClick={onToggleFullscreen}
          onMouseEnter={() => setFsHover(true)}
          onMouseLeave={() => setFsHover(false)}
          title={isFullscreen ? "Exit Cinema Mode" : "Enter Cinema Mode"}
          style={{
            background:   isFullscreen
              ? "rgba(251,191,36,0.12)"
              : fsHover ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
            border:       `1px solid ${isFullscreen ? "rgba(251,191,36,0.3)" : fsHover ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.09)"}`,
            borderRadius: 10,
            color:        isFullscreen ? "rgba(251,191,36,0.95)" : fsHover ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
            cursor:       "pointer",
            width:        44,
            height:       44,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            transition:   "all 0.18s ease",
            boxShadow:    isFullscreen ? "0 0 16px rgba(251,191,36,0.15)" : "none",
          }}
        >
          {isFullscreen ? (
            /* Minimize icon */
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 6h4V2M6 10H2v4M10 6l4-4M6 10l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            /* Maximize / cinema icon */
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
