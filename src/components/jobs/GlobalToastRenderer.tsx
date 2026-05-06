"use client";

/**
 * src/components/jobs/GlobalToastRenderer.tsx
 *
 * Mounts once in the root layout. Renders the existing ToastStack driven
 * by the global Zustand toast queue (useGlobalToastStore).
 *
 * This is the ONLY place ToastStack is rendered for global toasts.
 * Component-local useToast() instances (inside studio pages) remain separate
 * and unaffected.
 *
 * Usage: add <GlobalToastRenderer /> to src/app/layout.tsx body.
 */

import { useGlobalToastStore } from "@/lib/jobs/global-toast-store";
import { ToastStack }          from "@/components/ui/Toast";

export function GlobalToastRenderer() {
  const toasts  = useGlobalToastStore((s) => s.toasts);
  const dismiss = useGlobalToastStore((s) => s.dismiss);

  return <ToastStack toasts={toasts} onDismiss={dismiss} />;
}
