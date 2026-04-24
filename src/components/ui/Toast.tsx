"use client";

/**
 * Lightweight toast notification system.
 * Usage:
 *   const { toasts, toast } = useToast();
 *   toast.success("Saved!"); // or toast.error(...) / toast.info(...)
 *   <ToastStack toasts={toasts} onDismiss={dismissFn} />
 *
 * No external dependencies. Auto-dismisses after `duration` ms (default 3000).
 */

import { useState, useCallback, useEffect } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const toast = {
    success: (msg: string, ms?: number) => show(msg, "success", ms),
    error:   (msg: string, ms?: number) => show(msg, "error",   ms),
    info:    (msg: string, ms?: number) => show(msg, "info",    ms),
  };

  return { toasts, toast, dismiss };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual toast item
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; color: string; Icon: React.ElementType }> = {
  success: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", color: "#34D399", Icon: CheckCircle2 },
  error:   { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  color: "#FCA5A5", Icon: XCircle      },
  info:    { bg: "rgba(37,99,235,0.12)",  border: "rgba(37,99,235,0.35)",  color: "#60A5FA", Icon: Info          },
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const { bg, border, color, Icon } = VARIANT_STYLES[item.variant];

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 14px",
        borderRadius: 12,
        background: bg,
        border: `1px solid ${border}`,
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        minWidth: 240, maxWidth: 360,
        transition: "opacity 0.2s, transform 0.2s",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        pointerEvents: "auto",
      }}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#F1F5F9", lineHeight: 1.4 }}>
        {item.message}
      </span>
      <button
        onClick={() => onDismiss(item.id)}
        style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: "#64748B", flexShrink: 0 }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stack container — fixed bottom-center
// ─────────────────────────────────────────────────────────────────────────────

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
        alignItems: "center",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
