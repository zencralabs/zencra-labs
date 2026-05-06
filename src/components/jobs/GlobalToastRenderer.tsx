"use client";

/**
 * src/components/jobs/GlobalToastRenderer.tsx
 *
 * Global job-lifecycle toast renderer.
 * Mounted ONCE in the root layout (src/app/layout.tsx).
 *
 * ─── Separation from local studio toasts ─────────────────────────────────────
 *
 *   Studio pages use useToast() → ToastStack → fixed bottom-center.
 *   This renderer uses the GLOBAL Zustand queue (useGlobalToastStore) and
 *   renders at fixed top-right so the two systems never overlap.
 *
 * ─── When toasts fire ────────────────────────────────────────────────────────
 *
 *   Toasts are pushed by AppBootstrap (on job status transitions) and by
 *   stale-job-detector.ts (on stale timeout). Never fired per-poll tick.
 *   See AppBootstrap.tsx for the full transition table.
 *
 * ─── Design rules ────────────────────────────────────────────────────────────
 *
 *   • Fixed top-right, 20px inset from viewport edges
 *   • z-index 99998 (below native browser UI, above all app layers)
 *   • Slides in from the right (translateX 16px → 0) with 220ms ease
 *   • Glass effect: backdrop-filter blur(12px) + rgba dark background
 *   • Max 340px wide, min 240px (matches studio toast sizing)
 *   • Uses Familjen Grotesk for body text (locked typography system)
 *   • Each toast auto-dismisses via global-toast-store timeout
 *   • Dismiss button (×) for manual early close
 */

import { useEffect, useState }         from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useGlobalToastStore }         from "@/lib/jobs/global-toast-store";
import type { ToastItem, ToastVariant } from "@/components/ui/Toast";

// ─────────────────────────────────────────────────────────────────────────────
// Variant config
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  ToastVariant,
  { bg: string; border: string; color: string; Icon: React.ElementType }
> = {
  success: {
    bg:     "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.35)",
    color:  "#34D399",
    Icon:   CheckCircle2,
  },
  error: {
    bg:     "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    color:  "#FCA5A5",
    Icon:   XCircle,
  },
  info: {
    bg:     "rgba(37,99,235,0.12)",
    border: "rgba(37,99,235,0.35)",
    color:  "#60A5FA",
    Icon:   Info,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Individual toast item
// ─────────────────────────────────────────────────────────────────────────────

function GlobalToastItem({
  item,
  onDismiss,
}: {
  item:      ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible]          = useState(false);
  const { bg, border, color, Icon }    = VARIANT_CONFIG[item.variant];

  // Slide-in animation — delay one frame so the initial opacity:0 is painted
  // before the transition fires.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display:             "flex",
        alignItems:          "center",
        gap:                 10,
        padding:             "11px 14px",
        borderRadius:        12,
        background:          bg,
        border:              `1px solid ${border}`,
        backdropFilter:      "blur(12px)",
        WebkitBackdropFilter:"blur(12px)",
        boxShadow:           "0 8px 32px rgba(0,0,0,0.45)",
        minWidth:            240,
        maxWidth:            340,
        transition:          "opacity 0.22s ease, transform 0.22s ease",
        opacity:             visible ? 1 : 0,
        // Slides in from the right edge
        transform:           visible ? "translateX(0)" : "translateX(16px)",
        pointerEvents:       "auto",
        willChange:          "opacity, transform",
      }}
    >
      <Icon size={15} style={{ color, flexShrink: 0 }} />

      <span
        style={{
          flex:        1,
          fontSize:    13,
          fontWeight:  500,
          color:       "#F1F5F9",
          lineHeight:  1.4,
          fontFamily:  "'Familjen Grotesk', sans-serif",
        }}
      >
        {item.message}
      </span>

      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
        style={{
          background:    "none",
          border:        "none",
          padding:       3,
          cursor:        "pointer",
          color:         "#64748B",
          flexShrink:    0,
          display:       "flex",
          alignItems:    "center",
          borderRadius:  4,
          transition:    "color 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────────────────

export function GlobalToastRenderer() {
  const toasts  = useGlobalToastStore((s) => s.toasts);
  const dismiss = useGlobalToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      style={{
        position:      "fixed",
        top:           20,
        right:         20,
        zIndex:        99998,
        display:       "flex",
        flexDirection: "column",
        gap:           8,
        pointerEvents: "none",  // container transparent; items restore pointerEvents
        alignItems:    "flex-end",
      }}
    >
      {toasts.map((t) => (
        <GlobalToastItem key={t.id} item={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
