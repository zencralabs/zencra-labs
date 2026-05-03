"use client";

/**
 * CDv2Shell — Creative Director v2 main orchestrator.
 *
 * Layout (standard):
 *   ┌──────────────────────────────────────────────────┐
 *   │                CDv2TopBar (64px)                 │
 *   ├─────────────┬─────────────────────┬──────────────┤
 *   │  LeftPanel  │    SceneCanvas      │  OutputPanel │
 *   │  280→56px   │     (flex:1)        │  320→78px    │
 *   │             ├─────────────────────┤              │
 *   │             │  DirectorHandle(36) │              │
 *   │             ├─────────────────────┤              │
 *   │             │   PromptDock(150px) │              │
 *   └─────────────┴─────────────────────┴──────────────┘
 *                 DirectorPanel (slides up from bottom: 186px)
 *
 * Fullscreen strategy:
 *   When isFullscreen=true, we render via React createPortal to document.body.
 *   This escapes ANY parent stacking context (transform, will-change, isolation,
 *   etc.) that would cap z-index scope. The portal div uses:
 *     position:fixed  top:0  left:0  width:100vw  height:100vh
 *     z-index:99999   isolation:isolate
 *   This guarantees the navbar is completely hidden regardless of page layout.
 *
 *   A `mounted` flag guards against SSR (document.body is client-only).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal }                              from "react-dom";
import {
  useDirectionStore,
  buildCharacterDirectionSuffix,
}                                                    from "@/lib/creative-director/store";
import { CDv2TopBar }                                from "./CDv2TopBar";
import { LeftPanel }                                 from "./LeftPanel";
import { SceneCanvas }                               from "./SceneCanvas";
import { DirectorPanel }                             from "./DirectorPanel";
import { PromptDock }                                from "./PromptDock";
import { OutputPanel }                               from "./OutputPanel";
import type { DirectionElementType }                 from "@/lib/creative-director/types";
import type { CDGenerationOutput }                   from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

interface CDv2ShellProps {
  onExitDirectorMode: () => void;
}

// DirectorHandle — slim 36px strip above PromptDock that controls DirectorPanel
function DirectorHandle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      height:         36,
      flexShrink:     0,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      borderTop:      "1px solid rgba(255,255,255,0.05)",
      background:     open ? "rgba(139,92,246,0.04)" : "rgba(0,0,0,0)",
      transition:     "background 0.2s ease",
      zIndex:         20,
    }}>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background:    hov ? "rgba(255,255,255,0.05)" : "transparent",
          border:        `1px solid ${open ? "rgba(139,92,246,0.3)" : hov ? "rgba(255,255,255,0.1)" : "transparent"}`,
          borderRadius:  100,
          color:         open ? "rgba(139,92,246,0.9)" : hov ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.3)",
          cursor:        "pointer",
          padding:       "4px 16px",
          fontSize:      10,
          fontFamily:    "var(--font-sans)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          display:       "flex",
          alignItems:    "center",
          gap:           7,
          transition:    "all 0.15s ease",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.7 2.7l1.06 1.06M8.24 8.24l1.06 1.06M2.7 9.3l1.06-1.06M8.24 3.76l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {open ? "Close Director Controls" : "Open Director Controls"}
        <span style={{ opacity: 0.5, fontSize: 8 }}>{open ? "▼" : "▲"}</span>
      </button>
    </div>
  );
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
    selectedModel,
    characterDirection,
    directorPanelOpen,
    markDirectionCreated,
    addElement,
    startGenerating,
    finishGenerating,
    patchRefinements,
    toggleDirectorPanel,
    openDirectorPanel,
    assignAssetToRole,
  } = useDirectionStore();

  const [isFullscreen,   setIsFullscreen]   = useState(false);
  const [leftCollapsed,  setLeftCollapsed]  = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  // Guard: createPortal needs document.body — only available on client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
    async (count: number = 1, aspectRatio: string = "1:1", _quality?: string) => {
      const dId = await ensureDirection();
      if (!dId) return;
      if (refinements && Object.keys(refinements).length > 0) {
        await syncRefinements(dId, refinements as Record<string, unknown>);
      }
      startGenerating();
      const promptSuffix = buildCharacterDirectionSuffix(characterDirection);
      try {
        const res = await fetch("/api/creative-director/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directionId:   dId,
            count,
            aspectRatio,
            modelOverride: selectedModel,
            promptSuffix:  promptSuffix || undefined,
          }),
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
    [ensureDirection, refinements, syncRefinements, startGenerating, finishGenerating, selectedModel, characterDirection]
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

  // ── Layout constants ──────────────────────────────────────────────────────
  // Collapsed widths: left 56px (icon rail), right 78px (thumbnail strip).
  // Expanded widths grow in fullscreen for extra breathing room.
  const leftW  = leftCollapsed  ? 56  : (isFullscreen ? 320 : 280);
  const rightW = rightCollapsed ? 78  : (isFullscreen ? 380 : 320);

  // DirectorPanel bottom offset: handle(36) + dock(150) = 186
  const DOCK_HEIGHT     = 150;
  const HANDLE_HEIGHT   = 36;
  const DIRECTOR_BOTTOM = DOCK_HEIGHT + HANDLE_HEIGHT; // 186

  // ── CD v2 CSS keyframes ───────────────────────────────────────────────────
  const cdKeyframes = `
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
    @keyframes cd-spring {
      0%   { transform: scale(0.82); opacity: 0; }
      55%  { transform: scale(1.06); opacity: 1; }
      75%  { transform: scale(0.97); opacity: 1; }
      100% { transform: scale(1.00); opacity: 1; }
    }
    .cd-btn-lift { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .cd-btn-lift:hover { transform: translateY(-2px); }
    .cd-btn-lift:active { transform: translateY(0) scale(0.97); }
    .cd-node-hover:hover { animation: cd-node-glow 2s ease-in-out infinite; }
    .cd-model-pill { transition: all 0.12s ease; }
    .cd-model-pill:hover { background: rgba(255,255,255,0.07) !important; }
  `;

  // ── Shell content (shared between normal and portal/fullscreen render) ────
  const shellContent = (
    <div
      style={{
        // Fullscreen: fixed overlay that escapes ALL parent stacking contexts
        // via React portal. Normal: fills the parent container.
        position:    isFullscreen ? "fixed"  : "relative",
        top:         isFullscreen ? 0        : undefined,
        left:        isFullscreen ? 0        : undefined,
        width:       isFullscreen ? "100vw"  : "100%",
        height:      isFullscreen ? "100vh"  : "100%",
        zIndex:      isFullscreen ? 99999    : undefined,
        isolation:   isFullscreen ? "isolate": undefined,
        // Core styles always applied
        display:       "flex",
        flexDirection: "column",
        background:    "#03040a",
        overflow:      "hidden",
      }}
    >
      {/* Keyframes injected here so they travel with the portal */}
      <style>{cdKeyframes}</style>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <CDv2TopBar
        onExitDirectorMode={onExitDirectorMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((f) => !f)}
      />

      {/* ── 3-zone body ──────────────────────────────────────────────── */}
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
        <LeftPanel
          onAddElement={handleAddElement}
          onEnsureDirection={ensureDirection}
          onCollapsedChange={setLeftCollapsed}
        />

        {/* Center: canvas → handle → dock (+ director overlay) */}
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
          {/* Scene canvas — takes remaining height */}
          <SceneCanvas
            onAddElement={handleAddElement}
            onOpenDirectorControls={openDirectorPanel}
            onDropAsset={(assetId, role) => assignAssetToRole(assetId, role)}
          />

          {/* Director handle — slim strip toggling the panel */}
          <DirectorHandle open={directorPanelOpen} onToggle={toggleDirectorPanel} />

          {/* Prompt dock */}
          <PromptDock onGenerate={handleGenerate} isFullscreen={isFullscreen} />

          {/* Director panel — slides up from bottom: 176px */}
          <DirectorPanel
            onRefinementChange={handleRefinementChange}
            bottomOffset={DIRECTOR_BOTTOM}
          />
        </div>

        {/* Right output stream */}
        <OutputPanel onCollapsedChange={setRightCollapsed} />
      </div>
    </div>
  );

  // ── Portal to document.body when fullscreen (client-only) ────────────────
  // This is the ONLY reliable way to escape parent stacking contexts
  // (transform / will-change / isolation on any ancestor).
  if (isFullscreen && mounted) {
    return createPortal(shellContent, document.body);
  }

  return shellContent;
}
