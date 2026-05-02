"use client";

/**
 * CDv2Shell — Creative Director v2 main orchestrator.
 *
 * 3-zone layout (standard) or fullscreen (position:fixed z-1000):
 *   ┌──────────────────────────────────────────────────┐
 *   │                CDv2TopBar (64px)                 │
 *   ├─────────────┬─────────────────────┬──────────────┤
 *   │  LeftPanel  │    SceneCanvas      │  OutputPanel │
 *   │   (280px)   │     (flex:1)        │   (320px)    │
 *   └─────────────┴─────────────────────┴──────────────┘
 *                 DirectorPanel (bottom overlay, slide-up)
 *                 PromptDock (fixed 80px bottom of center zone)
 *
 * Fullscreen mode: position:fixed inset:0 z-index:1000 — navbar naturally hidden.
 * Enter via Maximize button in TopBar; exit via Minimize button.
 */

import { useCallback, useRef, useState } from "react";
import { useDirectionStore }              from "@/lib/creative-director/store";
import { CDv2TopBar }                     from "./CDv2TopBar";
import { LeftPanel }                      from "./LeftPanel";
import { SceneCanvas }                    from "./SceneCanvas";
import { DirectorPanel }                  from "./DirectorPanel";
import { PromptDock }                     from "./PromptDock";
import { OutputPanel }                    from "./OutputPanel";
import type { DirectionElementType }      from "@/lib/creative-director/types";
import type { CDGenerationOutput }        from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

interface CDv2ShellProps {
  onExitDirectorMode: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export function CDv2Shell({ onExitDirectorMode }: CDv2ShellProps) {
  const {
    directionId,
    directionCreated,
    mode,
    elements,
    refinements,
    sceneIntent,
    markDirectionCreated,
    addElement,
    startGenerating,
    finishGenerating,
    patchRefinements,
  } = useDirectionStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const creatingRef = useRef(false);

  // ── Ensure direction row exists ───────────────────────────────────────────
  const ensureDirection = useCallback(async (): Promise<string | null> => {
    if (directionCreated && directionId) return directionId;
    if (creatingRef.current) return directionId;
    creatingRef.current = true;
    try {
      const res = await fetch("/api/creative-director/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:      sceneIntent.text.trim() || undefined,
          is_locked: mode === "locked",
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const id: string = data.direction?.id ?? data.id;
      if (!id) return null;
      markDirectionCreated(id, data.direction?.direction_version ?? 1);
      return id;
    } catch {
      return null;
    } finally {
      creatingRef.current = false;
    }
  }, [directionId, directionCreated, mode, sceneIntent.text, markDirectionCreated]);

  // ── Add element ───────────────────────────────────────────────────────────
  const handleAddElement = useCallback(
    async (type: DirectionElementType, label: string) => {
      const dId = await ensureDirection();
      if (!dId) return;
      try {
        const res = await fetch("/api/creative-director/elements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction_id: dId, type, label, weight: 0.7, position: elements.length }),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        addElement(data.element ?? data);
      } catch (err) {
        console.error("[CDv2Shell] addElement error:", err);
      }
    },
    [ensureDirection, elements.length, addElement]
  );

  // ── Sync refinements ──────────────────────────────────────────────────────
  const syncRefinements = useCallback(async (dId: string, patch: Record<string, unknown>) => {
    try {
      await fetch("/api/creative-director/refinements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction_id: dId, ...patch }),
      });
    } catch { /* silent */ }
  }, []);

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(
    async (count: number = 1, aspectRatio: string = "1:1") => {
      const dId = await ensureDirection();
      if (!dId) return;
      if (refinements && Object.keys(refinements).length > 0) {
        await syncRefinements(dId, refinements as Record<string, unknown>);
      }
      startGenerating();
      try {
        const res = await fetch("/api/creative-director/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directionId: dId, count, aspectRatio }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          finishGenerating([], err.error ?? `Generation failed (${res.status})`);
          return;
        }
        const data: { generations: CDGenerationOutput[]; mode: string } = await res.json();
        finishGenerating(data.generations ?? []);
      } catch (err) {
        finishGenerating([], err instanceof Error ? err.message : "Network error");
      }
    },
    [ensureDirection, refinements, syncRefinements, startGenerating, finishGenerating]
  );

  // ── Refinement change ─────────────────────────────────────────────────────
  const handleRefinementChange = useCallback(
    async (key: string, value: unknown) => {
      patchRefinements({ [key]: value } as Parameters<typeof patchRefinements>[0]);
      if (directionId && directionCreated) {
        void syncRefinements(directionId, { [key]: value });
      }
    },
    [patchRefinements, directionId, directionCreated, syncRefinements]
  );

  // ── Fullscreen left-panel width ───────────────────────────────────────────
  const leftW  = isFullscreen ? 320 : 280;
  const rightW = isFullscreen ? 380 : 320;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── CD v2 keyframes — injected once ──────────────────────────────── */}
      <style>{`
        @keyframes cd-node-glow {
          0%, 100% { box-shadow: 0 0 12px rgba(139,92,246,0.15), 0 2px 12px rgba(0,0,0,0.5); }
          50%       { box-shadow: 0 0 24px rgba(139,92,246,0.35), 0 4px 20px rgba(0,0,0,0.5); }
        }
        @keyframes cd-generate-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.3), 0 4px 24px rgba(0,0,0,0.4); }
          50%       { box-shadow: 0 0 40px rgba(139,92,246,0.55), 0 4px 30px rgba(0,0,0,0.4); }
        }
        @keyframes cd-locked-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(251,191,36,0.3), 0 4px 24px rgba(0,0,0,0.4); }
          50%       { box-shadow: 0 0 40px rgba(251,191,36,0.55), 0 4px 30px rgba(0,0,0,0.4); }
        }
        @keyframes cd-slide-up {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes cd-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cd-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes cd-shimmer {
          0%   { background-position: -400% center; }
          100% { background-position: 400% center; }
        }
        .cd-btn-lift { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .cd-btn-lift:hover { transform: translateY(-2px); }
        .cd-btn-lift:active { transform: translateY(0) scale(0.97); }
        .cd-node-hover:hover { animation: cd-node-glow 2s ease-in-out infinite; }
        .cd-card-control:hover { background: rgba(255,255,255,0.07) !important; }
      `}</style>

      <div
        style={{
          display:        "flex",
          flexDirection:  "column",
          background:     "#050507",
          overflow:       "hidden",
          position:       isFullscreen ? "fixed" : "relative",
          inset:          isFullscreen ? 0 : undefined,
          zIndex:         isFullscreen ? 1000 : undefined,
          width:          isFullscreen ? "100vw" : "100%",
          height:         isFullscreen ? "100vh" : "100%",
          transition:     "all 0.35s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* ── Top bar ────────────────────────────────────────────────── */}
        <CDv2TopBar
          onExitDirectorMode={onExitDirectorMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((f) => !f)}
        />

        {/* ── 3-zone body ──────────────────────────────────────────── */}
        <div
          style={{
            flex:                1,
            display:             "grid",
            gridTemplateColumns: `${leftW}px 1fr ${rightW}px`,
            overflow:            "hidden",
            transition:          "grid-template-columns 0.35s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {/* Left assist panel */}
          <LeftPanel onAddElement={handleAddElement} onEnsureDirection={ensureDirection} />

          {/* Center canvas + dock + director */}
          <div
            style={{
              position:      "relative",
              display:       "flex",
              flexDirection: "column",
              overflow:      "hidden",
              borderLeft:    "1px solid rgba(255,255,255,0.05)",
              borderRight:   "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <SceneCanvas onAddElement={handleAddElement} />
            <PromptDock onGenerate={handleGenerate} isFullscreen={isFullscreen} />
            <DirectorPanel onRefinementChange={handleRefinementChange} />
          </div>

          {/* Right output stream */}
          <OutputPanel />
        </div>
      </div>
    </>
  );
}
