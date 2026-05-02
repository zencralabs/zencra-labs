"use client";

/**
 * SceneNode — floating element card in the SceneCanvas.
 *
 * Each node represents a direction_element (subject/world/object/atmosphere).
 * Role-colored glow. Draggable via CSS position absolute + mouse events.
 * Remove via DELETE /api/creative-director/elements/[id].
 */

import { useState, useCallback, useRef } from "react";
import { useDirectionStore }              from "@/lib/creative-director/store";
import type { DirectionElementRow }       from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  subject:    "rgba(59,130,246,1)",
  world:      "rgba(34,197,94,1)",
  atmosphere: "rgba(139,92,246,1)",
  object:     "rgba(249,115,22,1)",
};

const ROLE_ICONS: Record<string, string> = {
  subject:    "👤",
  world:      "🌍",
  atmosphere: "🌫",
  object:     "📦",
};

// ─────────────────────────────────────────────────────────────────────────────

interface SceneNodeProps {
  element: DirectionElementRow;
  x:       number;  // canvas-relative left px
  y:       number;  // canvas-relative top px
  onMove:  (id: string, dx: number, dy: number) => void;
}

export function SceneNode({ element, x, y, onMove }: SceneNodeProps) {
  const { removeElement, updateElement, directionId, directionCreated } = useDirectionStore();
  const [hovered, setHovered]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [editLabel, setEditLabel] = useState(element.label);
  const dragStart                 = useRef<{ mx: number; my: number } | null>(null);

  const roleColor = ROLE_COLORS[element.type] ?? "rgba(255,255,255,0.6)";
  const roleGlow  = roleColor.replace("1)", "0.3)");

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (editing) return;
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY };

    const onMove_ = (me: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = me.clientX - dragStart.current.mx;
      const dy = me.clientY - dragStart.current.my;
      dragStart.current = { mx: me.clientX, my: me.clientY };
      onMove(element.id, dx, dy);
    };
    const onUp = () => {
      dragStart.current = null;
      window.removeEventListener("mousemove", onMove_);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup", onUp);
  }, [editing, element.id, onMove]);

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = useCallback(async () => {
    removeElement(element.id);
    if (directionId && directionCreated) {
      try {
        await fetch(`/api/creative-director/elements/${element.id}`, { method: "DELETE" });
      } catch { /* silent */ }
    }
  }, [element.id, removeElement, directionId, directionCreated]);

  // ── Edit label ────────────────────────────────────────────────────────────
  const commitEdit = useCallback(async () => {
    const trimmed = editLabel.trim();
    if (!trimmed) {
      setEditLabel(element.label);
      setEditing(false);
      return;
    }
    updateElement(element.id, { label: trimmed });
    setEditing(false);
    // Sync to DB (fire-and-forget)
    if (directionId && directionCreated) {
      try {
        await fetch(`/api/creative-director/elements/${element.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: trimmed }),
        });
      } catch { /* silent */ }
    }
  }, [editLabel, element.id, element.label, updateElement, directionId, directionCreated]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}
      style={{
        position:   "absolute",
        left:       x,
        top:        y,
        cursor:     editing ? "text" : "grab",
        userSelect: "none",
        zIndex:     hovered ? 20 : 10,
      }}
    >
      <div
        style={{
          background:   "rgba(12,12,14,0.92)",
          border:       `1px solid ${roleColor.replace("1)", "0.35)")}`,
          borderRadius: 10,
          padding:      "8px 12px 8px 10px",
          backdropFilter: "blur(12px)",
          boxShadow:    hovered
            ? `0 0 0 1px ${roleColor.replace("1)", "0.4)")}, 0 4px 24px ${roleGlow}`
            : `0 2px 12px rgba(0,0,0,0.5)`,
          transition:   "box-shadow 0.2s",
          display:      "flex",
          alignItems:   "center",
          gap:          8,
          minWidth:     120,
          maxWidth:     200,
        }}
      >
        {/* Role dot */}
        <div
          style={{
            width:        8,
            height:       8,
            borderRadius: "50%",
            background:   roleColor,
            boxShadow:    `0 0 6px ${roleColor.replace("1)", "0.5)")}`,
            flexShrink:   0,
          }}
        />

        {/* Role icon */}
        <span style={{ fontSize: 12, flexShrink: 0 }}>
          {ROLE_ICONS[element.type] ?? "●"}
        </span>

        {/* Label (editable on double-click) */}
        {editing ? (
          <input
            autoFocus
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={() => void commitEdit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitEdit();
              if (e.key === "Escape") { setEditLabel(element.label); setEditing(false); }
            }}
            style={{
              background:   "transparent",
              border:       "none",
              outline:      "none",
              color:        "rgba(255,255,255,0.9)",
              fontSize:     12,
              fontFamily:   "var(--font-sans)",
              flex:         1,
              minWidth:     60,
            }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            style={{
              fontSize:     12,
              fontFamily:   "var(--font-sans)",
              color:        "rgba(255,255,255,0.85)",
              flex:         1,
              overflow:     "hidden",
              textOverflow: "ellipsis",
              whiteSpace:   "nowrap",
            }}
          >
            {element.label}
          </span>
        )}

        {/* Weight indicator */}
        <div
          title={`Weight: ${Math.round(element.weight * 100)}%`}
          style={{
            width:        3,
            height:       18,
            borderRadius: 2,
            background:   `linear-gradient(to top, ${roleColor.replace("1)", "0.15)")}, ${roleColor.replace("1)", "0.7)")})`,
            flexShrink:   0,
          }}
        />

        {/* Remove button (shown on hover) */}
        {hovered && !editing && (
          <button
            onClick={(e) => { e.stopPropagation(); void handleRemove(); }}
            style={{
              background:   "rgba(239,68,68,0.1)",
              border:       "1px solid rgba(239,68,68,0.2)",
              borderRadius: 4,
              color:        "rgba(239,68,68,0.7)",
              cursor:       "pointer",
              padding:      "1px 5px",
              fontSize:     10,
              flexShrink:   0,
              lineHeight:   1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Type label below node */}
      <div
        style={{
          fontSize:      9,
          fontFamily:    "var(--font-sans)",
          color:         roleColor.replace("1)", "0.5)"),
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          textAlign:     "center",
          marginTop:     3,
        }}
      >
        {element.type}
      </div>
    </div>
  );
}
