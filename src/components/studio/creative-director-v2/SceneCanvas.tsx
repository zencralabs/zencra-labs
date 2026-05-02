"use client";

/**
 * SceneCanvas — center canvas zone for Creative Director v2.
 *
 * Renders floating SceneNodes on a dark cinematic canvas.
 * Nodes are laid out in an auto-grid on first appearance, then become
 * draggable via onMove. Position state is local (canvas layout only).
 *
 * SVG connection lines between Subject→World nodes give the scene spatial
 * structure. Connections drawn as subtle dashed lines.
 *
 * Drop zone: dragging text onto canvas opens a quick-add role picker.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { useDirectionStore, selectElements }        from "@/lib/creative-director/store";
import { SceneNode }                               from "./SceneNode";
import type { DirectionElementType }               from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface CanvasPosition {
  x: number;
  y: number;
}

interface SceneCanvasProps {
  onAddElement: (type: DirectionElementType, label: string) => void;
}

// Default positions when first placing nodes in a grid
function defaultPosition(index: number, total: number, canvasW: number, canvasH: number): CanvasPosition {
  const cols   = Math.ceil(Math.sqrt(total));
  const col    = index % cols;
  const row    = Math.floor(index / cols);
  const cellW  = canvasW / (cols + 1);
  const cellH  = canvasH / (Math.ceil(total / cols) + 1);
  return {
    x: cellW * (col + 1) - 80,
    y: cellH * (row + 1) - 30,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function SceneCanvas({ onAddElement }: SceneCanvasProps) {
  const elements  = useDirectionStore(selectElements);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Local position map: elementId → { x, y }
  const [positions, setPositions] = useState<Record<string, CanvasPosition>>({});

  // Drag-over state for drop zone
  const [dragOver, setDragOver] = useState(false);

  // Quick-add role picker (click on empty canvas area)
  const [quickAdd, setQuickAdd] = useState<{ x: number; y: number } | null>(null);

  // ── Resolve position for a node ──────────────────────────────────────────
  const getPosition = useCallback(
    (id: string, idx: number): CanvasPosition => {
      if (positions[id]) return positions[id];
      const rect = canvasRef.current?.getBoundingClientRect();
      const w    = rect?.width  ?? 600;
      const h    = rect?.height ?? 400;
      return defaultPosition(idx, elements.length, w, h);
    },
    [positions, elements.length]
  );

  // ── Move handler ─────────────────────────────────────────────────────────
  const handleMove = useCallback((id: string, dx: number, dy: number) => {
    setPositions((prev) => {
      const cur = prev[id] ?? { x: 0, y: 0 };
      return { ...prev, [id]: { x: cur.x + dx, y: cur.y + dy } };
    });
  }, []);

  // ── SVG connection lines (Subject → World) ────────────────────────────────
  const connections = useMemo(() => {
    const subjects    = elements.filter((e) => e.type === "subject");
    const worlds      = elements.filter((e) => e.type === "world");
    const pairs: Array<{ from: string; to: string }> = [];
    subjects.forEach((s) => {
      worlds.forEach((w) => {
        pairs.push({ from: s.id, to: w.id });
      });
    });
    return pairs;
  }, [elements]);

  // ── Canvas click → quick add ──────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-scene-node]")) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setQuickAdd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={canvasRef}
      onClick={handleCanvasClick}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const text = e.dataTransfer.getData("text/plain").trim();
        if (text) {
          // Default to subject if dropped as raw text
          onAddElement("subject", text);
        }
      }}
      style={{
        flex:       1,
        position:   "relative",
        overflow:   "hidden",
        background: dragOver
          ? "rgba(139,92,246,0.03)"
          : "radial-gradient(ellipse at 50% 40%, rgba(20,18,30,1) 0%, rgba(7,7,9,1) 70%)",
        transition: "background 0.3s",
        cursor:     "crosshair",
      }}
    >
      {/* Grid overlay — subtle dot grid */}
      <div
        aria-hidden
        style={{
          position:       "absolute",
          inset:          0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents:  "none",
        }}
      />

      {/* SVG connection lines */}
      {connections.length > 0 && (
        <svg
          aria-hidden
          style={{
            position:      "absolute",
            inset:         0,
            width:         "100%",
            height:        "100%",
            pointerEvents: "none",
            zIndex:        5,
          }}
        >
          {connections.map(({ from, to }, i) => {
            const fi = elements.findIndex((e) => e.id === from);
            const ti = elements.findIndex((e) => e.id === to);
            const fp = getPosition(from, fi);
            const tp = getPosition(to, ti);
            // Center of 120px-wide node
            const x1 = fp.x + 80;
            const y1 = fp.y + 20;
            const x2 = tp.x + 80;
            const y2 = tp.y + 20;
            return (
              <line
                key={i}
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                stroke="rgba(139,92,246,0.15)"
                strokeWidth={1}
                strokeDasharray="4 6"
              />
            );
          })}
        </svg>
      )}

      {/* Scene nodes */}
      {elements.map((el, idx) => (
        <div key={el.id} data-scene-node="true" style={{ position: "absolute", top: 0, left: 0 }}>
          <SceneNode
            element={el}
            x={getPosition(el.id, idx).x}
            y={getPosition(el.id, idx).y}
            onMove={handleMove}
          />
        </div>
      ))}

      {/* Empty canvas hint */}
      {elements.length === 0 && (
        <div
          aria-hidden
          style={{
            position:       "absolute",
            inset:          0,
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            gap:            10,
            pointerEvents:  "none",
          }}
        >
          <div
            style={{
              width:        56,
              height:       56,
              borderRadius: "50%",
              border:       "1px dashed rgba(139,92,246,0.2)",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              fontSize:     22,
              color:        "rgba(139,92,246,0.3)",
            }}
          >
            ✦
          </div>
          <p
            style={{
              fontSize:   12,
              color:      "rgba(255,255,255,0.2)",
              fontFamily: "var(--font-sans)",
              textAlign:  "center",
              lineHeight: 1.5,
              maxWidth:   200,
              margin:     0,
            }}
          >
            Add subjects, environments, and objects to build your scene
          </p>
        </div>
      )}

      {/* Drop zone indicator */}
      {dragOver && (
        <div
          aria-hidden
          style={{
            position:       "absolute",
            inset:          12,
            border:         "2px dashed rgba(139,92,246,0.4)",
            borderRadius:   12,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            pointerEvents:  "none",
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(139,92,246,0.6)", fontFamily: "var(--font-sans)" }}>
            Drop to add to scene
          </span>
        </div>
      )}

      {/* Quick-add role picker */}
      {quickAdd && (
        <QuickAddPicker
          x={quickAdd.x}
          y={quickAdd.y}
          onSelect={(type) => {
            onAddElement(type, `New ${type}`);
            setQuickAdd(null);
          }}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickAddPicker — role selection bubble shown on canvas click
// ─────────────────────────────────────────────────────────────────────────────

const ROLES: Array<{ type: DirectionElementType; label: string; color: string }> = [
  { type: "subject",    label: "Subject",    color: "rgba(59,130,246,1)" },
  { type: "world",      label: "World",      color: "rgba(34,197,94,1)"  },
  { type: "atmosphere", label: "Atmosphere", color: "rgba(139,92,246,1)" },
  { type: "object",     label: "Object",     color: "rgba(249,115,22,1)" },
];

function QuickAddPicker({
  x, y, onSelect, onClose,
}: {
  x: number; y: number;
  onSelect: (type: DirectionElementType) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, zIndex: 30 }}
        onClick={onClose}
      />
      {/* Picker bubble */}
      <div
        style={{
          position:       "absolute",
          left:           x,
          top:            y,
          zIndex:         31,
          background:     "rgba(14,14,18,0.97)",
          border:         "1px solid rgba(255,255,255,0.1)",
          borderRadius:   10,
          padding:        6,
          display:        "flex",
          flexDirection:  "column",
          gap:            3,
          boxShadow:      "0 8px 32px rgba(0,0,0,0.6)",
          backdropFilter: "blur(16px)",
          minWidth:       130,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-sans)", margin: "2px 6px 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Add element
        </p>
        {ROLES.map((r) => (
          <button
            key={r.type}
            onClick={() => onSelect(r.type)}
            style={{
              background:   "transparent",
              border:       "none",
              borderRadius: 6,
              color:        "rgba(255,255,255,0.7)",
              fontSize:     12,
              fontFamily:   "var(--font-sans)",
              cursor:       "pointer",
              padding:      "6px 8px",
              textAlign:    "left",
              display:      "flex",
              alignItems:   "center",
              gap:          8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
            {r.label}
          </button>
        ))}
      </div>
    </>
  );
}
