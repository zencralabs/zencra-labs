"use client";

/**
 * src/components/jobs/GlobalJobsPanel.tsx
 *
 * Auth-aware wrapper that connects the Activity Center to auth state.
 * Mounted ONCE in the root layout — never mount again.
 *
 * ─── What lives here ──────────────────────────────────────────────────────────
 *
 *   • useRetryJob    — re-dispatches a failed job (needs session token)
 *   • handleDelete   — permanently deletes a failed generation from the DB
 *                      (needs session token, routes by studio type)
 *
 * ─── Why this wrapper exists ──────────────────────────────────────────────────
 *
 *   PendingJobsDrawer is auth-free. All operations that need a JWT live here
 *   and are passed down as stable callbacks so the drawer doesn't re-render
 *   on every token rotation.
 *
 * ─── Delete routing ───────────────────────────────────────────────────────────
 *
 *   DELETE /api/jobs/[assetId]?studio=<studio>
 *
 *   The endpoint routes by studio:
 *     lipsync  → generations   table
 *     workflow → workflow_runs table
 *     else     → assets         table
 *
 *   On success, the job is removed from the Zustand store.
 *   On failure, the drawer's confirmation overlay closes — no silent swallow.
 */

import { useCallback }       from "react";
import { useAuth }           from "@/components/auth/AuthContext";
import { useRetryJob }       from "@/lib/jobs/use-retry-job";
import { getPendingJobStoreState } from "@/lib/jobs/pending-job-store";
import type { PendingJob }   from "@/lib/jobs/pending-job-store";
import { PendingJobsDrawer } from "./PendingJobsDrawer";

export function GlobalJobsPanel() {
  const { session, user } = useAuth();
  const retryJob          = useRetryJob(session?.access_token ?? null);

  // ── Permanent delete handler ────────────────────────────────────────────────
  const handleDelete = useCallback(async (job: PendingJob): Promise<void> => {
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const url = `/api/jobs/${encodeURIComponent(job.assetId ?? job.jobId)}?studio=${encodeURIComponent(job.studio)}`;

    const res = await fetch(url, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      // Surface a typed error so the drawer can reset its confirming state
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `Delete failed (${res.status})`);
    }

    // Remove from local Zustand store on success
    getPendingJobStoreState().removeJob(job.jobId);
  }, [session?.access_token]);

  return (
    <PendingJobsDrawer
      onRetry={retryJob}
      onDelete={handleDelete}
      userId={user?.id}
    />
  );
}
