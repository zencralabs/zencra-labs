"use client";

/**
 * SceneNode — premium floating glass card in the SceneCanvas.
 *
 * Glass morphism: backdrop-filter blur(20px), semi-transparent dark fill.
 * Role glow: border + box-shadow match role color. Pulses on hover via
 * cd-node-glow keyframe (injected by CDv2Shell).
 * Weight bar: vertical gradient bar with colored glow.
 * Drag: standard mouse event pattern.
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

const ROLE_SYMBOLS: Record<string, string> = {
  subject:    "◉",
  world:      "◎",
  atmosphere: "◈",
  object:     "◆",
};

// ─────────────────────────────────────────────────────────────────────────────

interface SceneNodeProps {
  element: DirectionElementRow;
  x:       number;
  y:       number;
  onMove:  (id: string, dx: number, dy: number) => void;
}

export function SceneNode({ element, x, y, onMove }: SceneNodeProps) {
  const { removeElement, updateElement, directionId, directionCreated } = useDirectionStore();
  const [hovered, setHovered]     = useState(false);
  const [editing, setEditing]     = useState(false);
  const [editLabel, setEditLabel] = useState(element.label);
  const dragStart                  = useRef<{ mx: number; my: number } | null>(null);

  const roleColor = ROLE_COLORS[element.type] ?? "rgba(255,255,255,0.6)";
  const roleSym   = ROLE_SYMBOLS[element.type] ?? "●";

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
    if (!trimmed) { setEditLabel(element.label); setEditing(false); return; }
    updateElement(element.id, { label: trimmed });
    setEditing(false);
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

  // Weight: 0–1 → bar height
  const weightPct = Math.max(0.15, element.weight ?? 0.5);

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
        // Hover glow animation (cd-node-glow keyframe from CDv2Shell)
        animation:  hovered ? "cd-node-glow 2s ease-in-out infinite" : "none",
      }}
    >
      {/* Glass card */}
      <div
        style={{
          background:     "rgba(10,8,18,0.88)",
          border:         `1px solid ${hovered ? roleColor.replace("1)", "0.55)") : roleColor.replace("1)", "0.22)")}`,
          borderRadius:   12,
          padding:        "10px 14px 10px 12px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow:      hovered
            ? `0 0 0 1px ${roleColor.replace("1)", "0.3)")}, 0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${roleColor.replace("1)", "0.15)")}`
            : `0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`,
          transition:     "box-shadow 0.25s ease, border-color 0.25s ease",
          display:        "flex",
          alignItems:     "center",
          gap:            9,
          minWidth:       150,
          maxWidth:       220,
        }}
      >
        {/* Role glow dot */}
        <div style={{
          width:        10,
          height:       10,
          borderRadius: "50%",
          background:   roleColor,
          boxShadow:    `0 0 ${hovered ? "10px" : "5px"} ${roleColor.replace("1)", hovered ? "0.7)" : "0.4)")}`,
          flexShrink:   0,
          transition:   "box-shadow 0.25s ease",
        }} />

        {/* Role symbol */}
        <span style={{
          fontSize:   13,
          color:      roleColor.replace("1)", "0.8)"),
          flexShrink: 0,
          lineHeight: 1,
        }}>
          {roleSym}
        </span>

        {/* Label / inline edit */}
        {editing ? (
          <input
            autoFocus
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={() => void commitEdit()}
            onKeyDown={(e) => {
              if (e.key === "Enter")  void commitEdit();
              if (e.key === "Escape") { setEditLabel(element.label); setEditing(false); }
            }}
            style={{
              background: "transparent",
              border:     "none",
              outline:    "none",
              color:      "rgba(255,255,255,0.95)",
              fontSize:   12,
              fontFamily: "var(--font-sans)",
              flex:       1,
              minWidth:   60,
            }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            style={{
              fontSize:     12,
              fontFamily:   "var(--font-sans)",
              color:        "rgba(255,255,255,0.88)",
              flex:         1,
              overflow:     "hidden",
              textOverflow: "ellipsis",
              whiteSpace:   "nowrap",
            }}
          >
            {element.label}
          </span>
        )}

        {/* Weight visualization bar */}
        <div
          title={`Weight: ${Math.round(weightPct * 100)}%`}
          style={{
            width:        3,
            height:       24,
            borderRadius: 2,
            background:   `linear-gradient(to top,
              ${roleColor.replace("1)", "0.08)")},
              ${roleColor.replace("1)", "0.85)")})`,
            boxShadow:    `0 0 6px ${roleColor.replace("1)", "0.35)")}`,
            flexShrink:   0,
            opacity:      0.6 + weightPct * 0.4,
          }}
        />

        {/* Remove button */}
        {hovered && !editing && (
          <button
            onClick={(e) => { e.stopPropagation(); void handleRemove(); }}
            style={{
              background:   "rgba(239,68,68,0.08)",
              border:       "1px solid rgba(239,68,68,0.2)",
              borderRadius: 5,
              color:        "rgba(239,68,68,0.65)",
              cursor:       "pointer",
              padding:      "2px 6px",
              fontSize:     10,
              flexShrink:   0,
              lineHeight:   1,
              transition:   "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.18)";
              e.currentTarget.style.color = "rgba(239,68,68,1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.color = "rgba(239,68,68,0.65)";
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Role label below */}
      <div style={{
        fontSize:      9,
        fontFamily:    "var(--font-sans)",
        color:         roleColor.replace("1)", "0.45)"),
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        textAlign:     "center",
        marginTop:     4,
      }}>
        {element.type}
      </div>
    </div>
  );
}
