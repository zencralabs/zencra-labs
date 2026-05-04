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

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal }                              from "react-dom";
import { useAuth }                                   from "@/components/auth/AuthContext";
import { supabase }                                  from "@/lib/supabase";
import {
  useDirectionStore,
  buildCharacterDirectionSuffix,
  CD_MODELS,
  selectConnections,
  selectTextNodes,
}                                                    from "@/lib/creative-director/store";
import type {
  UploadedAsset,
  GenerationFrame,
  CanvasTextNode,
  NodeConnection,
}                                                    from "@/lib/creative-director/store";
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

// ─────────────────────────────────────────────────────────────────────────────
// Canvas autosave — module-level helpers (read from store outside React render)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versioned snapshot of the CDv2 canvas for DB persistence.
 * version field allows safe forward migration when the shape evolves.
 */
interface CDv2CanvasStateV1 {
  version:         1;
  frames:          GenerationFrame[];
  textNodes:       CanvasTextNode[];
  connections:     NodeConnection[];
  selectedModel:   string;
  sceneIntent:     { text: string; uploadedUrl: string | null };
  canvasTransform: { x: number; y: number; scale: number };
  savedAt:         string;
}

/** Build a serialisable snapshot from current Zustand state. */
function buildCDv2CanvasState(): CDv2CanvasStateV1 {
  const s = useDirectionStore.getState();
  return {
    version:         1,
    frames:          s.frames,
    textNodes:       s.textNodes,
    connections:     s.connections,
    selectedModel:   s.selectedModel,
    sceneIntent:     s.sceneIntent,
    canvasTransform: s.canvasTransform,
    savedAt:         new Date().toISOString(),
  };
}

/** JSON hash excluding `savedAt` so identical canvas state doesn't re-trigger saves. */
function getCDv2CanvasHash(cs: CDv2CanvasStateV1): string {
  const { savedAt: _savedAt, version: _v, ...rest } = cs;
  return JSON.stringify(rest);
}

/** localStorage key for the pre-direction canvas draft buffer. */
const CANVAS_BUFFER_KEY = "cdv2_canvas_buffer";

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

// Panel edge toggle button — always visible at panel boundaries regardless of
// collapse state. Lives in CDv2Shell (outside panels) so it's never clipped
// or hidden when a panel collapses or the window resizes.
function PanelToggleBtn({
  onClick,
  tooltip,
  pointing,
}: {
  onClick:  () => void;
  tooltip:  string;
  pointing: "left" | "right";
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={tooltip}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:          28,
        height:         28,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        border:         `1px solid ${hov ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
        borderRadius:   7,
        cursor:         "pointer",
        flexShrink:     0,
        transition:     "all 0.15s ease",
        padding:        0,
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        style={{ transform: pointing === "right" ? "rotate(180deg)" : "none" }}
      >
        <path
          d="M6.5 2L3.5 5L6.5 8"
          stroke={hov ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)"}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function CDv2Shell({ onExitDirectorMode }: CDv2ShellProps) {
  const {
    directionId,
    directionCreated,
    mode,
    elements,
    frames,
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
    updateFrame,
  } = useDirectionStore();

  const [isFullscreen,        setIsFullscreen]        = useState(false);
  const [leftCollapsed,       setLeftCollapsed]       = useState(false);
  const [rightCollapsed,      setRightCollapsed]      = useState(false);
  const [selectedFrameId,     setSelectedFrameId]     = useState<string | null>(null);
  const [dockMinimized,       setDockMinimized]       = useState(false);
  const [miniConsoleHovered,  setMiniConsoleHovered]  = useState(false);

  // ── Canvas autosave state + refs ─────────────────────────────────────────
  // saveStatus drives the top-bar badge: idle → unsaved → saving → saved | failed
  const [saveStatus,    setSaveStatus]   = useState<"idle" | "saving" | "saved" | "unsaved" | "failed">("idle");
  const autoSaveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveHash    = useRef("");
  const isSavingCanvas  = useRef(false);
  // justRestored: set true when we hydrate from storage so the flush-on-
  // direction-created effect doesn't immediately re-write unchanged state.
  const justRestored    = useRef(false);

  // P4 — Live prompt preview: read TextNodes + connections reactively.
  // These selectors re-render CDv2Shell only when these slices change.
  const liveTextNodes   = useDirectionStore(selectTextNodes);
  const liveConnections = useDirectionStore(selectConnections);

  /**
   * livePromptPreview — what will be sent to the model when Generate is clicked.
   * Shows: scene node labels → TextNode text → merged string.
   * Empty when there are no scene elements and no connected TextNodes.
   */
  const livePromptPreview = useMemo(() => {
    // Scene node labels (subject, world, atmosphere, object)
    const sceneLabels = elements
      .map((el) => el.label?.trim())
      .filter((l): l is string => !!l && l.length > 0)
      .join(", ");

    // TextNode text wired to the target frame
    const targetFrameId = selectedFrameId ?? frames[0]?.id ?? null;
    const textParts: string[] = [];
    if (targetFrameId) {
      liveConnections
        .filter((c) => c.type === "text" && c.toFrameId === targetFrameId)
        .forEach((c) => {
          if (c.type !== "text") return;
          const tn = liveTextNodes.find((t) => t.id === c.fromTextId);
          if (tn && tn.text.trim().length > 0) {
            textParts.push(tn.text.trim().replace(/[.]+$/, ""));
          }
        });
    }

    const parts = [sceneLabels, ...textParts].filter(Boolean);
    return parts.join(" + ");
  }, [elements, frames, selectedFrameId, liveTextNodes, liveConnections]);

  // Derive AR from selected frame (one-way: canvas selection → dock)
  const selectedFrameAr = selectedFrameId
    ? (frames.find((f) => f.id === selectedFrameId)?.aspectRatio ?? undefined)
    : undefined;

  const handleFrameSelect = useCallback((frameId: string | null) => {
    setSelectedFrameId(frameId);
  }, []);
  // Guard: createPortal needs document.body — only available on client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Force re-render on window resize ─────────────────────────────────────
  // Keeps the external panel toggle buttons anchored to the correct pixel
  // position when the user resizes or maximises the window.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    window.addEventListener("resize", forceUpdate);
    return () => window.removeEventListener("resize", forceUpdate);
  }, []);

  const creatingRef = useRef(false);
  // Synchronous guard — prevents concurrent generate calls even before React
  // state update propagates (isGenerating resets immediately for async providers
  // like NB Pro that return "processing", making the button re-clickable).
  const generateInProgressRef = useRef(false);

  // ── Auth ─────────────────────────────────────────────────────────────────
  // All CDv2 API routes require a Bearer token in the Authorization header.
  // We use supabase.auth.getSession() to get the freshest token (avoids
  // stale-closure issues where session from useAuth() may not yet be refreshed).
  const { session } = useAuth();
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    // Try live session first — covers auto-refresh scenarios
    const { data: { session: live } } = await supabase.auth.getSession();
    const token = live?.access_token ?? session?.access_token;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [session]);

  // ── Ensure direction row exists ───────────────────────────────────────────
  const ensureDirection = useCallback(async (): Promise<string | null> => {
    if (directionCreated && directionId) return directionId;
    if (creatingRef.current) return directionId;
    creatingRef.current = true;
    try {
      const authHdrs = await getAuthHeaders();
      const res = await fetch("/api/creative-director/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHdrs },
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
  }, [directionId, directionCreated, mode, sceneIntent.text, markDirectionCreated, getAuthHeaders]);

  // ── Add element — OPTIMISTIC ──────────────────────────────────────────────
  // 1. Add a temp element to the store immediately (instant canvas feedback).
  // 2. Ensure the direction row exists in DB.
  // 3. POST the real element to the API.
  // 4. On success: swap temp → real (remove + add, batched by React 18).
  // 5. On failure: keep the temp element alive so the canvas stays populated.
  //    The element will be re-synced on the next generate call.
  const handleAddElement = useCallback(
    async (type: DirectionElementType, label: string, assetUrl?: string) => {
      // Step 1 — optimistic: show on canvas immediately
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tempElement: DirectionElementRow = {
        id:           tempId,
        direction_id: "pending",
        type,
        label,
        asset_url:    assetUrl,   // ← attach blob URL so SceneNode can show thumbnail
        weight:       0.7,
        position:     elements.length,
        created_at:   new Date().toISOString(),
      };
      addElement(tempElement);

      // Step 2 — ensure direction row (may create one)
      const dId = await ensureDirection();
      if (!dId) {
        // Direction creation failed — keep the temp element alive so the canvas
        // stays populated. The user can still see and work with the node; it will
        // be re-synced when they hit Generate (which also calls ensureDirection).
        console.warn("[CDv2Shell] direction creation failed — element kept locally:", tempId);
        return;
      }

      // Step 3 — persist element to DB
      try {
        const authHdrs = await getAuthHeaders();
        const res = await fetch("/api/creative-director/elements", {
          method:  "POST",
          headers: { "Content-Type": "application/json", ...authHdrs },
          body: JSON.stringify({ direction_id: dId, type, label, weight: 0.7, position: elements.length, asset_url: assetUrl }),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const realElement: DirectionElementRow = data.element ?? data;
        // Preserve blob URL on the real element — the DB row may not store blob: URLs
        if (assetUrl && !realElement.asset_url) realElement.asset_url = assetUrl;
        // Step 4 — swap temp → real (batched, no visible flash)
        removeElement(tempId);
        addElement(realElement);
      } catch (err) {
        console.error("[CDv2Shell] addElement persist error (element kept in memory):", err);
        // Keep the temp element alive — direction_id may be wrong but generation
        // reads from DB so it's fine; the canvas stays populated for the session.
      }
    },
    [ensureDirection, elements.length, addElement, removeElement, getAuthHeaders]
  );

  // ── Sync refinements ──────────────────────────────────────────────────────
  const syncRefinements = useCallback(async (dId: string, patch: Record<string, unknown>) => {
    try {
      const authHdrs = await getAuthHeaders();
      await fetch("/api/creative-director/refinements", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHdrs },
        body: JSON.stringify({ direction_id: dId, ...patch }),
      });
    } catch { /* silent */ }
  }, [getAuthHeaders]);

  // ── Generate ──────────────────────────────────────────────────────────────
  // sceneOverride: direct text from PromptDock textarea, injected as
  // promptSuffix alongside any character direction suffix.
  // textNodeInput is resolved from connected TextNodes on the target frame.
  // frameIdOverride: used by handleFrameRegenerate to bypass selectedFrameId closure.
  const handleGenerate = useCallback(
    async (count: number = 1, aspectRatio: string = "1:1", _quality?: string, sceneOverride?: string, frameIdOverride?: string) => {
      console.log("[CDv2] handleGenerate called", { count, aspectRatio, sceneOverride, frameIdOverride });
      // ── Synchronous concurrency guard ────────────────────────────────────
      // isGenerating is React state — it resets to false immediately after
      // async providers (NB Pro) return "processing", making the button
      // re-clickable before the visual feedback arrives. This ref guard is
      // checked synchronously so rapid clicks or frame-regenerate calls
      // cannot fire concurrent API requests.
      if (generateInProgressRef.current) {
        console.log("[CDv2] handleGenerate blocked — generateInProgressRef is true");
        return;
      }
      generateInProgressRef.current = true;

      try {
        const dId = await ensureDirection();
        if (!dId) {
          // Surface the error so the user sees it — don't silently swallow it.
          finishGenerating([], "Could not start session — please refresh and try again.");
          return;
        }
        if (refinements && Object.keys(refinements).length > 0) {
          await syncRefinements(dId, refinements as Record<string, unknown>);
        }
        startGenerating();
        const charSuffix  = buildCharacterDirectionSuffix(characterDirection);
        // Combine sceneOverride (from PromptDock textarea) with character direction suffix.
        // If both exist, join with ", ". Route accepts the combined string as promptSuffix.
        const promptSuffix = [sceneOverride?.trim(), charSuffix].filter(Boolean).join(", ");

        // ── Resolve TextNode input + target frame ──────────────────────────
        // Target frame: explicit override > user-selected frame > first frame in store.
        // Hoisted out of the text-node block so we can use it for result wiring below.
        const { frames: currentFrames, connections, textNodes } = useDirectionStore.getState();
        const targetFrameId = currentFrames.length > 0
          ? (frameIdOverride ?? selectedFrameId ?? currentFrames[0].id)
          : null;

        let textNodeInput: string | undefined;
        if (targetFrameId) {
          const connectedTexts = connections
            .filter((c) => c.type === "text" && c.toFrameId === targetFrameId)
            .map((c) => c.type === "text" ? textNodes.find((t) => t.id === c.fromTextId) : null)
            .filter((t): t is NonNullable<typeof t> => !!t && t.text.trim().length > 0);
          if (connectedTexts.length > 0) {
            textNodeInput = connectedTexts
              .map((t) => t.text.trim().replace(/[.]+$/, ""))
              .filter(Boolean)
              .join(", ");
          }
        }

        try {
          const authHdrs = await getAuthHeaders();
          const res = await fetch("/api/creative-director/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHdrs },
            body: JSON.stringify({
              directionId:   dId,
              count,
              aspectRatio,
              modelOverride: selectedModel,
              promptSuffix:  promptSuffix || undefined,
              textNodeInput: textNodeInput || undefined,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            finishGenerating([], err.error ?? `Generation failed (${res.status})`);
            return;
          }
          const data: { generations: CDGenerationOutput[]; mode: string } = await res.json();
          finishGenerating(data.generations ?? []);

          // ── Wire result image to the target FrameNode ──────────────────
          // If a frame was targeted and the first completed generation has a URL,
          // update the frame's generatedImageUrl so the canvas shows the result.
          if (targetFrameId) {
            const firstDone = (data.generations ?? []).find(
              (g) => g.status === "completed" && g.url
            );
            if (firstDone?.url) {
              updateFrame(targetFrameId, { generatedImageUrl: firstDone.url });
            }
          }
        } catch (err) {
          finishGenerating([], err instanceof Error ? err.message : "Network error");
        }
      } finally {
        // Always release the guard so the user can generate again after
        // the current request fully resolves (success, error, or network failure).
        generateInProgressRef.current = false;
      }
    },
    [ensureDirection, refinements, syncRefinements, startGenerating, finishGenerating, selectedModel, characterDirection, selectedFrameId, updateFrame, getAuthHeaders]
  );

  // ── Frame Regenerate (Phase 4.2 — Director Flow) ───────────────────────────
  // Triggered by the hover Regenerate button on a filled FrameNode.
  // Reads frame AR directly from store state to avoid stale closure on selectedFrameId.
  const handleFrameRegenerate = useCallback((frameId: string) => {
    const { frames: storeFrames } = useDirectionStore.getState();
    const frame = storeFrames.find((f) => f.id === frameId);
    const ar = frame?.aspectRatio ?? "1:1";
    // Select this frame first so outputs are associated correctly
    setSelectedFrameId(frameId);
    // Pass frameId as override so handleGenerate doesn't use stale selectedFrameId
    void handleGenerate(1, ar, undefined, undefined, frameId);
  }, [handleGenerate]);

  // ── Frame Download (Phase 4.2) ─────────────────────────────────────────────
  const handleFrameDownload = useCallback((frameId: string) => {
    const { frames: storeFrames } = useDirectionStore.getState();
    const frame = storeFrames.find((f) => f.id === frameId);
    const url = frame?.generatedImageUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `frame-${frameId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ── Derived — Director Flow state ─────────────────────────────────────────
  // True when the currently selected frame already has a generated image.
  // Used by PromptDock to show "Update Scene" instead of "Generate".
  const selectedFrameIsFilled = selectedFrameId
    ? !!(frames.find((f) => f.id === selectedFrameId)?.generatedImageUrl)
    : false;

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
      const authHdrs = await getAuthHeaders();
      const res = await fetch("/api/creative-director/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHdrs },
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
    getAuthHeaders,
  ]);

  // ── Phase 3 — auto generate "WOW" moment ─────────────────────────────────
  // Called by SceneCanvas when onboardingStep reaches 4.
  // Reuses the same orchestration path as the manual Generate button:
  //   ensureDirection → startGenerating → POST /api/creative-director/generate
  //   → finishGenerating (pushes result to OutputPanel) → return imageUrl.
  // Returns null on any failure (onboarding continues gracefully).
  const handleAutoGenerate = useCallback(
    async (prompt: string, modelKey: string, aspectRatio: string, textNodeInput?: string): Promise<string | null> => {
      const dId = await ensureDirection();
      if (!dId) return null;
      startGenerating();
      try {
        const authHdrs = await getAuthHeaders();
        const res = await fetch("/api/creative-director/generate", {
          method:  "POST",
          headers: { "Content-Type": "application/json", ...authHdrs },
          body: JSON.stringify({
            directionId:   dId,
            count:         1,
            aspectRatio,
            modelOverride: modelKey,
            promptSuffix:  prompt,
            textNodeInput: textNodeInput || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          finishGenerating([], err.error ?? `Auto-generation failed (${res.status})`);
          return null;
        }
        const data: { generations: CDGenerationOutput[]; mode: string } = await res.json();
        finishGenerating(data.generations ?? []);
        return data.generations?.[0]?.url ?? null;
      } catch (err) {
        finishGenerating([], err instanceof Error ? err.message : "Network error");
        return null;
      }
    },
    [ensureDirection, startGenerating, finishGenerating, getAuthHeaders]
  );

  // ── Canvas autosave — write canvas state to DB ───────────────────────────
  const saveCanvasToDb = useCallback(async (id: string) => {
    if (isSavingCanvas.current) return;
    const snapshot = buildCDv2CanvasState();
    const hash     = getCDv2CanvasHash(snapshot);
    if (hash === lastSaveHash.current) { setSaveStatus("saved"); return; }
    isSavingCanvas.current = true;
    setSaveStatus("saving");
    try {
      const authHdrs = await getAuthHeaders();
      const res = await fetch(`/api/creative-director/directions/${id}/canvas`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...authHdrs },
        body:    JSON.stringify({ canvas_state: snapshot }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      lastSaveHash.current = hash;
      // Also cache to localStorage for sub-second re-open on next visit
      try {
        localStorage.setItem(CANVAS_BUFFER_KEY, JSON.stringify({ directionId: id, canvas_state: snapshot }));
      } catch { /* storage quota — ignore */ }
      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
    } finally {
      isSavingCanvas.current = false;
    }
  }, [getAuthHeaders]);

  // ── Debounced autosave — 1 500 ms after last canvas change ───────────────
  // Before a direction exists: writes to localStorage only (temp buffer).
  // After direction exists:    writes to localStorage + DB.
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaveStatus("unsaved");
    autoSaveTimer.current = setTimeout(() => {
      const { directionId: dId } = useDirectionStore.getState();
      const snapshot = buildCDv2CanvasState();
      try {
        localStorage.setItem(CANVAS_BUFFER_KEY, JSON.stringify({ directionId: dId, canvas_state: snapshot }));
      } catch { /* quota */ }
      if (dId) {
        void saveCanvasToDb(dId);
      } else {
        setSaveStatus("saved"); // buffered locally
      }
    }, 1500);
  }, [saveCanvasToDb]);

  // ── Manual "Save now" ─────────────────────────────────────────────────────
  const handleSaveNow = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const { directionId: dId } = useDirectionStore.getState();
    if (dId) {
      void saveCanvasToDb(dId);
    } else {
      const snapshot = buildCDv2CanvasState();
      try { localStorage.setItem(CANVAS_BUFFER_KEY, JSON.stringify({ directionId: null, canvas_state: snapshot })); } catch { /* quota */ }
      setSaveStatus("saved");
    }
  }, [saveCanvasToDb]);

  // ── Store subscription — trigger autosave on canvas-relevant changes ──────
  useEffect(() => {
    const unsub = useDirectionStore.subscribe((state, prev) => {
      if (
        state.frames          !== prev.frames          ||
        state.textNodes       !== prev.textNodes        ||
        state.connections     !== prev.connections      ||
        state.selectedModel   !== prev.selectedModel    ||
        state.sceneIntent     !== prev.sceneIntent      ||
        state.canvasTransform !== prev.canvasTransform
      ) {
        scheduleAutoSave();
      }
    });
    return () => {
      unsub();
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [scheduleAutoSave]);

  // ── Flush localStorage buffer to DB when direction is first created ───────
  // Fires when ensureDirection() writes the first DB row.
  // justRestored guard prevents re-writing state we just fetched from DB.
  useEffect(() => {
    if (!directionCreated || !directionId) return;
    if (justRestored.current) {
      justRestored.current = false; // clear flag, don't flush
      return;
    }
    void saveCanvasToDb(directionId);
  }, [directionCreated, directionId, saveCanvasToDb]);

  // ── Restore canvas state on mount ────────────────────────────────────────
  // Priority: DB (fresh) > localStorage draft > nothing
  useEffect(() => {
    async function restore() {
      try {
        const raw = localStorage.getItem(CANVAS_BUFFER_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          directionId:  string | null;
          canvas_state: CDv2CanvasStateV1 | null;
        };
        if (!parsed.canvas_state || parsed.canvas_state.version !== 1) return;
        const cs      = parsed.canvas_state;
        const savedId = parsed.directionId;

        // If we have a saved directionId, try to fetch the freshest state from DB
        if (savedId) {
          try {
            const authHdrs = await getAuthHeaders();
            const res = await fetch(`/api/creative-director/directions/${savedId}/canvas`, {
              headers: { ...authHdrs },
            });
            if (res.ok) {
              const data = await res.json() as { canvas_state: CDv2CanvasStateV1 | null };
              if (data.canvas_state?.version === 1) {
                applyCanvasState(data.canvas_state, savedId);
                return;
              }
            }
          } catch { /* fall through to localStorage draft */ }
        }

        // Hydrate from localStorage draft (no direction or DB unreachable)
        applyCanvasState(cs, savedId);
      } catch { /* corrupt localStorage — ignore */ }
    }

    function applyCanvasState(cs: CDv2CanvasStateV1, savedId: string | null) {
      const store = useDirectionStore.getState();
      if (cs.frames?.length)      store.setFrames(cs.frames);
      if (cs.textNodes?.length)   store.setTextNodes(cs.textNodes);
      if (cs.connections?.length) store.setConnections(cs.connections);
      // Only restore selectedModel if it's still an active model key.
      // Guards against stale model keys from old sessions (e.g. if a model
      // was removed from CD_MODELS or was set by an earlier browser test).
      const isValidModel = cs.selectedModel &&
        CD_MODELS.some((m) => m.key === cs.selectedModel && m.active !== false);
      if (isValidModel)            store.setSelectedModel(cs.selectedModel!);
      if (cs.sceneIntent?.text)   store.setSceneIntentText(cs.sceneIntent.text);
      if (cs.canvasTransform)     store.setCanvasTransform(cs.canvasTransform);
      if (savedId) {
        justRestored.current = true; // prevent flush-on-direction-created
        store.markDirectionCreated(savedId);
      }
      // Seed hash so initial comparison works correctly
      lastSaveHash.current = getCDv2CanvasHash(buildCDv2CanvasState());
      setSaveStatus("saved");
    }

    void restore();
  }, []); // mount only — intentional empty deps

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
        saveStatus={saveStatus}
        onSaveNow={handleSaveNow}
      />

      {/* ── 3-zone body ──────────────────────────────────────────────── */}
      <div
        style={{
          position:            "relative",   // anchor for external toggle buttons
          flex:                1,
          display:             "grid",
          gridTemplateColumns: `${leftW}px 1fr ${rightW}px`,
          overflow:            "hidden",
          transition:          "grid-template-columns 0.35s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* ── External panel toggle buttons — always visible at panel edges ── */}
        {/* Left toggle: straddles the left panel / canvas boundary */}
        <div
          style={{
            position:  "absolute",
            left:      leftW - 14,
            top:       "50%",
            transform: "translateY(-50%)",
            zIndex:    100,
            transition: "left 0.35s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <PanelToggleBtn
            onClick={() => setLeftCollapsed((c) => !c)}
            tooltip={leftCollapsed ? "Expand panel" : "Collapse panel"}
            pointing={leftCollapsed ? "right" : "left"}
          />
        </div>

        {/* Right toggle: straddles the canvas / right panel boundary */}
        <div
          style={{
            position:   "absolute",
            right:      rightW - 14,
            top:        "50%",
            transform:  "translateY(-50%)",
            zIndex:     100,
            transition: "right 0.35s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <PanelToggleBtn
            onClick={() => setRightCollapsed((c) => !c)}
            tooltip={rightCollapsed ? "Expand outputs" : "Collapse outputs"}
            pointing={rightCollapsed ? "left" : "right"}
          />
        </div>

        {/* Left assist panel */}
        <LeftPanel
          onAddElement={handleAddElement}
          onEnsureDirection={ensureDirection}
          isCollapsed={leftCollapsed}
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
          {/* Scene canvas — fills all remaining height (flex: 1) */}
          <SceneCanvas
            onAddElement={handleAddElement}
            onToggleDirectorControls={toggleDirectorPanel}
            directorPanelOpen={directorPanelOpen}
            onDropAsset={(assetId, role) => assignAssetToRole(assetId, role)}
            onAutoGenerate={handleAutoGenerate}
            onFrameSelect={handleFrameSelect}
            onFrameRegenerate={handleFrameRegenerate}
            onFrameDownload={handleFrameDownload}
          />

          {/* AI Assist bar — fades with dock so it never hangs in canvas alone */}
          <div
            style={{
              position:      "absolute",
              bottom:        DIRECTOR_BOTTOM + 8,
              left:          0,
              right:         0,
              zIndex:        30,
              opacity:       dockMinimized ? 0 : 1,
              pointerEvents: dockMinimized ? "none" : "auto",
              transition:    "opacity 0.32s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            {/* bottomOffset={0}: AIAssistBar positions itself relative to this wrapper */}
            <AIAssistBar onAddElement={handleAddElement} bottomOffset={0} />
          </div>

          {/* Director panel — slides up from bottom; NOT part of the dock stack */}
          <DirectorPanel
            onRefinementChange={handleRefinementChange}
            bottomOffset={DIRECTOR_BOTTOM}
          />

          {/* ── Bottom stack — DirectorHandle + PromptDock slide as one unit ── */}
          {/* translateY(calc(100%−28px)) leaves exactly 28px of the Open Console  */}
          {/* strip visible at the bottom edge. overflow:hidden on parent clips rest. */}
          <div
            style={{
              position:   "absolute",
              bottom:     0,
              left:       0,
              right:      0,
              zIndex:     10,
              transform:  dockMinimized
                ? "translateY(calc(100% - 28px))"
                : "translateY(0)",
              transition: "transform 0.32s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            {/* ── Open Console mini strip — top 28px visible when minimized ── */}
            <div
              onClick={() => setDockMinimized(false)}
              onMouseEnter={() => setMiniConsoleHovered(true)}
              onMouseLeave={() => setMiniConsoleHovered(false)}
              style={{
                height:               28,
                display:              "flex",
                alignItems:           "center",
                justifyContent:       "center",
                gap:                  6,
                cursor:               "pointer",
                background:           miniConsoleHovered
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(6,6,9,0.95)",
                borderTop:            `1px solid ${miniConsoleHovered
                  ? "rgba(139,92,246,0.28)"
                  : "rgba(255,255,255,0.07)"}`,
                boxShadow:            miniConsoleHovered
                  ? "0 0 20px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "inset 0 1px 0 rgba(255,255,255,0.03)",
                backdropFilter:       "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                transition:           "all 0.2s ease",
                // Invisible but in flow when expanded — keeps container height stable
                opacity:              dockMinimized ? 1 : 0,
                pointerEvents:        dockMinimized ? "auto" : "none",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.45 }}>
                <path d="M2 6.5L5 3.5L8 6.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{
                fontSize:      10,
                fontFamily:    "var(--font-sans)",
                color:         miniConsoleHovered ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                transition:    "color 0.2s ease",
              }}>
                Open Console
              </span>
            </div>

            {/* Director handle */}
            <DirectorHandle open={directorPanelOpen} onToggle={toggleDirectorPanel} />

            {/* P4 — Live prompt preview strip (read-only, must never intercept pointer events) */}
            {livePromptPreview && (
              <div
                style={{
                  padding:        "5px 14px",
                  background:     "rgba(10,9,18,0.72)",
                  borderTop:      "1px solid rgba(120,160,255,0.08)",
                  display:        "flex",
                  alignItems:     "center",
                  gap:            6,
                  overflow:       "hidden",
                  backdropFilter: "blur(8px)",
                  flexShrink:     0,
                  pointerEvents:  "none",
                }}
              >
                {/* Icon */}
                <span
                  style={{
                    fontFamily:    "var(--font-syne), sans-serif",
                    fontSize:       8,
                    fontWeight:     600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color:          "rgba(139,92,246,0.55)",
                    flexShrink:     0,
                  }}
                >
                  ✦ PROMPT
                </span>
                <span
                  style={{
                    fontFamily:    "var(--font-familjen-grotesk), sans-serif",
                    fontSize:       10,
                    fontWeight:     400,
                    color:          "rgba(174,183,208,0.65)",
                    whiteSpace:     "nowrap",
                    overflow:       "hidden",
                    textOverflow:   "ellipsis",
                    flex:           1,
                    lineHeight:     1.3,
                  }}
                  title={livePromptPreview}
                >
                  {livePromptPreview}
                </span>
              </div>
            )}

            {/* Prompt dock */}
            <PromptDock
              onGenerate={(count, ar, quality, sceneOverride) =>
                handleGenerate(count, ar, quality, sceneOverride)
              }
              isFullscreen={isFullscreen}
              defaultAr={selectedFrameAr}
              isMinimized={dockMinimized}
              onMinimizedChange={(m) => setDockMinimized(m)}
              selectedFrameIsFilled={selectedFrameIsFilled}
            />
          </div>
        </div>

        {/* Right output stream */}
        <OutputPanel
          isCollapsed={rightCollapsed}
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
