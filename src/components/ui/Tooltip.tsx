/**
 * Tooltip — Zencra global premium tooltip component
 *
 * Behavior:
 *  - Shows immediately on hover (zero delay)
 *  - Anchored above the trigger element (falls back below if no space)
 *  - NEVER follows mouse — position calculated once on mouseenter from getBoundingClientRect()
 *  - Slide up + fade in on enter; slide down + fade out on exit
 *
 * Usage:
 *   <Tooltip content="This is a tooltip">
 *     <button>Hover me</button>
 *   </Tooltip>
 */

"use client";

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// ── Animation state machine ────────────────────────────────────────────────────
type VisibilityState = "hidden" | "entering" | "visible" | "exiting";

// ── Style constants ────────────────────────────────────────────────────────────
const TOOLTIP_STYLE: React.CSSProperties = {
  position:     "fixed",
  zIndex:       99999,
  pointerEvents: "none",
  background:   "#2a2a2a",
  color:        "rgba(255,255,255,0.92)",
  fontSize:     13,
  fontWeight:   500,
  lineHeight:   1.4,
  padding:      "8px 10px",
  borderRadius: 10,
  boxShadow:    "0 4px 20px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3)",
  whiteSpace:   "nowrap",
  maxWidth:     260,
  userSelect:   "none",
  // Motion transitions
  transition:   "opacity 140ms ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
  transformOrigin: "bottom center",
};

// Visibility → CSS state map
const VISIBILITY_STYLES: Record<VisibilityState, React.CSSProperties> = {
  hidden: {
    opacity:   0,
    transform: "translateY(6px) scale(0.98)",
    visibility: "hidden",
  },
  entering: {
    opacity:   0,
    transform: "translateY(6px) scale(0.98)",
    visibility: "visible",
  },
  visible: {
    opacity:   1,
    transform: "translateY(0px) scale(1)",
    visibility: "visible",
  },
  exiting: {
    opacity:   0,
    transform: "translateY(6px) scale(0.98)",
    visibility: "visible",
  },
};

// ── Tooltip portal ─────────────────────────────────────────────────────────────
interface TooltipPortalProps {
  content: string;
  triggerRect: DOMRect;
  visibilityState: VisibilityState;
}

function TooltipPortal({ content, triggerRect, visibilityState }: TooltipPortalProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  // Calculate position after mount (so we know the tooltip dimensions)
  useEffect(() => {
    if (!tooltipRef.current || visibilityState === "hidden") return;

    const el = tooltipRef.current;
    const { width: tipW, height: tipH } = el.getBoundingClientRect();

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const gap = 8; // px gap between trigger and tooltip

    // Prefer above
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    let left = triggerCenterX - tipW / 2;
    // Clamp horizontally within viewport with 8px margin
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

    if (spaceAbove >= tipH + gap) {
      // Place above
      setCoords({
        left,
        bottom: window.innerHeight - triggerRect.top + gap,
      });
    } else if (spaceBelow >= tipH + gap) {
      // Fallback: place below
      setCoords({
        left,
        top: triggerRect.bottom + gap,
      });
    } else {
      // Last resort: above anyway
      setCoords({
        left,
        bottom: window.innerHeight - triggerRect.top + gap,
      });
    }
  }, [triggerRect, visibilityState]);

  const posStyle: React.CSSProperties = coords
    ? {
        left:   coords.left,
        top:    coords.top,
        bottom: coords.bottom,
        transformOrigin: coords.top !== undefined ? "top center" : "bottom center",
      }
    : { left: -9999, top: -9999 };

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        ...TOOLTIP_STYLE,
        ...posStyle,
        ...VISIBILITY_STYLES[visibilityState],
      }}
    >
      {content}
    </div>,
    document.body
  );
}

// ── Main Tooltip component ─────────────────────────────────────────────────────
interface TooltipProps {
  content: string;
  children: ReactNode;
  /** Disabled tooltips — useful when content is empty or undefined */
  disabled?: boolean;
  /** Override styles on the wrapper span — useful for flex: 1 or other layout needs */
  wrapperStyle?: React.CSSProperties;
}

export default function Tooltip({ content, children, disabled, wrapperStyle }: TooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [visibilityState, setVisibilityState] = useState<VisibilityState>("hidden");
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (disabled || !content) return;
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    // Capture position once — never follows mouse
    if (wrapperRef.current) {
      setTriggerRect(wrapperRef.current.getBoundingClientRect());
    }
    setVisibilityState("entering");
    // Immediately transition to visible (next frame)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setVisibilityState("visible");
      });
    });
  }, [content, disabled]);

  const hide = useCallback(() => {
    setVisibilityState("exiting");
    exitTimerRef.current = setTimeout(() => {
      setVisibilityState("hidden");
      setTriggerRect(null);
    }, 160);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const isPortalVisible = visibilityState !== "hidden";

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      style={{ display: "inline-flex", position: "relative", ...wrapperStyle }}
    >
      {children}
      {isPortalVisible && triggerRect && (
        <TooltipPortal
          content={content}
          triggerRect={triggerRect}
          visibilityState={visibilityState}
        />
      )}
    </span>
  );
}
