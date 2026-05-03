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

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import {
  useDirectionStore,
  selectElements,
  selectCanvasTransform,
} from "@/lib/creative-director/store";
import { SceneNode }     from "./SceneNode";
import type { DirectionElementType } from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface CanvasPosition { x: number; y: number; }

interface SceneCanvasProps {
  onAddElement:            (type: DirectionElementType, label: string) => void;
  onOpenDirectorControls?: () => void;
  onDropAsset?:            (assetId: string, role: DirectionElementType) => void;
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

export function SceneCanvas({ onAddElement, onOpenDirectorControls, onDropAsset }: SceneCanvasProps) {
  const elements        = useDirectionStore(selectElements);
  const canvasTransform = useDirectionStore(selectCanvasTransform);
  const setCanvasTransform = useDirectionStore((s) => s.setCanvasTransform);
  const resetCanvasView    = useDirectionStore((s) => s.resetCanvasView);

  const canvasRef       = useRef<HTMLDivElement>(null);
  const panStartRef     = useRef<{
    clientX: number; clientY: number;
    startX:  number; startY:  number;
  } | null>(null);
  const panHappenedRef  = useRef(false);
  const scaleRef        = useRef<number>(100);
  const prevElIdsRef    = useRef<Set<string>>(new Set());

  // Track current scale in a ref so handleMove stays stable
  scaleRef.current = canvasTransform.scale;

  const [positions,    setPositions]   = useState<Record<string, CanvasPosition>>({});
  const [dragOver,     setDragOver]    = useState(false);
  const [isPanning,    setIsPanning]   = useState(false);
  const [quickAdd,     setQuickAdd]    = useState<{ x: number; y: number } | null>(null);
  const [contextMenu,  setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [springNodes,  setSpringNodes] = useState<Set<string>>(new Set());

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

  // ── Pan — global mouse handlers (registered once) ─────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const dx   = e.clientX - panStartRef.current.clientX;
      const dy   = e.clientY - panStartRef.current.clientY;
      const newX = Math.max(-200, Math.min(200, panStartRef.current.startX + dx));
      const newY = Math.max(-200, Math.min(200, panStartRef.current.startY + dy));
      // Use getState() so we don't need canvasTransform in deps
      useDirectionStore.getState().setCanvasTransform({ x: newX, y: newY });
    };

    const onMouseUp = (e: MouseEvent) => {
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

  // ── Click: quick-add or close menus (skip if pan happened) ───────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (panHappenedRef.current) { panHappenedRef.current = false; return; }
    if ((e.target as HTMLElement).closest("[data-scene-node]")) return;
    if (contextMenu) { setContextMenu(null); return; }
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
      if (e.key === "Escape") { setContextMenu(null); setQuickAdd(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Connection lines: all non-subjects → first subject ───────────────────
  const connections = useMemo(() => {
    const firstSubject = elements.find((e) => e.type === "subject");
    if (!firstSubject) return [];
    return elements
      .filter((e) => e.id !== firstSubject.id)
      .map((e) => ({ from: firstSubject.id, to: e.id, weight: e.weight, isNew: false }));
  }, [elements]);

  // Mark connection as new if its target is a spring node (evaluated at render)
  const connectionsWithNew = connections.map((c) => ({
    ...c,
    isNew: springNodes.has(c.to),
  }));

  // CSS transform for the viewport
  const viewportTransform = `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale / 100})`;

  return (
    <div
      ref={canvasRef}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);

        // ── Asset tray drop (priority) ───────────────────────────────────
        const assetJson = e.dataTransfer.getData("application/cd-asset");
        if (assetJson) {
          try {
            const asset = JSON.parse(assetJson) as { id: string; url: string; name: string };
            const role: DirectionElementType = "subject"; // role picker deferred
            onAddElement(role, asset.name || "Reference");
            onDropAsset?.(asset.id, role);
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
        background: dragOver
          ? "rgba(139,92,246,0.04)"
          : "radial-gradient(ellipse at 45% 35%, rgba(24,18,40,1) 0%, rgba(14,11,28,1) 40%, rgba(6,5,10,1) 75%)",
        transition:  "background 0.4s ease",
        userSelect:  "none",
      }}
    >
      {/* ── Static background layers (outside transform) ──────────────── */}
      {/* Dot grid */}
      <div aria-hidden style={{
        position:        "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
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
        {/* SVG connection lines — drawn in canvas (pre-transform) space */}
        {connectionsWithNew.length > 0 && (
          <svg
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              pointerEvents: "none", zIndex: 5,
            }}
          >
            <defs>
              <linearGradient id="conn-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="rgba(59,130,246,0.5)" />
                <stop offset="100%" stopColor="rgba(139,92,246,0.5)" />
              </linearGradient>
            </defs>
            {connectionsWithNew.map(({ from, to, weight, isNew }) => {
              const fi = elements.findIndex((e) => e.id === from);
              const ti = elements.findIndex((e) => e.id === to);
              const fp = getPosition(from, fi);
              const tp = getPosition(to,   ti);
              const x1 = fp.x + 90;  const y1 = fp.y + 22;
              const x2 = tp.x + 90;  const y2 = tp.y + 22;
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2 - 40;
              const opacity  = 0.15 + weight * 0.55;
              const strokeW  = 1.0  + weight * 1.5;
              return (
                <g
                  key={`${from}-${to}`}
                  style={{ animation: isNew ? "cd-fade-in 0.5s ease" : "none" }}
                >
                  {/* Glow backing */}
                  <path
                    d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                    fill="none"
                    stroke={`rgba(139,92,246,${(opacity * 0.28).toFixed(3)})`}
                    strokeWidth={strokeW * 5}
                    strokeLinecap="round"
                  />
                  {/* Main dashed line */}
                  <path
                    d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                    fill="none"
                    stroke="url(#conn-grad)"
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    strokeOpacity={opacity}
                    strokeDasharray="5 8"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Scene nodes */}
        {elements.map((el, idx) => (
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
              x={getPosition(el.id, idx).x}
              y={getPosition(el.id, idx).y}
              onMove={handleMove}
            />
          </div>
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
          onClick={(e) => { e.stopPropagation(); resetCanvasView(); }}
          title="Reset view"
          style={{
            background:   "transparent",
            border:       "1px solid transparent",
            borderRadius: 7,
            color:        "rgba(255,255,255,0.25)",
            fontSize:     11,
            cursor:       "pointer",
            padding:      "2px 7px",
            transition:   "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background   = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color        = "rgba(255,255,255,0.55)";
            e.currentTarget.style.borderColor  = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background   = "transparent";
            e.currentTarget.style.color        = "rgba(255,255,255,0.25)";
            e.currentTarget.style.borderColor  = "transparent";
          }}
        >
          ⟳
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
      {elements.length === 0 && (
        <div aria-hidden style={{
          position:      "absolute", inset: 0, display: "flex",
          flexDirection: "column",  alignItems: "center", justifyContent: "center",
          gap:           20,        pointerEvents: "none",
          animation:     "cd-fade-in 0.6s ease",
        }}>
          <div style={{
            width:      72,  height: 72, borderRadius: "50%",
            border:     "1px solid rgba(139,92,246,0.2)",
            display:    "flex", alignItems: "center", justifyContent: "center",
            position:   "relative",
            boxShadow:  "0 0 32px rgba(139,92,246,0.08), inset 0 0 20px rgba(139,92,246,0.04)",
          }}>
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border:   "1px dashed rgba(139,92,246,0.1)",
            }} />
            <span style={{ fontSize: 28, color: "rgba(139,92,246,0.5)" }}>✦</span>
          </div>
          <div style={{ textAlign: "center", maxWidth: 260 }}>
            <p style={{ fontSize: 15, fontFamily: "var(--font-display)", color: "rgba(255,255,255,0.35)", margin: "0 0 8px", letterSpacing: "0.02em" }}>
              Your scene awaits direction
            </p>
            <p style={{ fontSize: 12, fontFamily: "var(--font-sans)", color: "rgba(255,255,255,0.18)", margin: 0, lineHeight: 1.6 }}>
              Add a subject, set the world, choose a mood.<br />
              Right-click or click to add scene elements.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {ROLES.map((r) => (
              <div key={r.type} style={{
                fontSize:   10, fontFamily: "var(--font-sans)",
                color:      r.color.replace("1)", "0.5)"),
                background: r.color.replace("1)", "0.06)"),
                border:     `1px solid ${r.color.replace("1)", "0.15)")}`,
                borderRadius: 100, padding: "4px 10px",
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

      {/* ── Quick-add picker (left-click on empty) ────────────────────── */}
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
          onOpenDirectorControls={() => { onOpenDirectorControls?.(); setContextMenu(null); }}
        />
      )}
    </div>
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
          minWidth:       150,
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

function CDContextMenu({ x, y, onClose, onAddElement, onOpenDirectorControls }: {
  x:                      number;
  y:                      number;
  onClose:                () => void;
  onAddElement:           (type: DirectionElementType) => void;
  onOpenDirectorControls: () => void;
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
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
        <ContextMenuItem
          label="Open Director Controls"
          icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.7 2.7l1.06 1.06M8.24 8.24l1.06 1.06M2.7 9.3l1.06-1.06M8.24 3.76l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          }
          iconColor="rgba(139,92,246,0.8)"
          onClick={onOpenDirectorControls}
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
