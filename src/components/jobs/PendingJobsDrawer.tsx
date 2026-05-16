"use client";

/**
 * src/components/jobs/PendingJobsDrawer.tsx — Zencra Activity Center
 *
 * Floating cinematic drawer that surfaces all pending and recently-resolved
 * generation jobs.  Fixed bottom-right, z-index 9000.
 *
 * ─── Anatomy ─────────────────────────────────────────────────────────────────
 *
 *   [Activity button] — always visible when jobs exist
 *     └── [Drawer panel]
 *           ├── Header  (title + active count + Clear resolved + Close)
 *           ├── Active section   (queued / starting / processing)
 *           ├── Completed section (completed — with thumbnail for image jobs)
 *           └── Failed section   (failed / stale / cancelled / refunded)
 *
 * ─── Design system ────────────────────────────────────────────────────────────
 *
 *   • Typography: Syne (display/labels), Familjen Grotesk (body/metadata)
 *   • Glass: backdrop-filter blur(24px) + rgba(8,8,12,0.92)
 *   • Per-studio accent colors on left card border + status indicators
 *   • Pulse animation on Activity button when jobs are in flight
 *   • No external animation libraries — CSS keyframes only
 *
 * ─── Compatibility ────────────────────────────────────────────────────────────
 *
 *   Export name and props interface are preserved for GlobalJobsPanel.tsx.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  X, RotateCcw, ExternalLink, Clock,
  Activity, CheckCircle2, AlertTriangle, Trash2,
} from "lucide-react";
import {
  usePendingJobStore,
  useAllJobs,
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
   * The parent (GlobalJobsPanel) is responsible for re-dispatching
   * and calling store.retryJob(originalJobId, newJobId).
   */
  onRetry?: (job: PendingJob) => void;

  /**
   * Called when the user confirms deletion of a failed generation card.
   * The parent (GlobalJobsPanel) is responsible for calling
   * DELETE /api/jobs/[assetId]?studio=<studio> and then removeJob().
   * Returns a Promise that resolves on success or rejects on error.
   */
  onDelete?: (job: PendingJob) => Promise<void>;

  /**
   * Authenticated Supabase user ID of the currently signed-in user.
   * Jobs are rendered ONLY when job.userId === userId (strict match).
   * When undefined (guest / unauthenticated), no persisted jobs are shown.
   * This is a hard privacy boundary — no legacy anonymous jobs ever render.
   */
  userId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

/** Studio-specific accent color — left card border + active spinner ring. */
const STUDIO_ACCENT: Record<string, string> = {
  image:     "#A78BFA",   // violet
  video:     "#84CC16",   // lime
  audio:     "#F59E0B",   // amber
  workflow:  "#22D3EE",   // cyan
  lipsync:   "#F472B6",   // pink
  character: "#FB923C",   // orange
  ugc:       "#38BDF8",   // sky
  fcs:       "#818CF8",   // indigo
};

/** Human-readable studio name for the compact chip. */
const STUDIO_LABEL: Record<string, string> = {
  image:     "Image",
  video:     "Video",
  audio:     "Audio",
  lipsync:   "Lip Sync",
  character: "Character",
  ugc:       "UGC",
  fcs:       "Cinema",
  workflow:  "Creative",
};

/**
 * Studios whose completed URLs are image files and can be previewed
 * as a small thumbnail in the completed card.
 */
const SUPPORTS_THUMBNAIL = new Set(["image", "workflow", "character", "ugc"]);

// ─────────────────────────────────────────────────────────────────────────────
// CSS keyframes (injected once into <head>)
// ─────────────────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes zc-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes zc-pulse-ring {
  0%   { transform: scale(1);    opacity: 0.6; }
  70%  { transform: scale(1.45); opacity: 0;   }
  100% { transform: scale(1.45); opacity: 0;   }
}
@keyframes zc-pulse-dot {
  0%, 100% { opacity: 1;   }
  50%       { opacity: 0.4; }
}
@keyframes zc-drawer-in {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
@keyframes zc-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function elapsed(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

function studioAccent(studio: string): string {
  return STUDIO_ACCENT[studio] ?? "#94A3B8";
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail — lazy-loaded image preview for completed image jobs
// ─────────────────────────────────────────────────────────────────────────────

function JobThumbnail({ url, alt }: { url: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) return null;

  return (
    <div style={{
      width:        52,
      height:       52,
      borderRadius: 7,
      overflow:     "hidden",
      flexShrink:   0,
      background:   "rgba(255,255,255,0.04)",
      border:       "1px solid rgba(255,255,255,0.08)",
      position:     "relative",
    }}>
      {!loaded && (
        <div style={{
          position:   "absolute", inset: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
          animation:  "zc-pulse-dot 1.4s ease-in-out infinite",
        }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        style={{
          width:      "100%",
          height:     "100%",
          objectFit:  "cover",
          display:    loaded ? "block" : "none",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  count,
  color,
}: {
  icon:  React.ReactNode;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div style={{
      display:     "flex",
      alignItems:  "center",
      gap:         6,
      padding:     "6px 2px 4px",
      marginTop:   2,
    }}>
      <span style={{ color, display: "flex", alignItems: "center" }}>{icon}</span>
      <span style={{
        fontSize:    10,
        fontWeight:  700,
        color,
        fontFamily:  "'Syne', sans-serif",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}>
        {label}
      </span>
      <span style={{
        fontSize:   10,
        fontWeight: 600,
        color:      hexToRgba(color, 0.5),
        fontFamily: "'Familjen Grotesk', sans-serif",
      }}>
        {count}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JobCard
// ─────────────────────────────────────────────────────────────────────────────

function JobCard({
  job,
  isConfirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onRetry,
}: {
  job:                PendingJob;
  isConfirmingDelete: boolean;
  onRequestDelete:    (jobId: string) => void;
  onCancelDelete:     () => void;
  onConfirmDelete:    (job: PendingJob) => void;
  onRetry?:           (job: PendingJob) => void;
}) {
  const colors    = STATUS_COLOR[job.status];
  const active    = isActive(job.status);
  const terminal  = isTerminal(job.status);
  const accent    = studioAccent(job.studio);
  const clickable = job.status === "completed" && !!job.url;
  const showThumb = job.status === "completed" && !!job.url && SUPPORTS_THUMBNAIL.has(job.studio);

  function handleRowClick() {
    if (clickable) window.open(job.url!, "_blank", "noopener");
  }

  return (
    <div
      onClick={clickable ? handleRowClick : undefined}
      style={{
        display:      "flex",
        alignItems:   "flex-start",
        gap:          10,
        padding:      "10px 12px 10px 14px",
        borderRadius: 10,
        background:   "rgba(255,255,255,0.035)",
        border:       "1px solid rgba(255,255,255,0.07)",
        borderLeft:   `3px solid ${hexToRgba(accent, active ? 0.9 : 0.45)}`,
        cursor:       clickable ? "pointer" : "default",
        transition:   "background 0.15s, border-color 0.15s",
        position:     "relative",
        animation:    "zc-fade-in 0.2s ease-out",
      }}
      onMouseEnter={e => {
        if (clickable) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.055)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.035)";
      }}
    >
      {/* Status indicator — studio-tinted spinner or static dot */}
      <div style={{ paddingTop: 4, flexShrink: 0 }}>
        {active ? (
          <div style={{
            width:          10,
            height:         10,
            borderRadius:   "50%",
            border:         `2px solid ${accent}`,
            borderTopColor: "transparent",
            animation:      "zc-spin 0.75s linear infinite",
          }} />
        ) : (
          <div style={{
            width:       8,
            height:      8,
            borderRadius: "50%",
            background:  colors.text,
            marginTop:   1,
            animation:   job.status === "queued" ? "zc-pulse-dot 1.2s ease-in-out infinite" : undefined,
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Model + studio chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{
            fontSize:      11,
            fontWeight:    600,
            color:         "#E2E8F0",
            fontFamily:    "'Syne', sans-serif",
            lineHeight:    1,
            whiteSpace:    "nowrap",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            maxWidth:      150,
          }}>
            {job.modelLabel}
          </span>
          <span style={{
            fontSize:   9,
            fontWeight: 600,
            color:      hexToRgba(accent, 0.85),
            fontFamily: "'Familjen Grotesk', sans-serif",
            background: hexToRgba(accent, 0.08),
            border:     `1px solid ${hexToRgba(accent, 0.18)}`,
            borderRadius: 4,
            padding:    "2px 5px",
            lineHeight: 1,
            flexShrink: 0,
          }}>
            {STUDIO_LABEL[job.studio] ?? job.studio}
          </span>
        </div>

        {/* Prompt or error */}
        {(job.prompt || job.error) && (
          <div style={{
            fontSize:           11,
            color:              job.error ? "#FCA5A5" : "#64748B",
            lineHeight:         1.35,
            fontFamily:         "'Familjen Grotesk', sans-serif",
            overflow:           "hidden",
            display:            "-webkit-box",
            WebkitLineClamp:    2,
            WebkitBoxOrient:    "vertical",
            marginBottom:       5,
          }}>
            {job.error ?? job.prompt}
          </div>
        )}

        {/* Footer: status label + elapsed + credits */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize:   10,
            fontWeight: 600,
            color:      colors.text,
            fontFamily: "'Familjen Grotesk', sans-serif",
          }}>
            {STATUS_LABEL[job.status]}
          </span>
          <span style={{
            display:    "flex",
            alignItems: "center",
            gap:        3,
            fontSize:   10,
            color:      "#3F4F63",
            fontFamily: "'Familjen Grotesk', sans-serif",
          }}>
            <Clock size={9} />
            {elapsed(job.createdAt)}
          </span>
          {job.creditCost !== undefined && job.creditCost > 0 && (
            <span style={{
              fontSize:   10,
              color:      "#3F4F63",
              fontFamily: "'Familjen Grotesk', sans-serif",
            }}>
              {job.creditCost} cr
            </span>
          )}
        </div>
      </div>

      {/* Thumbnail for completed image-type jobs */}
      {showThumb && (
        <JobThumbnail url={job.url!} alt={job.prompt ?? "Generated image"} />
      )}

      {/* Actions column */}
      <div style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "flex-end",
        gap:           4,
        flexShrink:    0,
        alignSelf:     "center",
        marginLeft:    showThumb ? 0 : 4,
      }}>
        {/* View chip — completed + has URL */}
        {job.status === "completed" && job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open result in new tab"
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            4,
              padding:        "3px 8px",
              borderRadius:   5,
              fontSize:       10,
              fontWeight:     600,
              color:          "#34D399",
              background:     "rgba(52,211,153,0.08)",
              border:         "1px solid rgba(52,211,153,0.20)",
              cursor:         "pointer",
              textDecoration: "none",
              fontFamily:     "'Familjen Grotesk', sans-serif",
              flexShrink:     0,
              whiteSpace:     "nowrap",
            }}
          >
            <ExternalLink size={9} />
            View
          </a>
        )}

        {/* Retry — failed / stale only */}
        {(job.status === "failed" || job.status === "stale") && onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(job); }}
            title="Retry generation"
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              width:          24,
              height:         24,
              borderRadius:   6,
              color:          "#94A3B8",
              background:     "rgba(255,255,255,0.05)",
              border:         "1px solid rgba(255,255,255,0.08)",
              cursor:         "pointer",
              padding:        0,
              transition:     "background 0.15s",
            }}
          >
            <RotateCcw size={11} />
          </button>
        )}

        {/* Delete — failed / stale / cancelled / refunded cards */}
        {terminal && job.status !== "completed" && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestDelete(job.jobId); }}
            title="Delete permanently"
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              width:          24,
              height:         24,
              borderRadius:   6,
              color:          "#6B7280",
              background:     "transparent",
              border:         "none",
              cursor:         "pointer",
              padding:        0,
              transition:     "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#FCA5A5")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* ── Inline delete confirmation overlay ── */}
      {isConfirmingDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position:       "absolute",
            inset:          0,
            borderRadius:   10,
            background:     "rgba(8,8,12,0.96)",
            backdropFilter: "blur(4px)",
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            gap:            10,
            padding:        "12px 14px",
            animation:      "zc-fade-in 0.15s ease-out",
            zIndex:         2,
          }}
        >
          <span style={{
            fontSize:   11,
            fontWeight: 600,
            color:      "#E2E8F0",
            fontFamily: "'Syne', sans-serif",
            textAlign:  "center",
            lineHeight: 1.4,
          }}>
            Delete this failed generation permanently?
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onCancelDelete}
              style={{
                padding:      "5px 12px",
                borderRadius: 6,
                fontSize:     10,
                fontWeight:   600,
                color:        "#94A3B8",
                background:   "rgba(255,255,255,0.06)",
                border:       "1px solid rgba(255,255,255,0.10)",
                cursor:       "pointer",
                fontFamily:   "'Familjen Grotesk', sans-serif",
                transition:   "background 0.15s",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirmDelete(job)}
              style={{
                padding:      "5px 12px",
                borderRadius: 6,
                fontSize:     10,
                fontWeight:   700,
                color:        "#FCA5A5",
                background:   "rgba(252,165,165,0.10)",
                border:       "1px solid rgba(252,165,165,0.25)",
                cursor:       "pointer",
                fontFamily:   "'Familjen Grotesk', sans-serif",
                transition:   "background 0.15s",
              }}
            >
              Delete permanently
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating Activity Button
// ─────────────────────────────────────────────────────────────────────────────

function ActivityButton({
  open,
  activeCount,
  totalCount,
  onClick,
}: {
  open:        boolean;
  activeCount: number;
  totalCount:  number;
  onClick:     () => void;
}) {
  const hasActive = activeCount > 0;

  return (
    <button
      onClick={onClick}
      title="Zencra Activity Center"
      style={{
        position:        "relative",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        width:           44,
        height:          44,
        borderRadius:    "50%",
        background:      hasActive
          ? "rgba(167,139,250,0.18)"
          : "rgba(10,10,14,0.90)",
        backdropFilter:  "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border:          hasActive
          ? "1px solid rgba(167,139,250,0.35)"
          : "1px solid rgba(255,255,255,0.11)",
        boxShadow:       hasActive
          ? "0 0 0 0 rgba(167,139,250,0.4), 0 8px 32px rgba(0,0,0,0.55)"
          : "0 8px 32px rgba(0,0,0,0.55)",
        cursor:          "pointer",
        transition:      "background 0.25s, border 0.25s, box-shadow 0.25s",
        padding:         0,
      }}
    >
      {/* Pulse ring — only while active */}
      {hasActive && (
        <span style={{
          position:     "absolute",
          inset:        -1,
          borderRadius: "50%",
          border:       "1.5px solid rgba(167,139,250,0.55)",
          animation:    "zc-pulse-ring 1.6s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
          pointerEvents: "none",
        }} />
      )}

      <Activity
        size={18}
        style={{
          color:      hasActive ? "#C4B5FD" : "#64748B",
          transition: "color 0.25s",
        }}
      />

      {/* Badge — active count */}
      {hasActive && (
        <div style={{
          position:       "absolute",
          top:            -5,
          right:          -5,
          minWidth:       17,
          height:         17,
          borderRadius:   "99px",
          background:     "#A78BFA",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       9,
          fontWeight:     700,
          color:          "#0A0A0E",
          fontFamily:     "'Syne', sans-serif",
          boxShadow:      "0 0 0 2px rgba(10,10,14,0.90)",
          padding:        "0 4px",
        }}>
          {activeCount}
        </div>
      )}

      {/* Dim total badge — no active, but history present */}
      {!hasActive && totalCount > 0 && (
        <div style={{
          position:       "absolute",
          top:            -5,
          right:          -5,
          minWidth:       17,
          height:         17,
          borderRadius:   "99px",
          background:     "rgba(100,116,139,0.8)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       9,
          fontWeight:     700,
          color:          "#E2E8F0",
          fontFamily:     "'Syne', sans-serif",
          boxShadow:      "0 0 0 2px rgba(10,10,14,0.90)",
          padding:        "0 4px",
        }}>
          {totalCount}
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main drawer
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DISPLAYED_JOBS      = 12;
const AUTO_DISMISS_DELAY_MS   = 8_000;

export function PendingJobsDrawer({ onRetry, onDelete, userId }: PendingJobsDrawerProps) {
  const [open, setOpen]                   = useState(false);
  const [confirmingDelete, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting]           = useState(false);
  const allJobsRaw                        = useAllJobs();
  // Privacy hard boundary: render ONLY jobs that belong to the current authenticated user.
  // No userId → guest → show nothing. Legacy jobs without userId are treated as untrusted.
  const allJobs                           = allJobsRaw.filter(
    (job) => !!userId && job.userId === userId
  );
  const activeCount                       = allJobs.filter((j) => !isTerminal(j.status)).length;
  const { removeJob, clearTerminal }      = usePendingJobStore();

  // ── Auto-open on job completion, auto-close after delay ─────────────────────
  const terminalCount     = allJobs.filter(j => isTerminal(j.status)).length;
  const prevTerminalRef   = useRef(terminalCount);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    if (terminalCount > prevTerminalRef.current) {
      userInteractedRef.current = false;
      setOpen(true);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(() => {
        if (!userInteractedRef.current) setOpen(false);
        autoCloseTimerRef.current = null;
      }, AUTO_DISMISS_DELAY_MS);
    }
    prevTerminalRef.current = terminalCount;
  }, [terminalCount]);

  useEffect(() => () => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
  }, []);

  // ── Auto-open on optimistic job registration ─────────────────────────────
  // Studios dispatch "zencra:job:registered" immediately after registerJob()
  // so the drawer opens before the backend responds — giving the user instant
  // visual feedback that their generation is in progress.
  // Privacy filter (job.userId === userId) is unaffected — this only opens the
  // drawer; the job card itself is still filtered before render.
  useEffect(() => {
    function handleJobRegistered() {
      userInteractedRef.current = false;
      setOpen(true);
    }
    window.addEventListener("zencra:job:registered", handleJobRegistered);
    return () => window.removeEventListener("zencra:job:registered", handleJobRegistered);
  }, []);

  const handleToggle = useCallback(() => {
    userInteractedRef.current = true;
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setOpen(v => !v);
  }, []);

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const handleRequestDelete = useCallback((jobId: string) => {
    setConfirming(jobId);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setConfirming(null);
  }, []);

  const handleConfirmDelete = useCallback(async (job: PendingJob) => {
    if (deleting) return;
    setDeleting(true);
    try {
      if (onDelete) {
        await onDelete(job);
      } else {
        // Fallback: local-only remove if no delete handler provided
        removeJob(job.jobId);
      }
    } catch {
      // Parent is responsible for surfacing delete errors — we just reset state
    } finally {
      setDeleting(false);
      setConfirming(null);
    }
  }, [deleting, onDelete, removeJob]);

  // ── Section split ────────────────────────────────────────────────────────────
  const displayed   = allJobs.slice(0, MAX_DISPLAYED_JOBS);
  const activeJobs  = displayed.filter(j => isActive(j.status));
  const doneJobs    = displayed.filter(j => j.status === "completed");
  const failedJobs  = displayed.filter(j => isTerminal(j.status) && j.status !== "completed");
  const hasTerminal = allJobs.some(j => isTerminal(j.status));

  if (!userId) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div style={{
        position:      "fixed",
        bottom:        24,
        right:         24,
        zIndex:        9000,
        display:       "flex",
        flexDirection: "column",
        alignItems:    "flex-end",
        gap:           10,
      }}>

        {/* ── Drawer panel ── */}
        {open && (
          <div style={{
            width:         340,
            maxHeight:     520,
            background:    "rgba(8,8,12,0.93)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border:        "1px solid rgba(255,255,255,0.09)",
            borderRadius:  16,
            boxShadow:     "0 32px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset",
            overflow:      "hidden",
            display:       "flex",
            flexDirection: "column",
            animation:     "zc-drawer-in 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
          }}>

            {/* ─ Header ─ */}
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "13px 14px 11px",
              borderBottom:   "1px solid rgba(255,255,255,0.07)",
              flexShrink:     0,
              background:     "rgba(255,255,255,0.015)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={14} style={{ color: activeCount > 0 ? "#A78BFA" : "#475569" }} />
                <span style={{
                  fontSize:      13,
                  fontWeight:    700,
                  color:         "#E2E8F0",
                  fontFamily:    "'Syne', sans-serif",
                  letterSpacing: "0.01em",
                }}>
                  Activity Center
                </span>
                {activeCount > 0 && (
                  <span style={{
                    fontSize:   10,
                    fontWeight: 600,
                    color:      "#A78BFA",
                    fontFamily: "'Familjen Grotesk', sans-serif",
                    background: "rgba(167,139,250,0.1)",
                    border:     "1px solid rgba(167,139,250,0.2)",
                    borderRadius: 5,
                    padding:    "2px 7px",
                    lineHeight: 1,
                  }}>
                    {activeCount} active
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {hasTerminal && (
                  <button
                    onClick={() => clearTerminal()}
                    style={{
                      fontSize:   10,
                      fontWeight: 500,
                      color:      "#475569",
                      background: "none",
                      border:     "none",
                      cursor:     "pointer",
                      padding:    "3px 7px",
                      borderRadius: 5,
                      fontFamily: "'Familjen Grotesk', sans-serif",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#94A3B8")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#475569")}
                  >
                    Clear resolved
                  </button>
                )}
                <button
                  onClick={() => { userInteractedRef.current = true; setOpen(false); }}
                  style={{
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    width:          26,
                    height:         26,
                    borderRadius:   7,
                    color:          "#64748B",
                    background:     "rgba(255,255,255,0.06)",
                    border:         "1px solid rgba(255,255,255,0.08)",
                    cursor:         "pointer",
                    padding:        0,
                    transition:     "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* ─ Job list ─ */}
            <div style={{
              flex:          1,
              overflowY:     "auto",
              padding:       "8px 10px 10px",
              display:       "flex",
              flexDirection: "column",
              gap:           0,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.08) transparent",
            }}>

              {/* Empty state */}
              {allJobs.length === 0 && (
                <div style={{
                  textAlign:  "center",
                  color:      "#334155",
                  fontSize:   12,
                  padding:    "40px 16px",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                }}>
                  No recent generations
                </div>
              )}

              {/* ── Active section ── */}
              {activeJobs.length > 0 && (
                <>
                  <SectionHeader
                    icon={<div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      border: "2px solid #A78BFA", borderTopColor: "transparent",
                      animation: "zc-spin 0.75s linear infinite",
                    }} />}
                    label="Generating"
                    count={activeJobs.length}
                    color="#A78BFA"
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 4 }}>
                    {activeJobs.map(job => (
                      <JobCard
                        key={job.jobId}
                        job={job}
                        isConfirmingDelete={confirmingDelete === job.jobId}
                        onRequestDelete={handleRequestDelete}
                        onCancelDelete={handleCancelDelete}
                        onConfirmDelete={handleConfirmDelete}
                        onRetry={onRetry}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* ── Completed section ── */}
              {doneJobs.length > 0 && (
                <>
                  <SectionHeader
                    icon={<CheckCircle2 size={10} />}
                    label="Completed"
                    count={doneJobs.length}
                    color="#34D399"
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 4 }}>
                    {doneJobs.map(job => (
                      <JobCard
                        key={job.jobId}
                        job={job}
                        isConfirmingDelete={confirmingDelete === job.jobId}
                        onRequestDelete={handleRequestDelete}
                        onCancelDelete={handleCancelDelete}
                        onConfirmDelete={handleConfirmDelete}
                        onRetry={onRetry}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* ── Failed / Stale / Cancelled section ── */}
              {failedJobs.length > 0 && (
                <>
                  <SectionHeader
                    icon={<AlertTriangle size={10} />}
                    label="Failed"
                    count={failedJobs.length}
                    color="#FB923C"
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 4 }}>
                    {failedJobs.map(job => (
                      <JobCard
                        key={job.jobId}
                        job={job}
                        isConfirmingDelete={confirmingDelete === job.jobId}
                        onRequestDelete={handleRequestDelete}
                        onCancelDelete={handleCancelDelete}
                        onConfirmDelete={handleConfirmDelete}
                        onRetry={onRetry}
                      />
                    ))}
                  </div>
                </>
              )}

              {allJobs.length > MAX_DISPLAYED_JOBS && (
                <div style={{
                  textAlign:  "center",
                  color:      "#334155",
                  fontSize:   10,
                  padding:    "8px 0 4px",
                  fontFamily: "'Familjen Grotesk', sans-serif",
                }}>
                  +{allJobs.length - MAX_DISPLAYED_JOBS} more — view Dashboard
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Floating Activity Button ── */}
        <ActivityButton
          open={open}
          activeCount={activeCount}
          totalCount={allJobs.length}
          onClick={handleToggle}
        />
      </div>
    </>
  );
}
