"use client";

/**
 * TextNode — floating canvas annotation for Creative Director v2.
 *
 * Design intent:
 *   A lightweight glass chip for adding copy notes, scene annotations,
 *   or creative briefs directly on the canvas. Not a scene element (has
 *   no weight/role) — purely compositional.
 *
 * Interactions:
 *   - Drag header → reposition (scale-aware: raw px delta ÷ scale/100)
 *   - Single click → select (purple selection ring)
 *   - Double-click body / click "edit" icon in header → enter edit mode
 *   - Escape or click outside → exit edit, save text
 *   - Empty text on blur → no-op (keep node, allow re-edit)
 *   - Hover header → show × delete button
 *   - Font size cycling: 3 presets via header chip (S / M / L / XL / 2XL)
 *
 * Visual:
 *   - 26px drag header: "T" glyph + truncated text preview + size chip + × delete
 *   - Body: contenteditable div renders text in the chosen size + color
 *   - Selection ring: 1px rgba(139,92,246,0.7) border + purple glow
 *   - Glass background matching SceneNode / FrameNode palette
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { CanvasTextNode, TextNodeFontSize } from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const TEXT_NODE_HEADER_HEIGHT = 26;

/** Pixel width of a freshly placed text node. */
export const TEXT_NODE_DEFAULT_WIDTH = 220;

const FONT_SIZES: TextNodeFontSize[] = [11, 13, 16, 20, 26];
const FONT_SIZE_LABELS: Record<TextNodeFontSize, string> = {
  11: "XS",
  13: "S",
  16: "M",
  20: "L",
  26: "XL",
};

const DEFAULT_COLOR  = "rgba(255,255,255,0.88)";
const DEFAULT_TEXT   = "";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface TextNodeProps {
  node:          CanvasTextNode;
  isSelected:    boolean;
  isEditing:     boolean;
  scale:         number;           // canvas zoom 0–200 (percent)
  onSelect:      () => void;
  onStartEdit:   () => void;
  onEndEdit:     () => void;
  onTextChange:  (text: string) => void;
  onFontChange:  (size: TextNodeFontSize) => void;
  onMove:        (dx: number, dy: number) => void;
  onDelete:      () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function TextNode({
  node,
  isSelected,
  isEditing,
  scale,
  onSelect,
  onStartEdit,
  onEndEdit,
  onTextChange,
  onFontChange,
  onMove,
  onDelete,
}: TextNodeProps) {
  const [headerHovered, setHeaderHovered] = useState(false);
  const [localText,     setLocalText]     = useState(node.text || DEFAULT_TEXT);

  // Sync localText when node.text changes externally (e.g. Escape resets)
  useEffect(() => { setLocalText(node.text); }, [node.text]);

  const scaleRef  = useRef(scale);
  scaleRef.current = scale;

  const dragRef   = useRef<{ startX: number; startY: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // ── Header drag ────────────────────────────────────────────────────────────
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    onSelect();

    const onMove_ = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      dragRef.current = { startX: ev.clientX, startY: ev.clientY };
      const s = scaleRef.current / 100;
      onMove(dx / s, dy / s);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove_);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup",   onUp);
  }, [onMove, onSelect]);

  // ── Cycle font size ────────────────────────────────────────────────────────
  const handleCycleSize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const idx     = FONT_SIZES.indexOf(node.fontSize);
    const nextIdx = (idx + 1) % FONT_SIZES.length;
    onFontChange(FONT_SIZES[nextIdx]);
  }, [node.fontSize, onFontChange]);

  // ── Textarea change ────────────────────────────────────────────────────────
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value);
    onTextChange(e.target.value);
  }, [onTextChange]);

  // ── Textarea key handling ──────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onEndEdit();
    }
    // Enter without Shift = commit (don't insert newline)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEndEdit();
    }
    e.stopPropagation(); // don't bubble to canvas keyboard handlers
  }, [onEndEdit]);

  // ── Textarea blur ──────────────────────────────────────────────────────────
  const handleBlur = useCallback(() => {
    onEndEdit();
  }, [onEndEdit]);

  // ── Body double-click → start editing ─────────────────────────────────────
  const handleBodyDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEdit();
  }, [onStartEdit]);

  // ── Node click → select ────────────────────────────────────────────────────
  const handleNodeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  }, [onSelect]);

  // ─────────────────────────────────────────────────────────────────────────

  const selBorder   = isSelected
    ? "1px solid rgba(139,92,246,0.7)"
    : "1px solid rgba(255,255,255,0.09)";
  const selShadow   = isSelected
    ? "0 0 0 2px rgba(139,92,246,0.18), 0 8px 28px rgba(0,0,0,0.55)"
    : "0 4px 16px rgba(0,0,0,0.45)";

  const displayText = node.text || (isEditing ? "" : "Double-click to edit…");
  const isEmpty     = !node.text;

  return (
    <div
      data-scene-node="true"
      onClick={handleNodeClick}
      style={{
        position:        "absolute",
        top:             0,
        left:            0,
        transform:       `translate(${node.x}px, ${node.y}px)`,
        width:           TEXT_NODE_DEFAULT_WIDTH,
        background:      "rgba(8,7,14,0.90)",
        border:          selBorder,
        borderRadius:    10,
        boxShadow:       selShadow,
        backdropFilter:  "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        zIndex:          isSelected ? 22 : 18,
        userSelect:      "none",
        transition:      "box-shadow 0.18s ease, border-color 0.18s ease",
        animation:       "cd-spring 0.42s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      {/* ── Drag header ───────────────────────────────────────────────── */}
      <div
        onMouseDown={handleHeaderMouseDown}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          height:         TEXT_NODE_HEADER_HEIGHT,
          display:        "flex",
          alignItems:     "center",
          gap:            6,
          padding:        "0 8px 0 8px",
          cursor:         "grab",
          borderBottom:   "1px solid rgba(255,255,255,0.07)",
          background:     "rgba(255,255,255,0.03)",
          borderRadius:   "10px 10px 0 0",
          flexShrink:     0,
        }}
      >
        {/* "T" glyph */}
        <span style={{
          fontSize:      11,
          fontFamily:    "var(--font-display, 'Syne'), sans-serif",
          fontWeight:    700,
          color:         isSelected ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.38)",
          flexShrink:    0,
          lineHeight:    1,
          letterSpacing: "0.02em",
          transition:    "color 0.15s ease",
        }}>T</span>

        {/* Label + text preview */}
        <span style={{
          flex:          1,
          fontSize:      9,
          fontFamily:    "var(--font-sans, 'Familjen Grotesk'), sans-serif",
          color:         "rgba(255,255,255,0.22)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
          lineHeight:    1,
        }}>
          {node.text ? node.text.slice(0, 28) + (node.text.length > 28 ? "…" : "") : "Text Note"}
        </span>

        {/* Font size chip */}
        <button
          onClick={handleCycleSize}
          title="Cycle font size"
          style={{
            background:    "rgba(255,255,255,0.06)",
            border:        "1px solid rgba(255,255,255,0.09)",
            borderRadius:  4,
            color:         "rgba(255,255,255,0.42)",
            fontSize:      8,
            fontFamily:    "var(--font-sans, 'Familjen Grotesk'), sans-serif",
            fontWeight:    600,
            letterSpacing: "0.04em",
            cursor:        "pointer",
            padding:       "2px 5px",
            flexShrink:    0,
            lineHeight:    1,
            transition:    "all 0.12s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background  = "rgba(139,92,246,0.15)";
            e.currentTarget.style.color       = "rgba(139,92,246,0.9)";
            e.currentTarget.style.borderColor = "rgba(139,92,246,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background  = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color       = "rgba(255,255,255,0.42)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
          }}
        >
          {FONT_SIZE_LABELS[node.fontSize]}
        </button>

        {/* Edit icon — always present, shows on hover */}
        {!isEditing && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            title="Edit text"
            style={{
              background:    "transparent",
              border:        "none",
              color:         headerHovered ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.18)",
              cursor:        "pointer",
              padding:       "2px 3px",
              flexShrink:    0,
              display:       "flex",
              alignItems:    "center",
              justifyContent: "center",
              borderRadius:  4,
              transition:    "color 0.12s ease",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M6.5 1.5L8.5 3.5L3.5 8.5H1.5V6.5L6.5 1.5Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Delete × */}
        {(headerHovered || isSelected) && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Remove text note"
            style={{
              background:    "transparent",
              border:        "none",
              color:         "rgba(255,100,100,0.5)",
              fontSize:      12,
              cursor:        "pointer",
              padding:       "1px 2px",
              flexShrink:    0,
              lineHeight:    1,
              borderRadius:  4,
              transition:    "color 0.12s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,80,80,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,100,100,0.5)"; }}
          >
            ×
          </button>
        )}
      </div>

      {/* ── Body: edit mode = textarea, view mode = text ──────────────── */}
      <div
        onDoubleClick={handleBodyDoubleClick}
        style={{
          padding:  "10px 12px 12px",
          minHeight: 36,
          cursor:   isEditing ? "text" : "default",
        }}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={localText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Type your note…"
            rows={3}
            style={{
              width:           "100%",
              background:      "transparent",
              border:          "none",
              outline:         "none",
              resize:          "none",
              fontSize:        node.fontSize,
              fontFamily:      "var(--font-display, 'Syne'), sans-serif",
              color:           node.color || DEFAULT_COLOR,
              lineHeight:      1.45,
              letterSpacing:   "0.01em",
              caretColor:      "rgba(139,92,246,0.9)",
              padding:         0,
              fontWeight:      node.fontSize >= 20 ? 600 : 400,
            }}
          />
        ) : (
          <p style={{
            margin:        0,
            fontSize:      node.fontSize,
            fontFamily:    "var(--font-display, 'Syne'), sans-serif",
            fontWeight:    node.fontSize >= 20 ? 600 : 400,
            color:         isEmpty ? "rgba(255,255,255,0.18)" : (node.color || DEFAULT_COLOR),
            lineHeight:    1.45,
            letterSpacing: "0.01em",
            whiteSpace:    "pre-wrap",
            wordBreak:     "break-word",
            userSelect:    "none",
            fontStyle:     isEmpty ? "italic" : "normal",
          }}>
            {displayText}
          </p>
        )}
      </div>

      {/* ── Edit mode indicator ──────────────────────────────────────── */}
      {isEditing && (
        <div style={{
          padding:       "0 12px 8px",
          display:       "flex",
          alignItems:    "center",
          gap:           6,
        }}>
          <span style={{
            fontSize:      8,
            fontFamily:    "var(--font-sans, 'Familjen Grotesk'), sans-serif",
            color:         "rgba(139,92,246,0.55)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            Enter to save · Shift+Enter for new line
          </span>
        </div>
      )}
    </div>
  );
}
