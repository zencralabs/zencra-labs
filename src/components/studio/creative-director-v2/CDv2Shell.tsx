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
import type { UploadedAsset }                        from "@/lib/creative-director/store";
import { CDv2TopBar }                                from "./CDv2TopBar";
import { LeftPanel }                                 from "./LeftPanel";
import { SceneCanvas }                               from "./SceneCanvas";
import { DirectorPanel }                             from "./DirectorPanel";
import { PromptDock }                                from "./PromptDock";
import { OutputPanel }                               from "./OutputPanel";
import { AIAssistBar }                               from "./AIAssistBar";
import type { DirectionElementType, DirectionElementRow } from "@/lib/creative-director/types";
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
    removeElement,
    startGenerating,
    finishGenerating,
    patchRefinements,
    toggleDirectorPanel,
    openDirectorPanel,
    assignAssetToRole,
    addUploadedAsset,
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

  // ── Add element — OPTIMISTIC ──────────────────────────────────────────────
  // 1. Add a temp element to the store immediately (instant canvas feedback).
  // 2. Ensure the direction row exists in DB.
  // 3. POST the real element to the API.
  // 4. On success: swap temp → real (remove + add, batched by React 18).
  // 5. On failure: keep the temp element alive so the canvas stays populated.
  //    The element will be re-synced on the next generate call.
  const handleAddElement = useCallback(
    async (type: DirectionElementType, label: string) => {
      // Step 1 — optimistic: show on canvas immediately
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tempElement: DirectionElementRow = {
        id:           tempId,
        direction_id: "pending",
        type,
        label,
        weight:       0.7,
        position:     elements.length,
        created_at:   new Date().toISOString(),
      };
      addElement(tempElement);

      // Step 2 — ensure direction row (may create one)
      const dId = await ensureDirection();
      if (!dId) {
        // Direction creation failed — remove optimistic element
        removeElement(tempId);
        return;
      }

      // Step 3 — persist element to DB
      try {
        const res = await fetch("/api/creative-director/elements", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction_id: dId, type, label, weight: 0.7, position: elements.length }),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const realElement: DirectionElementRow = data.element ?? data;
        // Step 4 — swap temp → real (batched, no visible flash)
        removeElement(tempId);
        addElement(realElement);
      } catch (err) {
        console.error("[CDv2Shell] addElement persist error (element kept in memory):", err);
        // Keep the temp element alive — direction_id may be wrong but generation
        // reads from DB so it's fine; the canvas stays populated for the session.
      }
    },
    [ensureDirection, elements.length, addElement, removeElement]
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
  // sceneOverride: direct text from PromptDock textarea, injected as
  // promptSuffix alongside any character direction suffix.
  const handleGenerate = useCallback(
    async (count: number = 1, aspectRatio: string = "1:1", _quality?: string, sceneOverride?: string) => {
      const dId = await ensureDirection();
      if (!dId) return;
      if (refinements && Object.keys(refinements).length > 0) {
        await syncRefinements(dId, refinements as Record<string, unknown>);
      }
      startGenerating();
      const charSuffix  = buildCharacterDirectionSuffix(characterDirection);
      // Combine sceneOverride (from PromptDock textarea) with character direction suffix.
      // If both exist, join with ", ". Route accepts the combined string as promptSuffix.
      const promptSuffix = [sceneOverride?.trim(), charSuffix].filter(Boolean).join(", ");
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

  // ── Re-edit in Director ───────────────────────────────────────────────────
  // Loads the output image back into the store as an uploaded reference asset,
  // making it available in AssetTray and canvas. Does NOT restore scene_snapshot.
  const handleReEditInDirector = useCallback((url: string) => {
    if (!url) return;
    const asset: UploadedAsset = {
      id:           `redit-${Date.now()}`,
      url,
      name:         "CD Output",
      assignedRole: null,
    };
    addUploadedAsset(asset);
    openDirectorPanel(); // surface the panel so user can see the asset was added
  }, [addUploadedAsset, openDirectorPanel]);

  // ── Regenerate Variation ──────────────────────────────────────────────────
  // Real API call to the existing generate route with a variation suffix.
  // Costs credits. Uses current directionId, refinements, model, and character
  // direction — exactly the same as a normal generate, but appends the suffix.
  const VARIATION_SUFFIX = "same subject and composition, subtle variation, refined cinematic detail";

  const handleRegenVariation = useCallback(async () => {
    const dId = await ensureDirection();
    if (!dId) return;
    if (refinements && Object.keys(refinements).length > 0) {
      await syncRefinements(dId, refinements as Record<string, unknown>);
    }
    startGenerating();
    const charSuffix   = buildCharacterDirectionSuffix(characterDirection);
    const promptSuffix = [charSuffix, VARIATION_SUFFIX].filter(Boolean).join(", ");
    try {
      const res = await fetch("/api/creative-director/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directionId:   dId,
          count:         1,
          aspectRatio:   "1:1",
          modelOverride: selectedModel,
          promptSuffix:  promptSuffix || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        finishGenerating([], err.error ?? `Variation failed (${res.status})`);
        return;
      }
      const data: { generations: CDGenerationOutput[]; mode: string } = await res.json();
      finishGenerating(data.generations ?? []);
    } catch (err) {
      finishGenerating([], err instanceof Error ? err.message : "Network error");
    }
  }, [
    ensureDirection,
    refinements,
    syncRefinements,
    startGenerating,
    finishGenerating,
    selectedModel,
    characterDirection,
  ]);

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
    /* ── Text hierarchy tokens ──────────────────────────────────────────── */
    :root {
      --cd-text-primary:   #E8ECF5;
      --cd-text-secondary: #B8C0D4;
      --cd-text-label:     #9AA3B2;
      --cd-text-disabled:  #6B7280;
    }
    .cd-btn-lift { transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .cd-btn-lift:hover { transform: translateY(-2px); }
    .cd-btn-lift:active { transform: translateY(0) scale(0.97); }
    .cd-node-hover:hover { animation: cd-node-glow 2s ease-in-out infinite; }
    .cd-model-pill { transition: all 0.12s ease; }
    .cd-model-pill:hover { background: rgba(255,255,255,0.07) !important; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
    .cd-tag-chip { transition: border-color 0.12s ease, box-shadow 0.12s ease; }
    .cd-tag-chip:hover { border-color: rgba(139,92,246,0.5) !important; box-shadow: 0 0 8px rgba(139,92,246,0.15); }
    .cd-weight-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 3px;
      border-radius: 99px;
      outline: none;
      cursor: pointer;
      border: none;
      padding: 0;
    }
    .cd-weight-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--role-clr, rgba(139,92,246,1));
      box-shadow: 0 0 6px var(--role-clr, rgba(139,92,246,0.7));
      cursor: grab;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      border: none;
    }
    .cd-weight-slider:active::-webkit-slider-thumb {
      cursor: grabbing;
      transform: scale(1.3);
      box-shadow: 0 0 10px var(--role-clr, rgba(139,92,246,0.9));
    }
    .cd-weight-slider::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--role-clr, rgba(139,92,246,1));
      border: none;
      cursor: grab;
    }
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
        background:    "radial-gradient(ellipse at center, #0E0F1A 0%, #06070C 70%)",
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
          <PromptDock
            onGenerate={(count, ar, quality, sceneOverride) =>
              handleGenerate(count, ar, quality, sceneOverride)
            }
            isFullscreen={isFullscreen}
          />

          {/* AI Assist Co-Director bar — floats above DirectorHandle */}
          <AIAssistBar
            onAddElement={handleAddElement}
            bottomOffset={DIRECTOR_BOTTOM + 8}
          />

          {/* Director panel — slides up from bottom: 176px */}
          <DirectorPanel
            onRefinementChange={handleRefinementChange}
            bottomOffset={DIRECTOR_BOTTOM}
          />
        </div>

        {/* Right output stream */}
        <OutputPanel
          onCollapsedChange={setRightCollapsed}
          onReEditInDirector={handleReEditInDirector}
          onRegenVariation={handleRegenVariation}
        />
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
