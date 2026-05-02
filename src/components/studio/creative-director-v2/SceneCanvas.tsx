"use client";

/**
 * SceneCanvas — cinematic center canvas for Creative Director v2.
 *
 * Depth: deep radial gradient (midnight purple core → near-black), dot grid,
 * ambient corner vignettes.
 * Nodes: floating glass cards with role glow, draggable, connection lines.
 * Connection lines: 1.5px, rgba(139,92,246,0.25) — elegant but visible.
 * Empty state: large cinematic icon + inspiring copy.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { useDirectionStore, selectElements }        from "@/lib/creative-director/store";
import { SceneNode }                               from "./SceneNode";
import type { DirectionElementType }               from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface CanvasPosition { x: number; y: number; }

interface SceneCanvasProps {
  onAddElement: (type: DirectionElementType, label: string) => void;
}

const ROLES: Array<{ type: DirectionElementType; label: string; color: string }> = [
  { type: "subject",    label: "Subject",    color: "rgba(59,130,246,1)" },
  { type: "world",      label: "World",      color: "rgba(34,197,94,1)"  },
  { type: "atmosphere", label: "Atmosphere", color: "rgba(139,92,246,1)" },
  { type: "object",     label: "Object",     color: "rgba(249,115,22,1)" },
];

function defaultPosition(idx: number, total: number, w: number, h: number): CanvasPosition {
  const cols  = Math.min(3, Math.ceil(Math.sqrt(total)));
  const col   = idx % cols;
  const row   = Math.floor(idx / cols);
  const cellW = w / (cols + 1);
  const cellH = h / (Math.ceil(total / cols) + 1);
  return { x: cellW * (col + 1) - 90, y: cellH * (row + 1) - 30 };
}

// ─────────────────────────────────────────────────────────────────────────────

export function SceneCanvas({ onAddElement }: SceneCanvasProps) {
  const elements  = useDirectionStore(selectElements);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, CanvasPosition>>({});
  const [dragOver, setDragOver]   = useState(false);
  const [quickAdd, setQuickAdd]   = useState<{ x: number; y: number } | null>(null);

  const getPosition = useCallback(
    (id: string, idx: number): CanvasPosition => {
      if (positions[id]) return positions[id];
      const rect = canvasRef.current?.getBoundingClientRect();
      return defaultPosition(idx, elements.length, rect?.width ?? 600, rect?.height ?? 400);
    },
    [positions, elements.length]
  );

  const handleMove = useCallback((id: string, dx: number, dy: number) => {
    setPositions((prev) => {
      const cur = prev[id] ?? { x: 0, y: 0 };
      return { ...prev, [id]: { x: cur.x + dx, y: cur.y + dy } };
    });
  }, []);

  const connections = useMemo(() => {
    const subjects = elements.filter((e) => e.type === "subject");
    const worlds   = elements.filter((e) => e.type === "world");
    return subjects.flatMap((s) => worlds.map((w) => ({ from: s.id, to: w.id })));
  }, [elements]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-scene-node]")) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setQuickAdd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      ref={canvasRef}
      onClick={handleCanvasClick}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const text = e.dataTransfer.getData("text/plain").trim();
        if (text) onAddElement("subject", text);
      }}
      style={{
        flex:       1,
        position:   "relative",
        overflow:   "hidden",
        cursor:     "crosshair",
        // Deep cinematic background
        background: dragOver
          ? "rgba(139,92,246,0.04)"
          : "radial-gradient(ellipse at 45% 35%, rgba(24,18,40,1) 0%, rgba(14,11,28,1) 40%, rgba(6,5,10,1) 75%)",
        transition: "background 0.4s ease",
      }}
    >
      {/* Dot grid overlay */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      {/* Ambient corner glows */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 0% 100%, rgba(139,92,246,0.06) 0%, transparent 50%), radial-gradient(ellipse at 100% 0%, rgba(59,130,246,0.05) 0%, transparent 50%)",
      }} />

      {/* Bottom vignette */}
      <div aria-hidden style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 120, pointerEvents: "none",
        background: "linear-gradient(to top, rgba(6,5,10,0.8) 0%, transparent 100%)",
      }} />

      {/* SVG connection lines */}
      {connections.length > 0 && (
        <svg aria-hidden style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          pointerEvents: "none", zIndex: 5,
        }}>
          <defs>
            <linearGradient id="conn-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(59,130,246,0.3)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0.3)" />
            </linearGradient>
          </defs>
          {connections.map(({ from, to }, i) => {
            const fi = elements.findIndex((e) => e.id === from);
            const ti = elements.findIndex((e) => e.id === to);
            const fp = getPosition(from, fi);
            const tp = getPosition(to, ti);
            const x1 = fp.x + 90; const y1 = fp.y + 22;
            const x2 = tp.x + 90; const y2 = tp.y + 22;
            // Bezier control points for elegant curve
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 - 30;
            return (
              <g key={i}>
                {/* Glow shadow line */}
                <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                  fill="none" stroke="rgba(139,92,246,0.12)"
                  strokeWidth={6} strokeLinecap="round" />
                {/* Main line */}
                <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                  fill="none" stroke="url(#conn-grad)"
                  strokeWidth={1.5} strokeLinecap="round" strokeDasharray="5 8" />
              </g>
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

      {/* Empty state — inspiring, cinematic */}
      {elements.length === 0 && (
        <div aria-hidden style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 20, pointerEvents: "none",
          animation: "cd-fade-in 0.6s ease",
        }}>
          {/* Cinematic frame icon */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: "1px solid rgba(139,92,246,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            boxShadow: "0 0 32px rgba(139,92,246,0.08), inset 0 0 20px rgba(139,92,246,0.04)",
          }}>
            {/* Outer ring */}
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: "1px dashed rgba(139,92,246,0.1)",
            }} />
            <span style={{ fontSize: 28, color: "rgba(139,92,246,0.5)" }}>✦</span>
          </div>

          <div style={{ textAlign: "center", maxWidth: 260 }}>
            <p style={{
              fontSize: 15, fontFamily: "var(--font-display)",
              color: "rgba(255,255,255,0.35)", margin: "0 0 8px", letterSpacing: "0.02em",
            }}>
              Your scene awaits direction
            </p>
            <p style={{
              fontSize: 12, fontFamily: "var(--font-sans)",
              color: "rgba(255,255,255,0.18)", margin: 0, lineHeight: 1.6,
            }}>
              Add a subject, set the world, choose a mood.<br />
              Then let the Director bring it to life.
            </p>
          </div>

          {/* Role hint row */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {ROLES.map((r) => (
              <div key={r.type} style={{
                fontSize: 10, fontFamily: "var(--font-sans)",
                color: r.color.replace("1)", "0.5)"),
                background: r.color.replace("1)", "0.06)"),
                border: `1px solid ${r.color.replace("1)", "0.15)")}`,
                borderRadius: 100, padding: "4px 10px",
                letterSpacing: "0.04em",
              }}>
                {r.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop zone indicator */}
      {dragOver && (
        <div aria-hidden style={{
          position: "absolute", inset: 16, border: "2px dashed rgba(139,92,246,0.5)",
          borderRadius: 16, display: "flex", alignItems: "center",
          justifyContent: "center", pointerEvents: "none",
          background: "rgba(139,92,246,0.03)",
        }}>
          <span style={{ fontSize: 13, color: "rgba(139,92,246,0.7)", fontFamily: "var(--font-sans)" }}>
            Drop to add to scene
          </span>
        </div>
      )}

      {/* Quick-add picker */}
      {quickAdd && (
        <QuickAddPicker
          x={quickAdd.x} y={quickAdd.y}
          onSelect={(type) => { onAddElement(type, `New ${type}`); setQuickAdd(null); }}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function QuickAddPicker({ x, y, onSelect, onClose }: {
  x: number; y: number;
  onSelect: (type: DirectionElementType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: 30 }} onClick={onClose} />
      <div style={{
        position: "absolute", left: x, top: y, zIndex: 31,
        background: "rgba(12,10,18,0.98)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, padding: 8,
        display: "flex", flexDirection: "column", gap: 3,
        boxShadow: "0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1)",
        backdropFilter: "blur(20px)",
        minWidth: 150,
        animation: "cd-slide-up 0.2s ease",
      }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-sans)", margin: "2px 8px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Add element
        </p>
        {ROLES.map((r) => (
          <button key={r.type} onClick={() => onSelect(r.type)}
            style={{
              background: "transparent", border: "none", borderRadius: 8,
              color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "var(--font-sans)",
              cursor: "pointer", padding: "8px 10px", textAlign: "left",
              display: "flex", alignItems: "center", gap: 10, transition: "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "rgba(255,255,255,0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.65)";
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: r.color, flexShrink: 0, boxShadow: `0 0 6px ${r.color.replace("1)", "0.5)")}` }} />
            {r.label}
          </button>
        ))}
      </div>
    </>
  );
}
