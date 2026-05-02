"use client";

/**
 * CDv2TopBar — sub-header for Creative Director v2 mode.
 *
 * Layout:
 *   [← Image Studio]  [breadcrumb: Scene / Direction name]   [Explore | Locked]  [Director ⚙]
 *
 * Explore / Locked toggle writes to Supabase via PATCH /api/creative-director/directions/[id]
 * (fire-and-forget — optimistic update in store).
 *
 * Director button opens / closes the DirectorPanel bottom overlay.
 */

import { useDirectionStore } from "@/lib/creative-director/store";
import type { DirectionMode } from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface CDv2TopBarProps {
  onExitDirectorMode?: () => void;  // calls setStudioMode("standard") in image/page
}

export function CDv2TopBar({ onExitDirectorMode }: CDv2TopBarProps) {
  const {
    mode,
    directionId,
    directionCreated,
    sceneIntent,
    toggleDirectorPanel,
    directorPanelOpen,
    setMode,
  } = useDirectionStore();

  // ── Optimistic mode toggle ────────────────────────────────────────────────
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
    } catch {
      // Non-critical — store has the update; DB will sync on next generate
    }
  }

  const sceneName = sceneIntent.text.trim() || "Untitled Scene";

  return (
    <div
      style={{
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(12px)",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* ── Left: back button + breadcrumb ─────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button
          onClick={onExitDirectorMode}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.4)",
            fontSize: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: 6,
            transition: "color 0.15s",
            fontFamily: "var(--font-sans)",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Image Studio
        </button>

        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>/</span>

        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-display)",
            color: "rgba(255,255,255,0.7)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 200,
          }}
        >
          {sceneName}
        </span>

        {/* Mode pill */}
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-sans)",
            color: mode === "locked" ? "rgba(251,191,36,0.9)" : "rgba(99,102,241,0.9)",
            background: mode === "locked" ? "rgba(251,191,36,0.1)" : "rgba(99,102,241,0.1)",
            border: `1px solid ${mode === "locked" ? "rgba(251,191,36,0.2)" : "rgba(99,102,241,0.2)"}`,
            borderRadius: 100,
            padding: "2px 8px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {mode === "locked" ? "🔒 Locked" : "Explore"}
        </span>
      </div>

      {/* ── Center: mode toggle ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: 2,
          gap: 2,
          flexShrink: 0,
        }}
      >
        {(["explore", "locked"] as DirectionMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeToggle(m)}
            style={{
              background: mode === m
                ? m === "locked"
                  ? "rgba(251,191,36,0.15)"
                  : "rgba(99,102,241,0.15)"
                : "transparent",
              border: "none",
              borderRadius: 6,
              color: mode === m
                ? m === "locked" ? "rgba(251,191,36,1)" : "rgba(139,92,246,1)"
                : "rgba(255,255,255,0.35)",
              fontSize: 11,
              fontFamily: "var(--font-sans)",
              fontWeight: mode === m ? 600 : 400,
              cursor: "pointer",
              padding: "4px 12px",
              transition: "all 0.15s",
              letterSpacing: "0.03em",
            }}
          >
            {m === "explore" ? "Explore" : "Locked"}
          </button>
        ))}
      </div>

      {/* ── Right: Director panel button ───────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={toggleDirectorPanel}
          title="Open Director Panel"
          style={{
            background: directorPanelOpen
              ? "rgba(139,92,246,0.15)"
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${directorPanelOpen ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 8,
            color: directorPanelOpen ? "rgba(139,92,246,1)" : "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontFamily: "var(--font-sans)",
            cursor: "pointer",
            padding: "5px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Director
        </button>
      </div>
    </div>
  );
}
