/**
 * src/lib/jobs/global-toast-store.ts
 *
 * Global toast singleton backed by Zustand.
 *
 * The existing Toast system (src/components/ui/Toast.tsx) uses hook-local state —
 * each component that calls useToast() gets its own isolated queue.
 * This module provides a global queue so any code (polling callbacks, recovery
 * engine, store actions) can push toasts that appear in a single renderer.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // Push a toast from anywhere (no React context needed):
 *   import { globalToast } from "@/lib/jobs/global-toast-store";
 *   globalToast.success("Image generated!");
 *   globalToast.error("Generation failed — credits refunded.");
 *   globalToast.info("Recovering 2 pending jobs…");
 *
 *   // Mount the renderer once in the root layout:
 *   import { GlobalToastRenderer } from "@/components/jobs/GlobalToastRenderer";
 *   <GlobalToastRenderer />
 *
 * ─── Reuse policy ────────────────────────────────────────────────────────────
 *
 *   This module ONLY adds a global queue on top of the existing types.
 *   It imports ToastItem / ToastVariant from ui/Toast.tsx and reuses them.
 *   No second toast library is introduced.
 */

import { create }    from "zustand";
import type { ToastItem, ToastVariant } from "@/components/ui/Toast";

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

interface GlobalToastStore {
  toasts: ToastItem[];
  show:   (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss:(id: string) => void;
  clear:  () => void;
}

export const useGlobalToastStore = create<GlobalToastStore>()((set) => ({
  toasts: [],

  show: (message, variant = "info", duration = 3500) => {
    const id = `gt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: ToastItem = { id, message, variant, duration };

    set((s) => ({ toasts: [...s.toasts, item] }));

    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clear: () => set({ toasts: [] }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Convenience singleton — call from anywhere, including non-React callbacks
// ─────────────────────────────────────────────────────────────────────────────

const { getState } = useGlobalToastStore;

export const globalToast = {
  success: (msg: string, ms?: number) => getState().show(msg, "success", ms),
  error:   (msg: string, ms?: number) => getState().show(msg, "error",   ms ?? 5000),
  info:    (msg: string, ms?: number) => getState().show(msg, "info",    ms),
};
