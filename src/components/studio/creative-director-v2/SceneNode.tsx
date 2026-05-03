"use client";

/**
 * SceneNode — premium floating glass card in the SceneCanvas.
 *
 * Phase B.2.5 — Node Weight + Scene Priority:
 *
 * Weight slider:
 *   localWeight (0–100) drives the slider immediately. A 300ms debounced
 *   callback fires updateElement({ weight: localWeight / 100 }) to the store.
 *   The slider uses .cd-weight-slider CSS (injected by CDv2Shell) + a
 *   gradient background that shows fill level + --role-clr CSS variable for
 *   the thumb color.
 *   onMouseDown is stopPropagated so scrubbing doesn't trigger node drag.
 *
 * Weight → Glow:
 *   Glass card boxShadow scales with weight:
 *     glowOpacity = glowFloor + weight × 0.42   (range 0.08–0.50)
 *     glowRadius  = 6 + weight × 22             (range 6–28px)
 *   glowFloor is 0.28 for priority subjects, 0.08 otherwise.
 *
 * Weight → Scale:
 *   Outer wrapper: transform: scale(1 + weight × 0.05) — max +5% at full weight.
 *   Transition: 0.35s ease so the scale change eases as the slider moves.
 *   cd-node-glow animation targets box-shadow on the outer div; the inner
 *   card carries the weight-based glow — no conflict.
 *
 * Subject priority state (identity_lock active):
 *   When mode === "locked" AND element.type === "subject":
 *   - Border becomes amber (rgba(251,191,36,...)) instead of role blue
 *   - Glow floor raised to 0.28
 *   - A 🔒 lock badge appears in the top row
 *
 * Connection lines:
 *   B.2.4 already wires line opacity/width to element.weight via SceneCanvas.
 *   No changes here — they update automatically as weight changes in the store.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useDirectionStore,
  selectMode,
}                                                    from "@/lib/creative-director/store";
import type { DirectionElementRow }                  from "@/lib/creative-director/types";

// ─────────────────────────────────────────────────────────────────────────────
// Geometry constants — exported so SceneCanvas can compute handle positions
// without reading DOM refs or coupling to internal layout.
// ─────────────────────────────────────────────────────────────────────────────
/** Full pixel width of the glass card (matches `width: 196` in the card style). */
export const SCENE_NODE_CARD_WIDTH = 196;

/**
 * Vertical offset from the node's canvas-space `position.y` to the center of
 * the output handle dot on the right edge.  The dot sits near the card top
 * (top-row area ≈ 22px from the top of the card).
 */
export const SCENE_NODE_HANDLE_Y_OFFSET = 22;

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

// Amber for locked/priority state
const PRIORITY_COLOR = "rgba(251,191,36,1)";

// ─────────────────────────────────────────────────────────────────────────────

interface SceneNodeProps {
  element:              DirectionElementRow;
  x:                    number;
  y:                    number;
  onMove:               (id: string, dx: number, dy: number) => void;
  onMoveEnd?:           (id: string) => void;
  onboardingHighlight?: boolean;
  /** Phase 2: spawn index (0, 1, 2). Triggers a fade-in animation with
   *  animation-delay = index × 120ms so nodes appear staggered. */
  autoSpawnIndex?:      number;
}

export function SceneNode({ element, x, y, onMove, onMoveEnd, onboardingHighlight, autoSpawnIndex }: SceneNodeProps) {
  const {
    removeElement,
    updateElement,
    directionId,
    directionCreated,
    uploadedAssets,
  } = useDirectionStore();
  const mode = useDirectionStore(selectMode);

  // Resolve the thumbnail URL for this specific element.
  // Priority:
  //   1. element.asset_url — set directly on the element when dragged from AssetTray
  //      (per-element, no type collision even with multiple same-role nodes)
  //   2. Role-based lookup — legacy: find the first asset assigned to this role
  //      (keeps backwards compat for nodes created before asset_url was wired)
  const thumbnailUrl: string | undefined =
    element.asset_url ??
    uploadedAssets.find((a) => a.assignedRole === element.type)?.url;
  const thumbnailName: string | undefined =
    uploadedAssets.find((a) => a.url === thumbnailUrl)?.name ?? element.label;

  const [hovered,     setHovered]    = useState(false);
  const [editing,     setEditing]    = useState(false);
  const [editLabel,   setEditLabel]  = useState(element.label);
  const [isDragging,  setIsDragging] = useState(false);
  // Dynamic aspect ratio — detected from the image's natural dimensions on load.
  // Buckets: landscape (>1.3) → 16/9, portrait (<0.8) → 9/16, square → 1/1.
  const [imgAspect,   setImgAspect]  = useState<string>("16/9"); // default to landscape until loaded
  const [localWeight, setLocalWeight] = useState(
    () => Math.round((element.weight ?? 0.5) * 100)
  );
  const dragStart   = useRef<{ mx: number; my: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync slider if weight changes externally (e.g. initial load or remote patch)
  useEffect(() => {
    setLocalWeight(Math.round((element.weight ?? 0.5) * 100));
  }, [element.weight]);

  // ── Derived values ────────────────────────────────────────────────────────
  const weight     = element.weight ?? 0.5;
  const roleColor  = ROLE_COLORS[element.type]  ?? "rgba(255,255,255,0.6)";
  const roleSym    = ROLE_SYMBOLS[element.type] ?? "●";
  const isPriority = element.type === "subject" && mode === "locked";

  // Glow math
  const glowFloor   = isPriority ? 0.28 : 0.08;
  const glowOpacity = Math.min(0.70, glowFloor + weight * 0.42);
  const glowRadius  = Math.round(6 + weight * 22);

  // Border color: amber for priority subject, else role color
  const borderOpacity = hovered ? "0.55" : isPriority ? "0.42" : "0.22";
  const borderBase    = isPriority ? PRIORITY_COLOR : roleColor;
  const borderColor   = borderBase.replace("1)", `${borderOpacity})`);

  // Card box-shadow: weight-based glow (no hover override — hover is on outer div via cd-node-glow)
  const cardBoxShadow = [
    `0 4px 20px rgba(0,0,0,0.55)`,
    `inset 0 1px 0 rgba(255,255,255,0.05)`,
    `0 0 ${glowRadius}px ${roleColor.replace("1)", `${glowOpacity.toFixed(2)})`)}`,
    isPriority
      ? `0 0 ${Math.round(glowRadius * 0.6)}px ${PRIORITY_COLOR.replace("1)", "0.25)")}`
      : "",
    // Drag glow: layered on top of role glow only while dragging; role glow returns immediately on release
    isDragging ? "0 0 16px rgba(139,92,246,0.4)" : "",
  ].filter(Boolean).join(", ");

  // Slider track gradient (filled left side = localWeight %)
  const trackBg = [
    `linear-gradient(to right,`,
    `  ${roleColor.replace("1)", "0.75)")} ${localWeight}%,`,
    `  rgba(255,255,255,0.09) ${localWeight}%`,
    `)`,
  ].join(" ");

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
      window.removeEventListener("mouseup",   onUp);
      onMoveEnd?.(element.id);
    };
    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup",   onUp);
  }, [editing, element.id, onMove, onMoveEnd]);

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
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ label: trimmed }),
        });
      } catch { /* silent */ }
    }
  }, [editLabel, element.id, element.label, updateElement, directionId, directionCreated]);

  // ── Weight slider change (debounced store update) ─────────────────────────
  const handleWeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setLocalWeight(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateElement(element.id, { weight: v / 100 });
    }, 300);
  }, [element.id, updateElement]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {onboardingHighlight && (
        <style>{`
          @keyframes cd-ob-node-pulse {
            0%, 100% { box-shadow: 0 0 18px rgba(80,120,255,0.30); }
            50%       { box-shadow: 0 0 36px rgba(80,120,255,0.60), 0 0 60px rgba(80,120,255,0.20); }
          }
        `}</style>
      )}
      {autoSpawnIndex !== undefined && (
        <style>{`
          @keyframes cd-ob-node-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      )}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseDown={handleMouseDown}
        style={{
          position:   "absolute",
          left:       x,
          top:        y,
          cursor:     editing ? "default" : "grab",
          userSelect: "none",
          zIndex:     hovered ? 20 : 10,
          // Weight → scale: 1.00 at 0%, 1.05 at 100% — subtle cinematic mass
          transform:  `scale(${(1 + weight * 0.05).toFixed(4)})`,
          transition: "transform 0.35s ease",
          // Animation priority: onboarding pulse > Phase 2 spawn > hover glow
          animation:  onboardingHighlight
            ? "cd-ob-node-pulse 1.8s ease-in-out infinite"
            : autoSpawnIndex !== undefined
              ? `cd-ob-node-in 0.38s ease-out ${autoSpawnIndex * 120}ms both`
              : hovered ? "cd-node-glow 2s ease-in-out infinite" : "none",
        }}
      >
      {/* ── Glass card ─────────────────────────────────────────────────── */}
      <div
        style={{
          position:           "relative",
          background:         isPriority
            ? "rgba(12,9,16,0.92)"
            : "rgba(10,8,18,0.88)",
          border:             `1px solid ${borderColor}`,
          borderRadius:       12,
          padding:            "9px 12px 10px 11px",
          backdropFilter:     "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow:          cardBoxShadow,
          transition:         "box-shadow 0.3s ease, border-color 0.25s ease",
          display:            "flex",
          flexDirection:      "column",
          gap:                7,
          width:              196,
        }}
      >
        {/* ── Thumbnail strip — shows when an asset URL is linked to this element ── */}
        {thumbnailUrl && (
          <div style={{
            margin:      "-9px -12px 0 -11px",   // bleed to card edges
            borderRadius: "11px 11px 0 0",        // match card top corners
            overflow:     "hidden",
            aspectRatio:  imgAspect,              // dynamic: 16/9, 9/16, or 1/1
            position:     "relative",
            flexShrink:   0,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt={thumbnailName}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                const ratio = img.naturalWidth / img.naturalHeight;
                if (ratio > 1.3)      setImgAspect("16/9");
                else if (ratio < 0.8) setImgAspect("9/16");
                else                  setImgAspect("1/1");
              }}
              style={{
                width:         "100%",
                height:        "100%",
                objectFit:     "cover",
                display:       "block",
                userSelect:    "none",
                pointerEvents: "none",
              }}
            />
            {/* role-colored gradient overlay at bottom so label stays readable */}
            <div style={{
              position:   "absolute",
              inset:      0,
              background: `linear-gradient(to bottom, transparent 30%, ${roleColor.replace("1)", "0.55)")} 100%)`,
              pointerEvents: "none",
            }} />
            {/* "Ref" micro-label bottom-left */}
            <span style={{
              position:      "absolute",
              bottom:        4,
              left:          7,
              fontSize:      8,
              fontFamily:    "var(--font-sans)",
              fontWeight:    600,
              color:         "rgba(255,255,255,0.75)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              pointerEvents: "none",
            }}>
              Ref
            </span>
          </div>
        )}

        {/* ── Top row ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Role glow dot */}
          <div style={{
            width:        9,
            height:       9,
            borderRadius: "50%",
            background:   roleColor,
            boxShadow:    `0 0 ${hovered ? "10px" : "6px"} ${roleColor.replace("1)", hovered ? "0.75)" : "0.5)")}`,
            flexShrink:   0,
            transition:   "box-shadow 0.25s ease",
          }} />

          {/* Role symbol */}
          <span style={{
            fontSize:   12,
            color:      roleColor.replace("1)", "0.75)"),
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
              onMouseDown={(e) => e.stopPropagation()}
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

          {/* Priority lock badge */}
          {isPriority && (
            <div
              title="Identity locked — subject has scene priority"
              style={{
                fontSize:   10,
                color:      PRIORITY_COLOR.replace("1)", "0.9)"),
                flexShrink: 0,
                lineHeight: 1,
                filter:     `drop-shadow(0 0 4px ${PRIORITY_COLOR.replace("1)", "0.6)")})`,
              }}
            >
              🔒
            </div>
          )}

          {/* Remove button — always visible, dims when not hovered */}
          {!editing && (
            <button
              onClick={(e) => { e.stopPropagation(); void handleRemove(); }}
              onMouseDown={(e) => e.stopPropagation()}
              title="Remove node"
              style={{
                background:   hovered ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.04)",
                border:       `1px solid ${hovered ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.1)"}`,
                borderRadius: 5,
                color:        hovered ? "rgba(239,68,68,0.8)" : "rgba(239,68,68,0.3)",
                cursor:       "pointer",
                padding:      "2px 5px",
                fontSize:     10,
                flexShrink:   0,
                lineHeight:   1,
                transition:   "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.22)";
                e.currentTarget.style.color      = "rgba(239,68,68,1)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background  = hovered ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.04)";
                e.currentTarget.style.color       = hovered ? "rgba(239,68,68,0.8)" : "rgba(239,68,68,0.3)";
                e.currentTarget.style.borderColor = hovered ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.1)";
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Weight slider row ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {/* Role type micro-label */}
          <span style={{
            fontSize:      8,
            fontFamily:    "var(--font-sans)",
            color:         roleColor.replace("1)", "0.4)"),
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            flexShrink:    0,
            width:         20,
            textAlign:     "right",
            lineHeight:    1,
          }}>
            {element.type.slice(0, 3)}
          </span>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={localWeight}
            onChange={handleWeightChange}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={() => setIsDragging(true)}
            onPointerUp={() => setIsDragging(false)}
            onPointerLeave={() => setIsDragging(false)}
            className="cd-weight-slider"
            style={{
              flex:       1,
              background: trackBg,
              cursor:     isDragging ? "grabbing" : undefined,
              // CSS custom property for the thumb color (used by ::webkit-slider-thumb in CDv2Shell CSS)
              "--role-clr": roleColor,
            } as React.CSSProperties}
            title={`Weight: ${localWeight}%`}
          />

          {/* Weight value label */}
          <span style={{
            fontSize:      9,
            fontFamily:    "var(--font-sans)",
            color:         localWeight > 60
              ? roleColor.replace("1)", "0.75)")
              : "rgba(255,255,255,0.3)",
            flexShrink:    0,
            width:         26,
            textAlign:     "right",
            letterSpacing: "0.02em",
            transition:    "color 0.2s ease",
            lineHeight:    1,
          }}>
            {localWeight}%
          </span>
        </div>
      </div>

      {/* ── Role label below card ─────────────────────────────────────── */}
      <div style={{
        fontSize:      9,
        fontFamily:    "var(--font-sans)",
        color:         isPriority
          ? PRIORITY_COLOR.replace("1)", "0.55)")
          : roleColor.replace("1)", "0.4)"),
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        textAlign:     "center",
        marginTop:     4,
      }}>
        {isPriority ? "⬆ Priority" : element.type}
      </div>
    </div>
    </>
  );
}
