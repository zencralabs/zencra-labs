"use client";

/**
 * SceneCanvas — cinematic center canvas for Creative Director v2.
 *
 * Depth: deep radial gradient (midnight purple core → near-black), dot grid,
 * ambient corner vignettes.
 * Nodes: floating glass cards with role glow, draggable, connection lines.
 * Connection lines: 1.5px, rgba(139,92,246,0.25) — elegant but visible.
 * Empty state: large cinematic icon + inspiring copy.
 *
 * Right-click: premium CDContextMenu with Add role / Open Director Controls.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useDirectionStore, selectElements }                  from "@/lib/creative-director/store";
import { SceneNode }                                          from "./SceneNode";
import type { DirectionElementType }                          from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

interface CanvasPosition { x: number; y: number; }

interface SceneCanvasProps {
  onAddElement:             (type: DirectionElementType, label: string) => void;
  onOpenDirectorControls?:  () => void;
  /** Called when an AssetTray thumbnail is dropped onto the canvas. */
  onDropAsset?:             (assetId: string, role: DirectionElementType) => void;
}

const ROLES: Array<{ type: DirectionElementType; label: string; color: string }> = [
  { type: "subject",    label: "Subject",    color: "rgba(59,130,246,1)"  },
  { type: "world",      label: "World",      color: "rgba(34,197,94,1)"   },
  { type: "atmosphere", label: "Atmosphere", color: "rgba(139,92,246,1)"  },
  { type: "object",     label: "Object",     color: "rgba(249,115,22,1)"  },
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

export function SceneCanvas({ onAddElement, onOpenDirectorControls, onDropAsset }: SceneCanvasProps) {
  const elements  = useDirectionStore(selectElements);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [positions,  setPositions]  = useState<Record<string, CanvasPosition>>({});
  const [dragOver,   setDragOver]   = useState(false);
  const [quickAdd,   setQuickAdd]   = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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
    // Close context menu on left-click
    if (contextMenu) { setContextMenu(null); return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    setQuickAdd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Don't show canvas context menu if clicking on a node
    if ((e.target as HTMLElement).closest("[data-scene-node]")) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setQuickAdd(null);
  }, []);

  // Close context menu on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      ref={canvasRef}
      onClick={handleCanvasClick}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);

        // ── Asset tray drop (priority) ─────────────────────────────────────
        const assetJson = e.dataTransfer.getData("application/cd-asset");
        if (assetJson) {
          try {
            const asset = JSON.parse(assetJson) as { id: string; url: string; name: string };
            // Default role: subject. Role-zone detection is a future phase.
            const role: DirectionElementType = "subject";
            onAddElement(role, asset.name || "Reference");
            onDropAsset?.(asset.id, role);
          } catch { /* malformed payload — ignore */ }
          return;
        }

        // ── Plain text drop (existing behavior) ───────────────────────────
        const text = e.dataTransfer.getData("text/plain").trim();
        if (text) onAddElement("subject", text);
      }}
      style={{
        flex:       1,
        position:   "relative",
        overflow:   "hidden",
        cursor:     "crosshair",
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
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 - 30;
            return (
              <g key={i}>
                <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                  fill="none" stroke="rgba(139,92,246,0.12)"
                  strokeWidth={6} strokeLinecap="round" />
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

      {/* Empty state */}
      {elements.length === 0 && (
        <div aria-hidden style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 20, pointerEvents: "none",
          animation: "cd-fade-in 0.6s ease",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: "1px solid rgba(139,92,246,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            boxShadow: "0 0 32px rgba(139,92,246,0.08), inset 0 0 20px rgba(139,92,246,0.04)",
          }}>
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: "1px dashed rgba(139,92,246,0.1)",
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
            Drop reference or text to add to scene
          </span>
        </div>
      )}

      {/* Quick-add picker (left-click on empty) */}
      {quickAdd && !contextMenu && (
        <QuickAddPicker
          x={quickAdd.x} y={quickAdd.y}
          onSelect={(type) => { onAddElement(type, `New ${type}`); setQuickAdd(null); }}
          onClose={() => setQuickAdd(null)}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <CDContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddElement={(type) => {
            onAddElement(type, `New ${type}`);
            setContextMenu(null);
          }}
          onOpenDirectorControls={() => {
            onOpenDirectorControls?.();
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickAddPicker — small pill menu on left-click
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

// ─────────────────────────────────────────────────────────────────────────────
// CDContextMenu — premium right-click menu
// ─────────────────────────────────────────────────────────────────────────────

function CDContextMenu({ x, y, onClose, onAddElement, onOpenDirectorControls }: {
  x: number; y: number;
  onClose: () => void;
  onAddElement: (type: DirectionElementType) => void;
  onOpenDirectorControls: () => void;
}) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: 50 }} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position:       "absolute",
          left:           Math.min(x, 9999), // clamped dynamically by browser
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
        {/* Add element group */}
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

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />

        {/* Director Controls */}
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
  label:       string;
  dot?:        string;
  icon?:       React.ReactNode;
  iconColor?:  string;
  onClick:     () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:    hov ? "rgba(255,255,255,0.06)" : "transparent",
        border:        "none",
        borderRadius:  9,
        color:         hov ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
        fontSize:      12,
        fontFamily:    "var(--font-sans)",
        cursor:        "pointer",
        padding:       "8px 10px",
        textAlign:     "left",
        display:       "flex",
        alignItems:    "center",
        gap:           10,
        width:         "100%",
        transition:    "all 0.12s ease",
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
