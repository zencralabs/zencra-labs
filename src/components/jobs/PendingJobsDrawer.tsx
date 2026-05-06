"use client";

/**
 * src/components/jobs/PendingJobsDrawer.tsx
 *
 * Floating glass drawer that surfaces all pending and recently-resolved
 * generation jobs.  Fixed bottom-right, above all studio UI but below toasts.
 *
 * ─── Anatomy ─────────────────────────────────────────────────────────────────
 *
 *   ┌─────────────────────────────────────────────────────┐  z-index 9000
 *   │  [collapsed button]  ← shows when 0 active jobs     │
 *   │                                                     │
 *   │  [JobRow]  ×  N      ← one row per job in store     │
 *   └─────────────────────────────────────────────────────┘
 *
 *   Collapsed: a small pill in the bottom-right corner.
 *   Active jobs: an animated badge on the pill shows count.
 *
 * ─── Interactions ─────────────────────────────────────────────────────────────
 *
 *   • Click pill → expand drawer (shows last 8 jobs, newest first)
 *   • Click ✕ on completed/failed row → removeJob
 *   • Retry button on failed row → fires onRetry callback
 *   • "Clear resolved" → clearTerminal() on store
 *   • Click job row (if completed, has URL) → opens URL in new tab
 *
 * ─── Design rules ─────────────────────────────────────────────────────────────
 *
 *   • Glass effect: backdrop-filter blur(20px) + rgba black background
 *   • Status indicator: small colored dot (STATUS_COLOR from normalizer)
 *   • Spinner for active jobs: CSS keyframe rotation
 *   • No external animation libraries
 *   • Follows Syne/Familjen typography system
 */

import { useState, useCallback } from "react";
import { X, ChevronUp, ChevronDown, RotateCcw, ExternalLink, Clock } from "lucide-react";
import {
  usePendingJobStore,
  useAllJobs,
  useActiveJobCount,
  type PendingJob,
} from "@/lib/jobs/pending-job-store";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  isTerminal,
  isActive,
} from "@/lib/jobs/job-status-normalizer";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PendingJobsDrawerProps {
  /**
   * Called when the user clicks Retry on a failed job.
   * The parent (e.g. the studio page or a root hook) is responsible for
   * re-dispatching the job and calling store.retryJob(originalJobId, newJobId).
   */
  onRetry?: (job: PendingJob) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns elapsed time as a short string, e.g. "42s", "3m 10s". */
function elapsed(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60)    return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

/** Studio label map for compact display. */
const STUDIO_LABEL: Record<string, string> = {
  image:     "Image",
  video:     "Video",
  audio:     "Audio",
  lipsync:   "Lip Sync",
  character: "Character",
  ugc:       "UGC",
  fcs:       "Cinema",
};

// ─────────────────────────────────────────────────────────────────────────────
// Spinner (CSS-only, no framer-motion)
// ─────────────────────────────────────────────────────────────────────────────

const SPINNER_KEYFRAMES = `
@keyframes zc-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes zc-pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes zc-drawer-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// JobRow
// ─────────────────────────────────────────────────────────────────────────────

function JobRow({
  job,
  onDismiss,
  onRetry,
}: {
  job:       PendingJob;
  onDismiss: (jobId: string) => void;
  onRetry?:  (job: PendingJob) => void;
}) {
  const colors  = STATUS_COLOR[job.status];
  const active  = isActive(job.status);
  const terminal = isTerminal(job.status);

  function handleRowClick() {
    if (job.status === "completed" && job.url) {
      window.open(job.url, "_blank", "noopener");
    }
  }

  return (
    <div
      onClick={job.status === "completed" && job.url ? handleRowClick : undefined}
      style={{
        display:        "flex",
        alignItems:     "flex-start",
        gap:            10,
        padding:        "10px 12px",
        borderRadius:   8,
        background:     "rgba(255,255,255,0.04)",
        border:         "1px solid rgba(255,255,255,0.07)",
        cursor:         job.status === "completed" && job.url ? "pointer" : "default",
        transition:     "background 0.15s",
        position:       "relative",
      }}
    >
      {/* Status dot / spinner */}
      <div style={{ paddingTop: 3, flexShrink: 0 }}>
        {active ? (
          <div
            style={{
              width:         10,
              height:        10,
              borderRadius:  "50%",
              border:        `2px solid ${colors.text}`,
              borderTopColor: "transparent",
              animation:     "zc-spin 0.8s linear infinite",
            }}
          />
        ) : (
          <div
            style={{
              width:       8,
              height:      8,
              borderRadius: "50%",
              background:  colors.text,
              marginTop:   1,
              animation:   job.status === "queued" ? "zc-pulse-dot 1.2s ease-in-out infinite" : undefined,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Model + studio */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#E2E8F0",
            fontFamily: "'Syne', sans-serif", lineHeight: 1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {job.modelLabel}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 500, color: "#475569", lineHeight: 1,
            fontFamily: "'Familjen Grotesk', sans-serif",
            background: "rgba(255,255,255,0.06)", borderRadius: 4, padding: "2px 5px",
            flexShrink: 0,
          }}>
            {STUDIO_LABEL[job.studio] ?? job.studio}
          </span>
        </div>

        {/* Prompt or error */}
        {(job.prompt || job.error) && (
          <div style={{
            fontSize: 11, color: job.error ? "#FCA5A5" : "#64748B",
            lineHeight: 1.35, fontFamily: "'Familjen Grotesk', sans-serif",
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {job.error ?? job.prompt}
          </div>
        )}

        {/* Footer: status + elapsed */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, color: colors.text,
            fontFamily: "'Familjen Grotesk', sans-serif",
          }}>
            {STATUS_LABEL[job.status]}
          </span>
          <span style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 10, color: "#475569", fontFamily: "'Familjen Grotesk', sans-serif",
          }}>
            <Clock size={9} />
            {elapsed(job.createdAt)}
          </span>
          {job.creditCost !== undefined && job.creditCost > 0 && (
            <span style={{
              fontSize: 10, color: "#475569",
              fontFamily: "'Familjen Grotesk', sans-serif",
            }}>
              {job.creditCost} cr
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {/* Open link (completed only) */}
        {job.status === "completed" && job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, borderRadius: 5,
              color: "#94A3B8", background: "transparent",
              border: "none", cursor: "pointer", textDecoration: "none",
            }}
            title="Open result"
          >
            <ExternalLink size={11} />
          </a>
        )}

        {/* Retry (failed / stale only) */}
        {(job.status === "failed" || job.status === "stale") && onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(job); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, borderRadius: 5,
              color: "#94A3B8", background: "transparent",
              border: "none", cursor: "pointer", padding: 0,
            }}
            title="Retry"
          >
            <RotateCcw size={11} />
          </button>
        )}

        {/* Dismiss (terminal only) */}
        {terminal && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(job.jobId); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, borderRadius: 5,
              color: "#64748B", background: "transparent",
              border: "none", cursor: "pointer", padding: 0,
            }}
            title="Dismiss"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main drawer
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DISPLAYED_JOBS = 8;

export function PendingJobsDrawer({ onRetry }: PendingJobsDrawerProps) {
  const [open, setOpen]   = useState(false);
  const allJobs           = useAllJobs();
  const activeCount       = useActiveJobCount();
  const { removeJob, clearTerminal } = usePendingJobStore();

  const displayedJobs = allJobs.slice(0, MAX_DISPLAYED_JOBS);
  const hasTerminal   = allJobs.some((j) => isTerminal(j.status));

  const handleDismiss = useCallback((jobId: string) => {
    removeJob(jobId);
  }, [removeJob]);

  if (allJobs.length === 0 && !open) return null;

  return (
    <>
      {/* Inject keyframe styles */}
      <style>{SPINNER_KEYFRAMES}</style>

      {/* Outer container — fixed bottom-right */}
      <div
        style={{
          position:   "fixed",
          bottom:     24,
          right:      24,
          zIndex:     9000,
          display:    "flex",
          flexDirection: "column",
          alignItems:    "flex-end",
          gap:           8,
        }}
      >
        {/* ── Expanded drawer ── */}
        {open && (
          <div
            style={{
              width:          320,
              maxHeight:      480,
              background:     "rgba(10,10,14,0.88)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border:         "1px solid rgba(255,255,255,0.10)",
              borderRadius:   14,
              boxShadow:      "0 24px 80px rgba(0,0,0,0.6)",
              overflow:       "hidden",
              display:        "flex",
              flexDirection:  "column",
              animation:      "zc-drawer-in 0.18s ease-out",
            }}
          >
            {/* Header */}
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "12px 14px 10px",
              borderBottom:   "1px solid rgba(255,255,255,0.07)",
              flexShrink:     0,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: "#E2E8F0",
                fontFamily: "'Syne', sans-serif", letterSpacing: "0.02em",
              }}>
                Generations
                {activeCount > 0 && (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 600,
                    color: "#A78BFA", fontFamily: "'Familjen Grotesk', sans-serif",
                  }}>
                    {activeCount} active
                  </span>
                )}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {hasTerminal && (
                  <button
                    onClick={() => clearTerminal()}
                    style={{
                      fontSize: 10, color: "#475569", background: "none",
                      border: "none", cursor: "pointer", padding: "2px 6px",
                      borderRadius: 4, fontFamily: "'Familjen Grotesk', sans-serif",
                    }}
                  >
                    Clear resolved
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 22, height: 22, borderRadius: 5,
                    color: "#64748B", background: "rgba(255,255,255,0.06)",
                    border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>

            {/* Job list */}
            <div style={{
              flex:       1,
              overflowY:  "auto",
              padding:    "8px",
              display:    "flex",
              flexDirection: "column",
              gap:        6,
            }}>
              {displayedJobs.length === 0 ? (
                <div style={{
                  textAlign: "center", color: "#475569",
                  fontSize: 12, padding: "32px 16px",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                }}>
                  No recent generations
                </div>
              ) : (
                displayedJobs.map((job) => (
                  <JobRow
                    key={job.jobId}
                    job={job}
                    onDismiss={handleDismiss}
                    onRetry={onRetry}
                  />
                ))
              )}
              {allJobs.length > MAX_DISPLAYED_JOBS && (
                <div style={{
                  textAlign: "center", color: "#475569",
                  fontSize: 10, padding: "6px 0",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                }}>
                  +{allJobs.length - MAX_DISPLAYED_JOBS} more — check Dashboard
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Pill toggle button ── */}
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            position:       "relative",
            display:        "flex",
            alignItems:     "center",
            gap:            7,
            padding:        "8px 14px",
            borderRadius:   100,
            background:     activeCount > 0
              ? "rgba(167,139,250,0.15)"
              : "rgba(10,10,14,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border:         activeCount > 0
              ? "1px solid rgba(167,139,250,0.30)"
              : "1px solid rgba(255,255,255,0.10)",
            boxShadow:      "0 8px 32px rgba(0,0,0,0.5)",
            cursor:         "pointer",
            transition:     "background 0.2s, border 0.2s",
          }}
        >
          {/* Active indicator dot */}
          {activeCount > 0 && (
            <div style={{
              width:  8, height: 8, borderRadius: "50%",
              background: "#A78BFA",
              animation: "zc-spin 1.4s linear infinite",
              border:     "1.5px solid rgba(167,139,250,0.4)",
              flexShrink: 0,
            }} />
          )}

          <span style={{
            fontSize: 12, fontWeight: 600, color: activeCount > 0 ? "#C4B5FD" : "#94A3B8",
            fontFamily: "'Familjen Grotesk', sans-serif",
            lineHeight: 1,
          }}>
            {activeCount > 0
              ? `${activeCount} generating…`
              : allJobs.length > 0
                ? `${allJobs.length} job${allJobs.length === 1 ? "" : "s"}`
                : "Generations"}
          </span>

          {open ? (
            <ChevronDown size={12} style={{ color: "#94A3B8" }} />
          ) : (
            <ChevronUp size={12} style={{ color: "#94A3B8" }} />
          )}

          {/* Badge for active count */}
          {activeCount > 0 && (
            <div
              style={{
                position:    "absolute",
                top:         -6,
                right:       -6,
                width:       18,
                height:      18,
                borderRadius: "50%",
                background:  "#A78BFA",
                display:     "flex",
                alignItems:  "center",
                justifyContent: "center",
                fontSize:    9,
                fontWeight:  700,
                color:       "#0A0A0E",
                fontFamily:  "'Syne', sans-serif",
                boxShadow:   "0 0 0 2px rgba(10,10,14,0.88)",
              }}
            >
              {activeCount}
            </div>
          )}
        </button>
      </div>
    </>
  );
}
