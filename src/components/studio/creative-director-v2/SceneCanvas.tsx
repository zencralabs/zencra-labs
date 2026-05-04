"use client";

/**
 * SceneCanvas — cinematic center canvas for Creative Director v2.
 *
 * Phase B.2.4 — Cinematic Canvas Interaction:
 *
 * Viewport transform:
 *   canvasTransform { x, y, scale } lives in Zustand store.
 *   A viewport div applies transform: translate(x,y) scale(s/100).
 *   Background layers (dot grid, vignettes) are OUTSIDE the viewport
 *   so they stay fixed — only nodes + connection lines move together.
 *
 * Pan:
 *   Drag empty background → clamp ±200px → setCanvasTransform.
 *   Pan is blocked when pointer down is on a node ([data-scene-node]).
 *   totalDelta < 5px on mouseup → treat as click (quick-add / menu close).
 *
 * Zoom:
 *   Three pill buttons: 85% / 100% / 115% (top-right corner).
 *   Ctrl/Meta + mouse wheel steps through the three levels.
 *   No continuous zoom — discrete steps only.
 *
 * Magnetic placement:
 *   Each role has a soft zone (fractions of canvas w/h).
 *   subject   → center-left  (33%, 48%)
 *   world     → upper-right  (70%, 22%)
 *   atmosphere → right-mid   (70%, 52%)
 *   object    → lower-right  (63%, 70%)
 *   Multiple nodes of the same type spread along the zone axis.
 *   Positions are initialized in a useEffect on element add and stored
 *   in local `positions` state so manual drags persist.
 *
 * Spring animation:
 *   Newly added element IDs are tracked in `springNodes` Set.
 *   The wrapping div receives animation: cd-spring 0.45s (keyframes in CDv2Shell).
 *   After 600ms the ID is removed and the animation stops.
 *
 * Connection lines (upgraded):
 *   All non-subject elements connect to the FIRST subject element.
 *   Line opacity = 0.15 + weight × 0.55  (range 0.15–0.70).
 *   Line stroke-width = 1.0 + weight × 1.5 (range 1.0–2.5).
 *   New connections fade in via cd-fade-in 0.5s.
 *
 * Scale-aware drag:
 *   SceneNode reports raw screen-pixel deltas.
 *   handleMove divides by (scale / 100) so node movement feels 1:1
 *   regardless of zoom level.
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  useDirectionStore,
  selectElements,
  selectCanvasTransform,
  selectFrames,
  selectConnections,
} from "@/lib/creative-director/store";
import type { FrameAspectRatio, GenerationFrame } from "@/lib/creative-director/store";
import { SceneNode, SCENE_NODE_CARD_WIDTH, SCENE_NODE_HANDLE_Y_OFFSET } from "./SceneNode";
import { FrameNode, FRAME_HEADER_HEIGHT, FRAME_RATIO_VALUES, DEFAULT_FRAME_WIDTH } from "./FrameNode";
import { CDOnboardingOverlay } from "./CDOnboardingOverlay";
import { CDAutoSceneHint }    from "./CDAutoSceneHint";
import type { DirectionElementType } from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface CanvasPosition { x: number; y: number; }

interface SceneCanvasProps {
  onAddElement:              (type: DirectionElementType, label: string, assetUrl?: string) => void;
  onToggleDirectorControls?: () => void;
  directorPanelOpen?:        boolean;
  onDropAsset?:              (assetId: string, role: DirectionElementType) => void;
  onAutoGenerate?:           (prompt: string, modelKey: string, aspectRatio: string) => Promise<string | null>;
  onFrameSelect?:            (frameId: string | null) => void;
}

// Pending asset drop awaiting role selection
interface PendingDrop {
  x:     number;
  y:     number;
  asset: { id: string; url: string; name: string };
}

const ROLES: Array<{ type: DirectionElementType; label: string; color: string }> = [
  { type: "subject",    label: "Subject",    color: "rgba(59,130,246,1)"  },
  { type: "world",      label: "World",      color: "rgba(34,197,94,1)"   },
  { type: "atmosphere", label: "Atmosphere", color: "rgba(139,92,246,1)"  },
  { type: "object",     label: "Object",     color: "rgba(249,115,22,1)"  },
];

const ZOOM_LEVELS = [85, 100, 115] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

// Magnetic zone definitions — (cx, cy) as fractions of canvas (w, h)
const MAGNETIC_ZONES: Record<DirectionElementType, { cx: number; cy: number }> = {
  subject:    { cx: 0.33, cy: 0.48 },
  world:      { cx: 0.70, cy: 0.22 },
  atmosphere: { cx: 0.70, cy: 0.52 },
  object:     { cx: 0.63, cy: 0.70 },
};

// ── Handle geometry helpers ────────────────────────────────────────────────────
// These use exported constants so we never hardcode or assume dimensions.

/** Canvas-space position of a SceneNode's output handle (right edge, top area). */
function getNodeOutputHandle(pos: CanvasPosition): CanvasPosition {
  return {
    x: pos.x + SCENE_NODE_CARD_WIDTH,
    y: pos.y + SCENE_NODE_HANDLE_Y_OFFSET,
  };
}

/**
 * Canvas-space position of a FrameNode's input handle (left edge, vertical center).
 * Used only for drop-detection in onMouseUp — the visual handle dot is rendered
 * inside FrameNode itself so it follows the frame during drag without store lag.
 */
function getFrameInputHandle(frame: GenerationFrame): CanvasPosition {
  const fw    = frame.width ?? DEFAULT_FRAME_WIDTH;
  const ratio = FRAME_RATIO_VALUES[frame.aspectRatio];
  const bodyH = fw / ratio;
  return {
    x: frame.position.x,
    y: frame.position.y + FRAME_HEADER_HEIGHT + bodyH / 2,
  };
}

function getMagneticPosition(
  type:          DirectionElementType,
  sameTypeIdx:   number,
  sameTypeCount: number,
  w:             number,
  h:             number,
): CanvasPosition {
  const zone   = MAGNETIC_ZONES[type];
  const cx     = w * zone.cx;
  const cy     = h * zone.cy;
  // Spread multiple same-type nodes: subjects stack vertically, others horizontally
  const spread = (sameTypeIdx - (sameTypeCount - 1) / 2) * 34;
  return {
    x: cx - 90 + (type === "subject" ? 0      : spread),
    y: cy - 30 + (type === "subject" ? spread : 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function SceneCanvas({ onAddElement, onToggleDirectorControls, directorPanelOpen, onDropAsset, onAutoGenerate, onFrameSelect }: SceneCanvasProps) {
  const elements        = useDirectionStore(selectElements);
  const canvasTransform = useDirectionStore(selectCanvasTransform);
  const setCanvasTransform = useDirectionStore((s) => s.setCanvasTransform);
  const resetCanvasView    = useDirectionStore((s) => s.resetCanvasView);

  const frames      = useDirectionStore(selectFrames);
  const addFrame    = useDirectionStore((s) => s.addFrame);
  const removeFrame = useDirectionStore((s) => s.removeFrame);
  const updateFrame = useDirectionStore((s) => s.updateFrame);

  const nodeConnections  = useDirectionStore(selectConnections);
  const addConnection    = useDirectionStore((s) => s.addConnection);
  const removeConnection = useDirectionStore((s) => s.removeConnection);

  const canvasRef       = useRef<HTMLDivElement>(null);
  const panStartRef     = useRef<{
    clientX: number; clientY: number;
    startX:  number; startY:  number;
  } | null>(null);
  const panHappenedRef  = useRef(false);
  const scaleRef        = useRef<number>(100);
  const prevElIdsRef    = useRef<Set<string>>(new Set());
  const prevFrameIdsRef = useRef<Set<string>>(new Set());

  // Track current scale in a ref so handleMove stays stable
  scaleRef.current = canvasTransform.scale;

  const [positions,       setPositions]      = useState<Record<string, CanvasPosition>>({});
  const [dragOver,        setDragOver]       = useState(false);
  const [isPanning,       setIsPanning]      = useState(false);
  const [quickAdd,        setQuickAdd]       = useState<{ x: number; y: number } | null>(null);
  const [contextMenu,     setContextMenu]    = useState<{ x: number; y: number } | null>(null);
  const [springNodes,     setSpringNodes]    = useState<Set<string>>(new Set());
  const [dropPicker,      setDropPicker]     = useState<PendingDrop | null>(null);
  const [selectedFrameId,   setSelectedFrameId]   = useState<string | null>(null);
  const [showResetConfirm,  setShowResetConfirm]  = useState(false);
  const [framePickerPos,    setFramePickerPos]    = useState<{ x: number; y: number } | null>(null);
  const [springFrames,    setSpringFrames]   = useState<Set<string>>(new Set());

  // ── Onboarding interactive state ──────────────────────────────────────────
  const [onboardingStep,           setOnboardingStep]           = useState(1);
  const [onboardingSuccessFrameId, setOnboardingSuccessFrameId] = useState<string | null>(null);

  // Phase 2 state — auto scene build
  const [onboardingAnimConnIds, setOnboardingAnimConnIds] = useState<Set<string>>(new Set());
  const [phase2FrameComplete,   setPhase2FrameComplete]   = useState(false);

  // Phase 3 state — auto generate WOW moment
  const selectedModel        = useDirectionStore((s) => s.selectedModel);
  const hasAutoGeneratedRef  = useRef(false);
  const [phase3Loading,         setPhase3Loading]         = useState<string | null>(null);  // frame.id while generating
  const [showSuccessPill,       setShowSuccessPill]       = useState(false);
  const [generatingPulseFrameId, setGeneratingPulseFrameId] = useState<string | null>(null); // one-shot pulse on fire

  // Stable refs — updated every render so handleMoveEnd reads current data
  // without needing elements/frames/positions in its useCallback deps.
  const elementsRef  = useRef(elements);
  const framesRef    = useRef(frames);
  const positionsRef = useRef<Record<string, CanvasPosition>>({});

  // Phase 2 refs — pre-registered before onAddElement is called so the
  // elements useEffect picks up directional positions instead of magnetic zones.
  const onAddElementRef       = useRef(onAddElement);
  const phase2PendingPositions = useRef<Map<string, CanvasPosition>>(new Map());  // type → pos
  const phase2SpawnIndexes     = useRef<Map<string, number>>(new Map());           // type → anim index

  // ── Onboarding — shown once when canvas is empty and flag is unset ────
  // Initialized lazily so sessionStorage is only read client-side.
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;  // SSR guard
    const hasContent = elements.length > 0 || frames.length > 0;
    if (hasContent) return false;
    try {
      return sessionStorage.getItem("cd_onboarding_seen") !== "1";
    } catch {
      return false; // private/restricted mode
    }
  });

  // ── Auto-spawn Subject + Frame on first visit ────────────────────────────
  // Capture showOnboarding at mount time (lazy state init is always correct here).
  const showOnboardingOnMount = useRef(showOnboarding);
  useEffect(() => {
    if (!showOnboardingOnMount.current) return;
    onAddElement("subject", "Subject");
    addFrame({
      id:          `onb-frm-${Date.now()}`,
      aspectRatio: "16:9",
      position:    { x: 320, y: 55 },
      width:       240,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional: one-time spawn at mount only

  // ── Phase C.1 — pending connection drag + hover-delete ───────────────────
  const [pendingConn, setPendingConn] = useState<{
    fromNodeId: string;
    cursorPos:  CanvasPosition;
  } | null>(null);
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null);

  // Ref so the global mouse handlers (stable closure) can access latest state
  const pendingConnRef = useRef<typeof pendingConn>(null);

  // Sync ref every render so handlers always see the latest pendingConn
  pendingConnRef.current = pendingConn;
  // Sync stable refs for handleMoveEnd (accessed in callback but not in its deps)
  elementsRef.current    = elements;
  framesRef.current      = frames;
  positionsRef.current   = positions;
  onAddElementRef.current = onAddElement;

  // ── Detect newly added elements → initialize positions + spring ───────────
  useEffect(() => {
    const currentIds = new Set(elements.map((e) => e.id));
    const newEls     = elements.filter((e) => !prevElIdsRef.current.has(e.id));

    if (newEls.length > 0) {
      const rect = canvasRef.current?.getBoundingClientRect();
      const w    = rect?.width  ?? 600;
      const h    = rect?.height ?? 400;

      setPositions((prev) => {
        const next = { ...prev };
        newEls.forEach((el) => {
          if (next[el.id]) return; // already manually positioned
          // Phase 2: use pre-registered directional position instead of magnetic zone
          const p2pos = phase2PendingPositions.current.get(el.type);
          if (p2pos) {
            next[el.id] = p2pos;
            phase2PendingPositions.current.delete(el.type); // claim: one node per type
            return;
          }
          const sameType    = elements.filter((e) => e.type === el.type);
          const sameTypeIdx = sameType.findIndex((e) => e.id === el.id);
          next[el.id] = getMagneticPosition(el.type, sameTypeIdx, sameType.length, w, h);
        });
        return next;
      });

      // Mark for spring animation; clear after 600ms
      setSpringNodes((prev) => new Set([...prev, ...newEls.map((e) => e.id)]));
      newEls.forEach(({ id }) => {
        setTimeout(() => {
          setSpringNodes((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 600);
      });
    }

    // Clean up removed element positions
    const removedIds = [...prevElIdsRef.current].filter((id) => !currentIds.has(id));
    if (removedIds.length > 0) {
      setPositions((prev) => {
        const next = { ...prev };
        removedIds.forEach((id) => delete next[id]);
        return next;
      });
    }

    prevElIdsRef.current = currentIds;
  }, [elements]);

  // ── Detect newly added frames → spring animation ─────────────────────────
  useEffect(() => {
    const currentIds = new Set(frames.map((f) => f.id));
    const newFrames  = frames.filter((f) => !prevFrameIdsRef.current.has(f.id));
    if (newFrames.length > 0) {
      setSpringFrames((prev) => new Set([...prev, ...newFrames.map((f) => f.id)]));
      newFrames.forEach(({ id }) => {
        setTimeout(() => {
          setSpringFrames((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 600);
      });
    }
    prevFrameIdsRef.current = currentIds;
  }, [frames]);

  // ── Get position: prefer local state, else magnetic zone ─────────────────
  const getPosition = useCallback(
    (id: string, idx: number): CanvasPosition => {
      if (positions[id]) return positions[id];
      const rect = canvasRef.current?.getBoundingClientRect();
      const el   = elements[idx];
      if (!el) return { x: 90, y: 30 };
      const w         = rect?.width  ?? 600;
      const h         = rect?.height ?? 400;
      const sameType  = elements.filter((e) => e.type === el.type);
      const stIdx     = sameType.findIndex((e) => e.id === id);
      return getMagneticPosition(el.type, stIdx, sameType.length, w, h);
    },
    [positions, elements],
  );

  // ── Scale-aware drag ──────────────────────────────────────────────────────
  const handleMove = useCallback((id: string, dx: number, dy: number) => {
    const s = scaleRef.current / 100;
    setPositions((prev) => {
      const cur = prev[id] ?? { x: 0, y: 0 };
      return { ...prev, [id]: { x: cur.x + dx / s, y: cur.y + dy / s } };
    });
  }, []);

  // ── Onboarding: detect subject-into-frame drop ────────────────────────────
  // Reads elements/frames/positions via refs so they're never in the deps array
  // (positions changes on every drag delta — including them would cause all nodes
  //  to re-render during drag as the callback constantly recreates).
  const handleMoveEnd = useCallback((id: string) => {
    if (!showOnboarding || onboardingStep !== 1) return;
    const el  = elementsRef.current.find((e) => e.id === id);
    if (!el || el.type !== "subject") return;
    const pos = positionsRef.current[id];
    if (!pos) return;
    // Use the center of the node card as the drop point
    const nodeCX = pos.x + SCENE_NODE_CARD_WIDTH / 2;
    const nodeCY = pos.y + 40;   // approx vertical center of top row area
    for (const frame of framesRef.current) {
      const fw     = frame.width ?? DEFAULT_FRAME_WIDTH;
      const ratio  = FRAME_RATIO_VALUES[frame.aspectRatio];
      const bodyH  = fw / ratio;
      const totalH = FRAME_HEADER_HEIGHT + bodyH;
      if (
        nodeCX >= frame.position.x &&
        nodeCX <= frame.position.x + fw &&
        nodeCY >= frame.position.y &&
        nodeCY <= frame.position.y + totalH
      ) {
        try { sessionStorage.setItem("cd_onboarding_seen", "1"); } catch { /* silent */ }
        setOnboardingStep(2);
        setOnboardingSuccessFrameId(frame.id);
        return;
      }
    }
  }, [showOnboarding, onboardingStep]);

  // ── Phase 2: auto scene build — spawn missing nodes, then wire connections ──
  //
  // Step 2 → 3: after Phase 1 animation settles (~200ms), determine which of
  //   world / atmosphere / object are absent.  Pre-register their directional
  //   positions so the elements-useEffect uses them instead of magnetic zones.
  //   Spawn each missing node with a 120ms stagger; advance to step 3 when done.
  //
  // Step 3 → 4: connect every element → first frame (skip existing pairs),
  //   mark those connection IDs for the draw-in animation, fire frame Phase 2
  //   reaction after ~600ms, then advance to step 4 after ~1100ms total.

  useEffect(() => {
    if (onboardingStep !== 2) return;

    const timer = setTimeout(() => {
      const frame = framesRef.current[0];
      if (!frame) { setOnboardingStep(3); return; }

      const fw    = frame.width ?? DEFAULT_FRAME_WIDTH;
      const ratio = FRAME_RATIO_VALUES[frame.aspectRatio];
      const bodyH = fw / ratio;
      const fx    = frame.position.x;
      const fy    = frame.position.y;
      const fh    = FRAME_HEADER_HEIGHT + bodyH;

      // Directional positions relative to frame (locked per spec)
      const PHASE2_POS: Partial<Record<string, CanvasPosition>> = {
        world:      { x: fx - 140,      y: fy + fh + 60 },
        atmosphere: { x: fx + fw + 120, y: fy - 40 },
        object:     { x: fx + fw + 120, y: fy + fh + 40 },
      };
      const PHASE2_LABELS: Record<string, string> = {
        world: "Environment", atmosphere: "Lighting", object: "Details",
      };

      const existingTypes = new Set(elementsRef.current.map((e) => e.type));
      const missing = (["world", "atmosphere", "object"] as DirectionElementType[]).filter(
        (t) => !existingTypes.has(t),
      );

      if (missing.length === 0) {
        // All nodes already exist — skip directly to connection phase
        setOnboardingStep(3);
        return;
      }

      // Pre-register positions + spawn indexes so elements useEffect uses them
      missing.forEach((type, i) => {
        const pos = PHASE2_POS[type];
        if (pos) phase2PendingPositions.current.set(type, pos);
        phase2SpawnIndexes.current.set(type, i);
      });

      // Stagger spawn: 0ms, 120ms, 240ms
      missing.forEach((type, i) => {
        setTimeout(() => {
          onAddElementRef.current(type, PHASE2_LABELS[type]);
        }, i * 120);
      });

      // Advance to step 3 once all spawns are in flight + one frame settle
      setTimeout(() => setOnboardingStep(3), missing.length * 120 + 80);
    }, 200); // let Phase 1 scale animation finish

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingStep]); // intentional: no onAddElement in deps (uses ref)

  useEffect(() => {
    if (onboardingStep !== 3) return;

    // Short pause to let newly spawned nodes settle into the DOM
    const timer = setTimeout(() => {
      const frame = framesRef.current[0];
      if (!frame) { setOnboardingStep(4); return; }

      const existingConns = useDirectionStore.getState().connections;
      const newConnIds: string[]= [];

      elementsRef.current.forEach((node) => {
        const alreadyConnected = existingConns.some(
          (c) => c.fromNodeId === node.id && c.toFrameId === frame.id,
        );
        if (alreadyConnected) return;
        const connId = `onb-conn-${node.type}-${Date.now()}-${node.id.slice(-4)}`;
        addConnection({ id: connId, fromNodeId: node.id, toFrameId: frame.id });
        newConnIds.push(connId);
      });

      if (newConnIds.length > 0) {
        setOnboardingAnimConnIds(new Set(newConnIds));
      }

      // Frame Phase 2 glow reaction after draw-in completes (~600ms)
      setTimeout(() => setPhase2FrameComplete(true), 600);

      // Advance to step 4 and clear animation IDs (~1100ms)
      setTimeout(() => {
        setOnboardingAnimConnIds(new Set());
        setOnboardingStep(4);
      }, 1100);
    }, 180);

    return () => clearTimeout(timer);
  }, [onboardingStep, addConnection]);

  // ── Phase 3: auto generate WOW moment (fires once at step 4) ─────────────
  useEffect(() => {
    if (onboardingStep !== 4) return;
    if (hasAutoGeneratedRef.current) return;
    if (!onAutoGenerate) return;

    hasAutoGeneratedRef.current = true;

    const timer = setTimeout(async () => {
      // Determine target frame: prefer the onboarding success frame, then first
      const frame =
        framesRef.current.find((f) => f.id === onboardingSuccessFrameId) ??
        framesRef.current[0];
      if (!frame) { setOnboardingStep(6); return; }

      // Build prompt from current elements (filter blanks)
      const promptParts = elementsRef.current
        .map((el) => el.label?.trim())
        .filter(Boolean);
      const promptSuffix = promptParts.join(", ");

      // Resolve model + aspect ratio
      const modelKey    = selectedModel ?? "gpt-image-2";
      const aspectRatio = frame.aspectRatio ?? "16:9";

      // Advance to step 5 (showing shimmer in frame)
      setOnboardingStep(5);
      setPhase3Loading(frame.id);
      // One-shot connection pulse toward frame — reinforces causality
      setGeneratingPulseFrameId(frame.id);
      setTimeout(() => setGeneratingPulseFrameId(null), 700);

      try {
        const url = await onAutoGenerate(promptSuffix, modelKey, aspectRatio);
        if (url) {
          useDirectionStore.getState().updateFrame(frame.id, { generatedImageUrl: url });
          setShowSuccessPill(true);
          setTimeout(() => setShowSuccessPill(false), 2200);
        }
      } catch {
        // silent fail — onboarding continues regardless
      } finally {
        setPhase3Loading(null);
        setOnboardingStep(6);
      }
    }, 400);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingStep]); // intentional: selectedModel + onAutoGenerate read via closure

  // ── Pan + pending-connection — global mouse handlers (registered once) ───
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // ── Pending connection drag ──────────────────────────────────────────
      if (pendingConnRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const ct = useDirectionStore.getState().canvasTransform;
          const s  = ct.scale / 100;
          setPendingConn({
            fromNodeId: pendingConnRef.current.fromNodeId,
            cursorPos: {
              x: (e.clientX - rect.left - ct.x) / s,
              y: (e.clientY - rect.top  - ct.y) / s,
            },
          });
        }
        return; // don't pan while dragging a connection
      }
      // ── Pan ──────────────────────────────────────────────────────────────
      if (!panStartRef.current) return;
      const dx   = e.clientX - panStartRef.current.clientX;
      const dy   = e.clientY - panStartRef.current.clientY;
      const newX = Math.max(-200, Math.min(200, panStartRef.current.startX + dx));
      const newY = Math.max(-200, Math.min(200, panStartRef.current.startY + dy));
      useDirectionStore.getState().setCanvasTransform({ x: newX, y: newY });
    };

    const onMouseUp = (e: MouseEvent) => {
      // ── Pending connection drop ──────────────────────────────────────────
      if (pendingConnRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const ct    = useDirectionStore.getState().canvasTransform;
          const s     = ct.scale / 100;
          const curX  = (e.clientX - rect.left - ct.x) / s;
          const curY  = (e.clientY - rect.top  - ct.y) / s;
          const { frames: currentFrames } = useDirectionStore.getState();
          for (const frame of currentFrames) {
            const hp   = getFrameInputHandle(frame);
            const dist = Math.sqrt((curX - hp.x) ** 2 + (curY - hp.y) ** 2);
            if (dist < 28) {
              useDirectionStore.getState().addConnection({
                id:         `conn-${Date.now()}`,
                fromNodeId: pendingConnRef.current.fromNodeId,
                toFrameId:  frame.id,
              });
              break;
            }
          }
        }
        setPendingConn(null);
        return;
      }
      // ── Pan end ───────────────────────────────────────────────────────────
      if (!panStartRef.current) return;
      const dx    = e.clientX - panStartRef.current.clientX;
      const dy    = e.clientY - panStartRef.current.clientY;
      const delta = Math.sqrt(dx * dx + dy * dy);
      panHappenedRef.current = delta >= 5;
      panStartRef.current    = null;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, []); // stable — uses refs + getState()

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-scene-node]")) return;
    const { canvasTransform: ct } = useDirectionStore.getState();
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX:  ct.x,
      startY:  ct.y,
    };
    setIsPanning(true);
  }, []);

  // ── Start a node-to-frame connection drag ────────────────────────────────
  const handleOutputHandleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = canvasRef.current!.getBoundingClientRect();
      const ct   = useDirectionStore.getState().canvasTransform;
      const s    = ct.scale / 100;
      setPendingConn({
        fromNodeId: nodeId,
        cursorPos: {
          x: (e.clientX - rect.left - ct.x) / s,
          y: (e.clientY - rect.top  - ct.y) / s,
        },
      });
    },
    [],
  );

  // ── Add Frame — create a new generation frame at canvas center ───────────
  const handleAddFrame = useCallback((aspectRatio: FrameAspectRatio) => {
    const rect   = canvasRef.current?.getBoundingClientRect();
    const w      = rect?.width  ?? 600;
    const h      = rect?.height ?? 400;
    const s      = canvasTransform.scale / 100;
    const offset = frames.length * 24;
    const cx     = (w / 2 - canvasTransform.x) / s - 110 + offset;
    const cy     = (h / 2 - canvasTransform.y) / s - 80  + offset;
    addFrame({ id: `frame-${Date.now()}`, aspectRatio, position: { x: cx, y: cy } });
    setFramePickerPos(null);
    setContextMenu(null);
    setQuickAdd(null);
  }, [addFrame, canvasTransform, frames.length]);

  // ── Compute safe picker position using real canvas dimensions ─────────────
  // Estimated picker dimensions for the vertical FrameAspectRatioPicker layout.
  // These are used only for clamping; slight over-estimate is fine.
  const PICKER_W = 190;
  const PICKER_H = 210;

  const computePickerPos = useCallback((triggerX: number, triggerY: number): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cw   = rect?.width  ?? 600;
    const ch   = rect?.height ?? 400;
    return {
      x: Math.max(8, Math.min(triggerX, cw - PICKER_W - 8)),
      y: Math.max(8, Math.min(triggerY, ch - PICKER_H - 8)),
    };
  }, []);

  // ── Click: close menus only — no QuickAdd on single click ───────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (panHappenedRef.current) { panHappenedRef.current = false; return; }
    if ((e.target as HTMLElement).closest("[data-scene-node]")) return;
    // Close any open menus — nothing else on single left click
    if (framePickerPos) { setFramePickerPos(null); return; }
    if (dropPicker)     { setDropPicker(null);     return; }
    if (contextMenu)    { setContextMenu(null);    return; }
    if (quickAdd)       { setQuickAdd(null);       return; }
    setSelectedFrameId(null);
  }, [framePickerPos, dropPicker, contextMenu, quickAdd]);

  // ── Double-click: open QuickAddPicker ────────────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-scene-node]")) return;
    if (contextMenu) { setContextMenu(null); }
    const rect = canvasRef.current!.getBoundingClientRect();
    setQuickAdd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [contextMenu]);

  // ── Right-click context menu ──────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest("[data-scene-node]")) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setQuickAdd(null);
  }, []);

  // ── Ctrl/Meta + wheel zoom ────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const dir     = e.deltaY > 0 ? -1 : 1;
    const current = useDirectionStore.getState().canvasTransform.scale as ZoomLevel;
    const idx     = ZOOM_LEVELS.indexOf(current);
    const newIdx  = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + dir));
    useDirectionStore.getState().setCanvasTransform({ scale: ZOOM_LEVELS[newIdx] });
  }, []);

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setContextMenu(null); setQuickAdd(null); setDropPicker(null); setFramePickerPos(null); setPendingConn(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // CSS transform for the viewport
  const viewportTransform = `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale / 100})`;

  return (
    <div
      ref={canvasRef}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);

        // ── Asset tray drop (priority) — show role picker at drop point ──
        const assetJson = e.dataTransfer.getData("application/cd-asset");
        if (assetJson) {
          try {
            const asset = JSON.parse(assetJson) as { id: string; url: string; name: string };
            const rect  = canvasRef.current!.getBoundingClientRect();
            setDropPicker({
              x:     e.clientX - rect.left,
              y:     e.clientY - rect.top,
              asset,
            });
          } catch { /* malformed — ignore */ }
          return;
        }

        // ── Plain text drop ──────────────────────────────────────────────
        const text = e.dataTransfer.getData("text/plain").trim();
        if (text) onAddElement("subject", text);
      }}
      style={{
        flex:       1,
        position:   "relative",
        overflow:   "hidden",
        cursor:     isPanning ? "grabbing" : "crosshair",
        // Cinematic background — base #0b0f1a + centered purple/blue radial glow
        // Slightly brighter than before for daylight-screen readability while
        // preserving the deep premium feel.
        background: dragOver
          ? "rgba(139,92,246,0.06)"
          : [
            "radial-gradient(circle at 50% 40%, rgba(120,80,255,0.18), transparent 60%)",
            "radial-gradient(ellipse at 45% 35%, rgba(28,20,52,1) 0%, rgba(17,13,34,1) 42%, rgba(11,9,20,1) 75%)",
          ].join(", "),
        transition:  "background 0.4s ease",
        userSelect:  "none",
      }}
    >
      {/* ── Static background layers (outside transform) ──────────────── */}
      {/* Dot grid */}
      <div aria-hidden style={{
        position:        "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.082) 1px, transparent 1px)",
        backgroundSize:  "32px 32px",
      }} />

      {/* Ambient corner glows */}
      <div aria-hidden style={{
        position:   "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 0% 100%, rgba(139,92,246,0.06) 0%, transparent 50%), radial-gradient(ellipse at 100% 0%, rgba(59,130,246,0.05) 0%, transparent 50%)",
      }} />

      {/* Bottom vignette */}
      <div aria-hidden style={{
        position:   "absolute", bottom: 0, left: 0, right: 0, height: 120, pointerEvents: "none",
        background: "linear-gradient(to top, rgba(6,5,10,0.8) 0%, transparent 100%)",
      }} />

      {/* ── Viewport (transformed) — nodes + connection lines move together ── */}
      <div
        aria-hidden={false}
        style={{
          position:        "absolute",
          inset:           0,
          transform:       viewportTransform,
          transformOrigin: "center",
          transition:      isPanning
            ? "none"
            : "transform 0.28s cubic-bezier(0.16,1,0.3,1)",
          willChange:      "transform",
        }}
      >
        {/* ── SVG: element→element connections + node→frame connections + pending ─ */}
        <svg
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            pointerEvents: "none", zIndex: 7,
            overflow: "visible",
          }}
        >
          <defs>
            <linearGradient id="conn-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(59,130,246,0.5)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0.5)" />
            </linearGradient>
            {/* Phase 2 onboarding connection animations */}
            <style>{`
              @keyframes cd-ob-conn-draw {
                from { stroke-dasharray: 600; stroke-dashoffset: 600; opacity: 0; }
                to   { stroke-dasharray: 600; stroke-dashoffset: 0;   opacity: 1; }
              }
              @keyframes cd-gen-conn-pulse {
                0%   { stroke-dasharray: 0 600;  stroke-dashoffset: 0;    opacity: 0; }
                10%  { stroke-dasharray: 30 600; stroke-dashoffset: -10;  opacity: 1; }
                85%  { stroke-dasharray: 30 600; stroke-dashoffset: -560; opacity: 0.8; }
                100% { stroke-dasharray: 0 600;  stroke-dashoffset: -600; opacity: 0; }
              }
              @keyframes cd-ob-conn-pulse {
                0%   { stroke-dasharray: 0 600;  stroke-dashoffset: 0;    opacity: 0; }
                15%  { stroke-dasharray: 24 600; stroke-dashoffset: -20;  opacity: 1; }
                85%  { stroke-dasharray: 24 600; stroke-dashoffset: -540; opacity: 1; }
                100% { stroke-dasharray: 0 600;  stroke-dashoffset: -600; opacity: 0; }
              }
            `}</style>
          </defs>

          {/* ── Layer 1: node → frame committed connections ───────────────── */}
          {nodeConnections.map((conn) => {
            const nodeIdx = elements.findIndex((e) => e.id === conn.fromNodeId);
            const frame   = frames.find((f) => f.id === conn.toFrameId);
            if (nodeIdx < 0 || !frame) return null;
            const nodePos   = getPosition(conn.fromNodeId, nodeIdx);
            const from      = getNodeOutputHandle(nodePos);
            const to        = getFrameInputHandle(frame);
            const offset    = Math.abs(to.x - from.x) * 0.45 + 30;
            const d         = `M ${from.x} ${from.y} C ${from.x + offset} ${from.y}, ${to.x - offset} ${to.y}, ${to.x} ${to.y}`;
            const isHovered   = hoveredConnId === conn.id;
            const isObConn    = onboardingAnimConnIds.has(conn.id);
            const isGenPulse  = !!generatingPulseFrameId && conn.toFrameId === generatingPulseFrameId;
            // Midpoint for hover × delete
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            return (
              <g
                key={conn.id}
                style={{ animation: isObConn ? "none" : "cd-fade-in 0.35s ease" }}
                onMouseEnter={() => setHoveredConnId(conn.id)}
                onMouseLeave={() => setHoveredConnId(null)}
              >
                {/* Wider invisible hit area */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                />
                {/* Glow — draw-in animation for Phase 2 onboarding connections */}
                <path
                  d={d}
                  fill="none"
                  stroke={isHovered ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)"}
                  strokeWidth={4}
                  strokeLinecap="round"
                  style={isObConn
                    ? { animation: "cd-ob-conn-draw 0.55s cubic-bezier(0.16,1,0.3,1) both", transition: "stroke 0.15s ease" }
                    : { transition: "stroke 0.15s ease" }}
                />
                {/* Main white line — draw-in animation for Phase 2 onboarding connections */}
                <path
                  d={d}
                  fill="none"
                  stroke={isHovered ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)"}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  style={isObConn
                    ? { animation: "cd-ob-conn-draw 0.55s cubic-bezier(0.16,1,0.3,1) both", transition: "stroke 0.15s ease" }
                    : { transition: "stroke 0.15s ease" }}
                />
                {/* Phase 2 pulse dot — traveling dot along bezier path */}
                {isObConn && (
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    style={{
                      animation:       "cd-ob-conn-pulse 1.1s cubic-bezier(0.4,0,0.6,1) 0.55s both",
                      pointerEvents:   "none",
                    }}
                  />
                )}
                {/* Phase 3 gen pulse — purple one-shot dot toward the generating frame */}
                {isGenPulse && (
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(139,92,246,0.9)"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    style={{
                      animation:     "cd-gen-conn-pulse 0.6s ease-out both",
                      pointerEvents: "none",
                    }}
                  />
                )}
                {/* Hover × delete midpoint — foreignObject so we can use a real button */}
                {isHovered && (
                  <foreignObject
                    x={mx - 9}
                    y={my - 9}
                    width={18}
                    height={18}
                    style={{ pointerEvents: "all", overflow: "visible" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeConnection(conn.id);
                        setHoveredConnId(null);
                      }}
                      style={{
                        width:        18,
                        height:       18,
                        borderRadius: "50%",
                        background:   "rgba(20,16,32,0.95)",
                        border:       "1px solid rgba(255,255,255,0.3)",
                        color:        "rgba(255,255,255,0.85)",
                        fontSize:     9,
                        cursor:       "pointer",
                        display:      "flex",
                        alignItems:   "center",
                        justifyContent: "center",
                        lineHeight:   1,
                        padding:      0,
                        fontFamily:   "sans-serif",
                      }}
                      title="Remove connection"
                    >
                      ×
                    </button>
                  </foreignObject>
                )}
              </g>
            );
          })}

          {/* ── Layer 3: pending connection drag line ─────────────────────── */}
          {pendingConn && (() => {
            const nodeIdx = elements.findIndex((e) => e.id === pendingConn.fromNodeId);
            if (nodeIdx < 0) return null;
            const nodePos = getPosition(pendingConn.fromNodeId, nodeIdx);
            const from    = getNodeOutputHandle(nodePos);
            const to      = pendingConn.cursorPos;
            const offset  = Math.abs(to.x - from.x) * 0.45 + 30;
            const d       = `M ${from.x} ${from.y} C ${from.x + offset} ${from.y}, ${to.x - offset} ${to.y}, ${to.x} ${to.y}`;
            return (
              <g>
                <path d={d} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4} strokeLinecap="round" />
                <path d={d} fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="6 5" />
              </g>
            );
          })()}
        </svg>

        {/* Scene nodes + output handles */}
        {elements.map((el, idx) => {
          const pos = getPosition(el.id, idx);
          const hx  = pos.x + SCENE_NODE_CARD_WIDTH;
          const hy  = pos.y + SCENE_NODE_HANDLE_Y_OFFSET;
          return (
            <div
              key={el.id}
              data-scene-node="true"
              style={{
                position:  "absolute",
                top:       0,
                left:      0,
                animation: springNodes.has(el.id)
                  ? "cd-spring 0.45s cubic-bezier(0.34,1.56,0.64,1) both"
                  : "none",
              }}
            >
              <SceneNode
                element={el}
                x={pos.x}
                y={pos.y}
                onMove={handleMove}
                onMoveEnd={handleMoveEnd}
                onboardingHighlight={showOnboarding && onboardingStep === 1 && el.type === "subject"}
                autoSpawnIndex={phase2SpawnIndexes.current.get(el.type)}
              />
              {/* Interactive output handle — right edge of card, rendered from SceneCanvas
                  so position is computed from exported constants (not DOM refs). */}
              <div
                onMouseDown={(e) => handleOutputHandleMouseDown(e, el.id)}
                title="Drag to connect to a frame"
                style={{
                  position:        "absolute",
                  left:            hx - 6,
                  top:             hy - 6,
                  width:           12,
                  height:          12,
                  borderRadius:    "50%",
                  background:      pendingConn?.fromNodeId === el.id
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.35)",
                  border:          "1.5px solid rgba(255,255,255,0.6)",
                  cursor:          "crosshair",
                  zIndex:          25,
                  transition:      "background 0.15s ease, transform 0.15s ease",
                  boxShadow:       "0 0 6px rgba(255,255,255,0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background  = "rgba(255,255,255,0.95)";
                  e.currentTarget.style.transform   = "scale(1.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background  =
                    pendingConn?.fromNodeId === el.id
                      ? "rgba(255,255,255,0.95)"
                      : "rgba(255,255,255,0.35)";
                  e.currentTarget.style.transform   = "scale(1)";
                }}
              />
            </div>
          );
        })}

        {/* Generation Frame nodes — input handle is rendered inside FrameNode
            so it stays attached during header-drag (which bypasses the store). */}
        {frames.map((frame) => (
          <FrameNode
            key={frame.id}
            frame={frame}
            isSelected={selectedFrameId === frame.id}
            scale={canvasTransform.scale}
            isSpring={springFrames.has(frame.id)}
            pendingConnActive={!!pendingConn}
            onboardingSuccess={onboardingSuccessFrameId === frame.id}
            onboardingPhase2Complete={phase2FrameComplete && onboardingSuccessFrameId === frame.id}
            isGenerating={phase3Loading === frame.id}
            onSelect={(id) => { setSelectedFrameId(id); onFrameSelect?.(id); }}
            onDelete={removeFrame}
            onDragEnd={(id, pos) => updateFrame(id, { position: pos })}
            onResize={(id, width, pos) => {
              const patch: Parameters<typeof updateFrame>[1] = { width };
              if (pos) patch.position = pos;
              updateFrame(id, patch);
            }}
          />
        ))}
      </div>

      {/* ── Zoom controls (top-right, outside transform) ──────────────── */}
      <div
        style={{
          position:       "absolute",
          top:            12,
          right:          12,
          zIndex:         20,
          display:        "flex",
          alignItems:     "center",
          gap:            2,
          background:     "rgba(6,5,10,0.82)",
          border:         "1px solid rgba(255,255,255,0.08)",
          borderRadius:   10,
          padding:        3,
          backdropFilter: "blur(12px)",
        }}
      >
        {ZOOM_LEVELS.map((z) => {
          const active = canvasTransform.scale === z;
          return (
            <button
              key={z}
              onClick={(e) => { e.stopPropagation(); setCanvasTransform({ scale: z }); }}
              style={{
                background:    active ? "rgba(139,92,246,0.2)"  : "transparent",
                border:        `1px solid ${active ? "rgba(139,92,246,0.4)" : "transparent"}`,
                borderRadius:  7,
                color:         active ? "rgba(139,92,246,1)" : "rgba(255,255,255,0.35)",
                fontSize:      10,
                fontFamily:    "var(--font-sans)",
                fontWeight:    active ? 700 : 400,
                cursor:        "pointer",
                padding:       "3px 9px",
                letterSpacing: "0.02em",
                transition:    "all 0.15s ease",
              }}
            >
              {z}%
            </button>
          );
        })}
        {/* Separator */}
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)", margin: "0 3px" }} />
        {/* Reset view */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowResetConfirm(true); }}
          title="Reset canvas view"
          style={{
            background:   "transparent",
            border:       "1px solid transparent",
            borderRadius: 7,
            color:        "rgba(255,255,255,0.45)",
            cursor:       "pointer",
            padding:      "4px 6px",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            transition:   "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background  = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color       = "rgba(255,255,255,0.75)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background  = "transparent";
            e.currentTarget.style.color       = "rgba(255,255,255,0.45)";
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          {/* Home / reset icon — crosshair with center dot */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M7.5 1v2.5M7.5 11.5V14M1 7.5h2.5M11.5 7.5H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        {/* Separator */}
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)", margin: "0 3px" }} />
        {/* Add Frame */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // 99999 → clamped to right edge by computePickerPos
            setFramePickerPos(computePickerPos(99999, 52));
            setContextMenu(null);
            setQuickAdd(null);
          }}
          title="Add Generation Frame"
          style={{
            background:    "transparent",
            border:        "1px solid transparent",
            borderRadius:  7,
            color:         "rgba(255,255,255,0.35)",
            fontSize:      10,
            cursor:        "pointer",
            padding:       "3px 9px",
            letterSpacing: "0.02em",
            fontFamily:    "var(--font-sans)",
            transition:    "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background  = "rgba(139,92,246,0.1)";
            e.currentTarget.style.color       = "rgba(139,92,246,0.85)";
            e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background  = "transparent";
            e.currentTarget.style.color       = "rgba(255,255,255,0.35)";
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          + Frame
        </button>
      </div>

      {/* ── Pan cursor hint (bottom-left) ─────────────────────────────── */}
      {elements.length > 0 && !isPanning && (
        <div
          aria-hidden
          style={{
            position:      "absolute",
            bottom:        14,
            left:          14,
            zIndex:        15,
            fontSize:      9,
            fontFamily:    "var(--font-sans)",
            color:         "rgba(255,255,255,0.18)",
            letterSpacing: "0.06em",
            pointerEvents: "none",
            userSelect:    "none",
          }}
        >
          drag to pan · ctrl+scroll to zoom
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {elements.length === 0 && frames.length === 0 && (
        <div aria-hidden style={{
          position:      "absolute", inset: 0, display: "flex",
          flexDirection: "column",  alignItems: "center", justifyContent: "center",
          gap:           20,        pointerEvents: "none",
          animation:     "cd-fade-in 0.6s ease",
        }}>
          {/* Icon ring — glow lifted for daylight readability */}
          <div style={{
            width:      72,  height: 72, borderRadius: "50%",
            border:     "1px solid rgba(139,92,246,0.28)",
            display:    "flex", alignItems: "center", justifyContent: "center",
            position:   "relative",
            boxShadow:  "0 0 36px rgba(139,92,246,0.18), inset 0 0 20px rgba(139,92,246,0.10)",
          }}>
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border:   "1px dashed rgba(139,92,246,0.22)",
            }} />
            <span style={{ fontSize: 28, color: "rgba(139,92,246,0.75)" }}>✦</span>
          </div>
          {/* Text block — title and subtitle both lifted */}
          <div style={{ textAlign: "center", maxWidth: 260 }}>
            <p style={{ fontSize: 17, fontFamily: "var(--font-display)", color: "#B8C0D4", margin: "0 0 8px", letterSpacing: "0.02em" }}>
              Your scene awaits direction
            </p>
            <p style={{ fontSize: 12, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.50)", margin: 0, lineHeight: 1.6 }}>
              Add a subject, set the world, choose a mood.<br />
              Double-click to add · Right-click for commands
            </p>
          </div>
          {/* Role chips — text and border brightened, not neon */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {ROLES.map((r) => (
              <div key={r.type} style={{
                fontSize:      12, fontFamily: "var(--font-sans)",
                color:         r.color.replace("1)", "0.70)"),
                background:    r.color.replace("1)", "0.10)"),
                border:        `1px solid ${r.color.replace("1)", "0.25)")}`,
                borderRadius:  100, padding: "4px 10px",
                letterSpacing: "0.04em",
              }}>
                {r.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Drop zone indicator ────────────────────────────────────────── */}
      {dragOver && (
        <div aria-hidden style={{
          position:       "absolute", inset: 16, pointerEvents: "none",
          border:         "2px dashed rgba(139,92,246,0.5)",
          borderRadius:   16,
          display:        "flex", alignItems: "center", justifyContent: "center",
          background:     "rgba(139,92,246,0.03)",
        }}>
          <span style={{ fontSize: 13, color: "rgba(139,92,246,0.7)", fontFamily: "var(--font-sans)" }}>
            Drop reference or text to add to scene
          </span>
        </div>
      )}

      {/* ── Quick-add picker (double-click on empty canvas) ──────────── */}
      {quickAdd && !contextMenu && (
        <QuickAddPicker
          x={quickAdd.x}
          y={quickAdd.y}
          onSelect={(type) => { onAddElement(type, `New ${type}`); setQuickAdd(null); }}
          onClose={() => setQuickAdd(null)}
        />
      )}

      {/* ── Right-click context menu ──────────────────────────────────── */}
      {contextMenu && (
        <CDContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddElement={(type) => { onAddElement(type, `New ${type}`); setContextMenu(null); }}
          onAddFrame={() => { setFramePickerPos(computePickerPos(contextMenu.x, contextMenu.y)); setContextMenu(null); }}
          onToggleDirectorControls={() => { onToggleDirectorControls?.(); setContextMenu(null); }}
          directorPanelOpen={!!directorPanelOpen}
          onResetView={() => { setShowResetConfirm(true); setContextMenu(null); }}
        />
      )}

      {/* ── Frame aspect ratio picker ─────────────────────────────────── */}
      {framePickerPos && (
        <FrameAspectRatioPicker
          x={framePickerPos.x}
          y={framePickerPos.y}
          onSelect={handleAddFrame}
          onClose={() => setFramePickerPos(null)}
        />
      )}

      {/* ── Asset drop role picker ────────────────────────────────────── */}
      {dropPicker && (
        <AssetRolePicker
          x={dropPicker.x}
          y={dropPicker.y}
          asset={dropPicker.asset}
          onSelect={(role) => {
            onAddElement(role, dropPicker.asset.name || "Reference", dropPicker.asset.url);
            onDropAsset?.(dropPicker.asset.id, role);
            setDropPicker(null);
          }}
          onClose={() => setDropPicker(null)}
        />
      )}

      {/* ── Phase 2 hint — floating glass pill while auto scene builds ── */}
      {showOnboarding && onboardingStep === 3 && <CDAutoSceneHint />}

      {/* ── Phase 3 success pill — "Your first scene is ready" ──────── */}
      {showSuccessPill && (
        <div
          aria-live="polite"
          style={{
            position:       "absolute",
            bottom:         28,
            left:           "50%",
            transform:      "translateX(-50%)",
            zIndex:         80,
            display:        "flex",
            alignItems:     "center",
            gap:            8,
            padding:        "10px 20px",
            background:     "rgba(10,8,18,0.88)",
            border:         "1px solid rgba(139,92,246,0.35)",
            borderRadius:   100,
            backdropFilter: "blur(20px)",
            boxShadow:      "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)",
            animation:      "cd-fade-in 0.3s ease",
            pointerEvents:  "none",
            whiteSpace:     "nowrap",
          }}
        >
          <span style={{ fontSize: 13, color: "rgba(139,92,246,0.9)" }}>✦</span>
          <span
            style={{
              fontFamily:    "var(--font-syne), sans-serif",
              fontSize:      12,
              fontWeight:    500,
              letterSpacing: "0.04em",
              color:         "rgba(255,255,255,0.85)",
            }}
          >
            Your scene is ready
          </span>
        </div>
      )}

      {/* ── Onboarding overlay — first visit, empty canvas only ──────── */}
      {showOnboarding && (
        <CDOnboardingOverlay
          onDismiss={() => setShowOnboarding(false)}
          step={onboardingStep}
        />
      )}

      {/* ── Reset canvas view confirmation dialog ────────────────────── */}
      {showResetConfirm && (
        <>
          <div
            style={{ position: "absolute", inset: 0, zIndex: 60 }}
            onClick={() => setShowResetConfirm(false)}
          />
          <div
            style={{
              position:       "absolute",
              top:            "50%",
              left:           "50%",
              transform:      "translate(-50%, -50%)",
              zIndex:         61,
              background:     "rgba(10,8,18,0.98)",
              border:         "1px solid rgba(255,255,255,0.12)",
              borderRadius:   16,
              padding:        "24px 28px 20px",
              minWidth:       220,
              boxShadow:      "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.12)",
              backdropFilter: "blur(24px)",
              animation:      "cd-slide-up 0.18s ease",
              display:        "flex",
              flexDirection:  "column",
              gap:            16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2.2" stroke="rgba(139,92,246,0.9)" strokeWidth="1.5" />
                <path d="M8 1.5v2.8M8 11.7v2.8M1.5 8h2.8M11.7 8h2.8" stroke="rgba(139,92,246,0.9)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span style={{ fontFamily: "var(--font-syne), sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "0.01em" }}>
                Reset canvas view?
              </span>
            </div>
            <p style={{ fontFamily: "var(--font-familjen-grotesk), sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.5 }}>
              Pan and zoom will return to default. Your nodes and connections are not affected.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 12,
                  fontFamily: "var(--font-familjen-grotesk), sans-serif",
                  cursor: "pointer", padding: "6px 14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { resetCanvasView(); setShowResetConfirm(false); }}
                style={{
                  background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)",
                  borderRadius: 8, color: "rgba(139,92,246,1)", fontSize: 12, fontWeight: 600,
                  fontFamily: "var(--font-familjen-grotesk), sans-serif",
                  cursor: "pointer", padding: "6px 14px",
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetRolePicker — role assignment popup shown when an asset is dropped
// ─────────────────────────────────────────────────────────────────────────────

function AssetRolePicker({ x, y, asset, onSelect, onClose }: {
  x:        number;
  y:        number;
  asset:    { id: string; url: string; name: string };
  onSelect: (role: DirectionElementType) => void;
  onClose:  () => void;
}) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: 30 }} onClick={onClose} />
      <div
        style={{
          position:       "absolute",
          left:           Math.min(x, 9999), // will be clamped by parent overflow:hidden
          top:            y,
          zIndex:         31,
          background:     "rgba(12,10,18,0.98)",
          border:         "1px solid rgba(255,255,255,0.1)",
          borderRadius:   12,
          padding:        8,
          display:        "flex",
          flexDirection:  "column",
          gap:            3,
          boxShadow:      "0 12px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(139,92,246,0.12)",
          backdropFilter: "blur(20px)",
          minWidth:       170,
          animation:      "cd-slide-up 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reference image preview strip */}
        <div style={{
          borderRadius: 8,
          overflow:     "hidden",
          height:       52,
          marginBottom: 4,
          position:     "relative",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url}
            alt={asset.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div style={{
            position:   "absolute",
            inset:      0,
            background: "linear-gradient(to top, rgba(12,10,18,0.8) 0%, transparent 60%)",
            display:    "flex",
            alignItems: "flex-end",
            padding:    "4px 7px",
          }}>
            <span style={{
              fontSize:      8,
              fontFamily:    "var(--font-sans)",
              fontWeight:    600,
              color:         "rgba(255,255,255,0.75)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
              {asset.name || "Reference"}
            </span>
          </div>
        </div>

        <p style={{
          fontSize:      9,
          color:         "rgba(255,255,255,0.25)",
          fontFamily:    "var(--font-sans)",
          margin:        "2px 8px 6px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>
          Assign role
        </p>

        {ROLES.map((r) => (
          <AssetRoleItem key={r.type} role={r} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}

function AssetRoleItem({
  role,
  onSelect,
}: {
  role:     { type: DirectionElementType; label: string; color: string };
  onSelect: (type: DirectionElementType) => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => onSelect(role.type)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:  hov ? "rgba(255,255,255,0.06)" : "transparent",
        border:      "none",
        borderRadius: 8,
        color:       hov ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)",
        fontSize:    13,
        fontFamily:  "var(--font-sans)",
        cursor:      "pointer",
        padding:     "8px 10px",
        textAlign:   "left",
        display:     "flex",
        alignItems:  "center",
        gap:         10,
        transition:  "all 0.12s ease",
      }}
    >
      <span style={{
        width:     10,
        height:    10,
        borderRadius: "50%",
        background: role.color,
        flexShrink: 0,
        boxShadow: `0 0 6px ${role.color.replace("1)", "0.5)")}`,
      }} />
      {role.label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickAddPicker — small pill menu on left-click
// ─────────────────────────────────────────────────────────────────────────────

function QuickAddPicker({ x, y, onSelect, onClose }: {
  x:        number;
  y:        number;
  onSelect: (type: DirectionElementType) => void;
  onClose:  () => void;
}) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: 30 }} onClick={onClose} />
      <div
        style={{
          position:       "absolute",
          left:           x,
          top:            y,
          zIndex:         31,
          background:     "rgba(12,10,18,0.98)",
          border:         "1px solid rgba(255,255,255,0.1)",
          borderRadius:   12,
          padding:        8,
          display:        "flex",
          flexDirection:  "column",
          gap:            3,
          boxShadow:      "0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1)",
          backdropFilter: "blur(20px)",
          minWidth:       160,
          animation:      "cd-slide-up 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-sans)", margin: "2px 8px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Add element
        </p>
        {ROLES.map((r) => (
          <button
            key={r.type}
            onClick={() => onSelect(r.type)}
            style={{
              background:  "transparent", border: "none", borderRadius: 8,
              color:       "rgba(255,255,255,0.65)", fontSize: 13,
              fontFamily:  "var(--font-sans)", cursor: "pointer",
              padding:     "8px 10px", textAlign: "left",
              display:     "flex", alignItems: "center", gap: 10,
              transition:  "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color      = "rgba(255,255,255,0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color      = "rgba(255,255,255,0.65)";
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: r.color, flexShrink: 0,
              boxShadow: `0 0 6px ${r.color.replace("1)", "0.5)")}`,
            }} />
            {r.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CDContextMenu — premium right-click menu
// ─────────────────────────────────────────────────────────────────────────────

function CDContextMenu({ x, y, onClose, onAddElement, onAddFrame, onToggleDirectorControls, directorPanelOpen, onResetView }: {
  x:                       number;
  y:                       number;
  onClose:                 () => void;
  onAddElement:            (type: DirectionElementType) => void;
  onAddFrame:              () => void;
  onToggleDirectorControls: () => void;
  directorPanelOpen:       boolean;
  onResetView:             () => void;
}) {
  return (
    <>
      <div
        style={{ position: "absolute", inset: 0, zIndex: 50 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position:       "absolute",
          left:           x,
          top:            y,
          zIndex:         51,
          background:     "rgba(10,8,16,0.99)",
          border:         "1px solid rgba(255,255,255,0.1)",
          borderRadius:   14,
          padding:        "6px",
          minWidth:       200,
          boxShadow:      "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.15)",
          backdropFilter: "blur(24px)",
          animation:      "cd-slide-up 0.18s ease",
        }}
      >
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-sans)", margin: "4px 10px 6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Add to scene
        </p>
        {ROLES.map((r) => (
          <ContextMenuItem
            key={r.type}
            label={`Add ${r.label}`}
            dot={r.color}
            onClick={() => onAddElement(r.type)}
          />
        ))}
        <ContextMenuItem
          label="Add Frame"
          icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1.5" y="1.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.5 1.5" />
            </svg>
          }
          iconColor="rgba(139,92,246,0.75)"
          onClick={onAddFrame}
        />
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
        <ContextMenuItem
          label="Reset Canvas View"
          icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6 1v2M6 9v2M1 6h2M9 6h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          }
          iconColor="rgba(255,255,255,0.5)"
          onClick={onResetView}
        />
        <ContextMenuItem
          label={directorPanelOpen ? "Close Director Controls" : "Open Director Controls"}
          icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.7 2.7l1.06 1.06M8.24 8.24l1.06 1.06M2.7 9.3l1.06-1.06M8.24 3.76l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          }
          iconColor="rgba(139,92,246,0.8)"
          onClick={onToggleDirectorControls}
        />
      </div>
    </>
  );
}

function ContextMenuItem({ label, dot, icon, iconColor, onClick }: {
  label:      string;
  dot?:       string;
  icon?:      React.ReactNode;
  iconColor?: string;
  onClick:    () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:   hov ? "rgba(255,255,255,0.06)" : "transparent",
        border:       "none",
        borderRadius: 9,
        color:        hov ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
        fontSize:     12,
        fontFamily:   "var(--font-sans)",
        cursor:       "pointer",
        padding:      "8px 10px",
        textAlign:    "left",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        width:        "100%",
        transition:   "all 0.12s ease",
      }}
    >
      {dot && (
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: `0 0 6px ${dot.replace("1)", "0.5)")}` }} />
      )}
      {icon && (
        <span style={{ color: iconColor ?? "currentColor", display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      )}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FrameAspectRatioPicker — vertical 4-choice popup for selecting aspect ratio.
// x,y are pre-clamped canvas-local coordinates from computePickerPos.
// ─────────────────────────────────────────────────────────────────────────────

const ASPECT_CHOICES: Array<{ ratio: FrameAspectRatio; label: string; w: number; h: number }> = [
  { ratio: "16:9", label: "Landscape", w: 40, h: 22 },
  { ratio: "1:1",  label: "Square",    w: 28, h: 28 },
  { ratio: "4:5",  label: "Story",     w: 24, h: 30 },
  { ratio: "9:16", label: "Portrait",  w: 18, h: 32 },
];

function FrameAspectRatioPicker({ x, y, onSelect, onClose }: {
  x:        number;
  y:        number;
  onSelect: (ratio: FrameAspectRatio) => void;
  onClose:  () => void;
}) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: 40 }} onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position:       "absolute",
          left:           x,
          top:            y,
          zIndex:         41,
          background:     "rgba(10,8,16,0.99)",
          border:         "1px solid rgba(255,255,255,0.1)",
          borderRadius:   14,
          padding:        "8px",
          minWidth:       180,
          boxShadow:      "0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.15)",
          backdropFilter: "blur(24px)",
          animation:      "cd-slide-up 0.18s ease",
          display:        "flex",
          flexDirection:  "column",
          gap:            3,
        }}
      >
        <p style={{
          fontSize:      9,
          color:         "rgba(255,255,255,0.25)",
          fontFamily:    "var(--font-sans)",
          margin:        "2px 8px 6px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}>
          Frame size
        </p>
        {ASPECT_CHOICES.map(({ ratio, label, w, h }) => (
          <FrameARChoice key={ratio} ratio={ratio} label={label} w={w} h={h} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}

function FrameARChoice({ ratio, label, w, h, onSelect }: {
  ratio:    FrameAspectRatio;
  label:    string;
  w:        number;
  h:        number;
  onSelect: (ratio: FrameAspectRatio) => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => onSelect(ratio)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:    hov ? "rgba(139,92,246,0.1)" : "transparent",
        border:        `1px solid ${hov ? "rgba(139,92,246,0.35)" : "transparent"}`,
        borderRadius:  9,
        cursor:        "pointer",
        padding:       "7px 10px",
        display:       "flex",
        alignItems:    "center",
        gap:           10,
        width:         "100%",
        textAlign:     "left",
        transition:    "all 0.15s ease",
      }}
    >
      {/* Aspect ratio thumbnail */}
      <div style={{
        width:        w,
        height:       h,
        borderRadius: 2,
        border:       `1.5px dashed ${hov ? "rgba(139,92,246,0.7)" : "rgba(255,255,255,0.22)"}`,
        background:   hov ? "rgba(139,92,246,0.08)" : "transparent",
        transition:   "all 0.15s ease",
        flexShrink:   0,
      }} />
      {/* Labels */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          fontSize:      10,
          fontFamily:    "var(--font-sans)",
          fontWeight:    600,
          letterSpacing: "0.04em",
          color:         hov ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)",
          lineHeight:    1,
          transition:    "color 0.15s ease",
        }}>
          {label}
        </span>
        <span style={{
          fontSize:      8,
          fontFamily:    "var(--font-sans)",
          letterSpacing: "0.06em",
          color:         hov ? "rgba(139,92,246,0.8)" : "rgba(255,255,255,0.3)",
          lineHeight:    1,
          transition:    "color 0.15s ease",
          textTransform: "uppercase",
        }}>
          {ratio}
        </span>
      </div>
    </button>
  );
}
