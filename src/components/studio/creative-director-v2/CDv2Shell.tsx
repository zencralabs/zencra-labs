"use client";

/**
 * CDv2Shell — Creative Director v2 main orchestrator.
 *
 * 3-zone layout:
 *   ┌──────────────────────────────────────────────────┐
 *   │                  CDv2TopBar (48px)               │
 *   ├─────────────┬─────────────────────┬──────────────┤
 *   │  LeftPanel  │    SceneCanvas      │  OutputPanel │
 *   │   (280px)   │     (flex:1)        │   (320px)    │
 *   └─────────────┴─────────────────────┴──────────────┘
 *                 DirectorPanel (bottom overlay)
 *                 PromptDock (fixed inside center zone)
 *
 * ─── DIRECTION LIFECYCLE ─────────────────────────────────────────────────────
 * Direction row is NOT created on mount. It is created on the first user
 * interaction (text typed, element added, image uploaded). This is enforced by
 * ensureDirection(), which creates the row via POST /api/creative-director/directions
 * on the first call, then no-ops on subsequent calls.
 *
 * ─── GENERATE FLOW ───────────────────────────────────────────────────────────
 * 1. ensureDirection() → guarantee a direction row exists
 * 2. POST /api/creative-director/generate → returns { generations, mode }
 * 3. finishGenerating(outputs) → store receives outputs, OutputPanel renders
 *
 * ─── STYLE MOOD → REFINEMENTS SYNC ───────────────────────────────────────────
 * When a style mood chip is selected in LeftPanel, the store patches refinements
 * locally. The sync to DB happens on generate or when the panel saves explicitly.
 */

import { useCallback, useRef }      from "react";
import { useDirectionStore }         from "@/lib/creative-director/store";
import { CDv2TopBar }                from "./CDv2TopBar";
import { LeftPanel }                 from "./LeftPanel";
import { SceneCanvas }               from "./SceneCanvas";
import { DirectorPanel }             from "./DirectorPanel";
import { PromptDock }                from "./PromptDock";
import { OutputPanel }               from "./OutputPanel";
import type { DirectionElementType } from "@/lib/creative-director/types";
import type { CDGenerationOutput }   from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

interface CDv2ShellProps {
  /** Called when user clicks "← Image Studio" in top bar */
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

  // Prevent concurrent direction-creation races
  const creatingRef = useRef(false);

  // ── Ensure a direction row exists ─────────────────────────────────────────
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

      if (!res.ok) {
        console.error("[CDv2Shell] Failed to create direction:", res.status);
        return null;
      }

      const data = await res.json();
      const id: string = data.direction?.id ?? data.id;
      if (!id) {
        console.error("[CDv2Shell] No direction id in response");
        return null;
      }

      markDirectionCreated(id, data.direction?.direction_version ?? 1);
      return id;
    } catch (err) {
      console.error("[CDv2Shell] ensureDirection error:", err);
      return null;
    } finally {
      creatingRef.current = false;
    }
  }, [directionId, directionCreated, mode, sceneIntent.text, markDirectionCreated]);

  // ── Add element to scene (called by SceneCanvas node drop / LeftPanel add) ─
  const handleAddElement = useCallback(
    async (type: DirectionElementType, label: string) => {
      const dId = await ensureDirection();
      if (!dId) return;

      try {
        const res = await fetch("/api/creative-director/elements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction_id: dId,
            type,
            label,
            weight:   0.7,
            position: elements.length,
          }),
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

  // ── Sync refinements to DB ─────────────────────────────────────────────────
  const syncRefinements = useCallback(
    async (dId: string, patch: Record<string, unknown>) => {
      try {
        await fetch("/api/creative-director/refinements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction_id: dId, ...patch }),
        });
      } catch (err) {
        console.error("[CDv2Shell] syncRefinements error:", err);
      }
    },
    []
  );

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(
    async (count: number = 1, aspectRatio: string = "1:1") => {
      const dId = await ensureDirection();
      if (!dId) return;

      // Sync current refinements before generate
      if (refinements && Object.keys(refinements).length > 0) {
        await syncRefinements(dId, refinements as Record<string, unknown>);
      }

      startGenerating();
      try {
        const res = await fetch("/api/creative-director/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directionId: dId,
            count,
            aspectRatio,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err.error ?? `Generation failed (${res.status})`;
          finishGenerating([], msg);
          return;
        }

        const data: { generations: CDGenerationOutput[]; mode: string } = await res.json();
        finishGenerating(data.generations ?? []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        finishGenerating([], msg);
      }
    },
    [ensureDirection, refinements, syncRefinements, startGenerating, finishGenerating]
  );

  // ── Refinement change (from DirectorPanel) ────────────────────────────────
  const handleRefinementChange = useCallback(
    async (key: string, value: unknown) => {
      patchRefinements({ [key]: value } as Parameters<typeof patchRefinements>[0]);
      // Fire-and-forget sync — don't block UI
      if (directionId && directionCreated) {
        void syncRefinements(directionId, { [key]: value });
      }
    },
    [patchRefinements, directionId, directionCreated, syncRefinements]
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        height:         "100%",
        width:          "100%",
        background:     "#070707",
        overflow:       "hidden",
        position:       "relative",
      }}
    >
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <CDv2TopBar onExitDirectorMode={onExitDirectorMode} />

      {/* ── 3-zone body ───────────────────────────────────────────────── */}
      <div
        style={{
          flex:     1,
          display:  "grid",
          gridTemplateColumns: "280px 1fr 320px",
          overflow: "hidden",
        }}
      >
        {/* Left panel */}
        <LeftPanel
          onAddElement={handleAddElement}
          onEnsureDirection={ensureDirection}
        />

        {/* Center — SceneCanvas + PromptDock */}
        <div
          style={{
            position:  "relative",
            display:   "flex",
            flexDirection: "column",
            overflow:  "hidden",
            borderLeft:  "1px solid rgba(255,255,255,0.04)",
            borderRight: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <SceneCanvas onAddElement={handleAddElement} />
          <PromptDock onGenerate={handleGenerate} />

          {/* DirectorPanel slides up from bottom of center zone */}
          <DirectorPanel onRefinementChange={handleRefinementChange} />
        </div>

        {/* Right — outputs */}
        <OutputPanel />
      </div>
    </div>
  );
}
