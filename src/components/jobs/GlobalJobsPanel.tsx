"use client";

/**
 * src/components/jobs/GlobalJobsPanel.tsx
 *
 * Thin auth-aware wrapper that connects the useRetryJob hook to
 * PendingJobsDrawer. Mounted ONCE in the root layout.
 *
 * ─── Why this wrapper exists ──────────────────────────────────────────────────
 *
 *   PendingJobsDrawer accepts an optional `onRetry` callback.
 *   useRetryJob() needs the current session access token, which comes from
 *   useAuth(). This wrapper is the ONLY place that bridges the two — keeping
 *   PendingJobsDrawer itself auth-free and easily testable.
 *
 * ─── Collapse persistence ─────────────────────────────────────────────────────
 *
 *   The open/collapsed state lives inside PendingJobsDrawer (useState).
 *   It does NOT need localStorage persistence — the drawer starts collapsed,
 *   which is the correct default on every page load. Users who want to see
 *   their jobs click the pill; the drawer auto-expands when active jobs exist.
 *
 * ─── Re-render safety ─────────────────────────────────────────────────────────
 *
 *   useRetryJob returns a stable callback (useCallback on authToken).
 *   GlobalJobsPanel will only re-render when session changes, which is rare.
 *   PendingJobsDrawer only re-renders when job store state changes.
 *   The two are decoupled by the stable callback reference.
 */

import { useAuth }         from "@/components/auth/AuthContext";
import { useRetryJob }     from "@/lib/jobs/use-retry-job";
import { PendingJobsDrawer } from "./PendingJobsDrawer";

export function GlobalJobsPanel() {
  const { session } = useAuth();
  // Stable callback — only changes when session changes.
  const retryJob    = useRetryJob(session?.access_token ?? null);

  return <PendingJobsDrawer onRetry={retryJob} />;
}
