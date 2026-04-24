"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowTransitionModal — Premium handoff modal for studio-to-studio routing
//
// Shown when a user clicks "Animate" on an image in Image Studio or
// Creative Director. Lets them choose the flow (Animate / Start Frame /
// End Frame), displays the selected asset, then routes to Video Studio
// with full context propagation.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkflowFlow = "animate" | "start-frame" | "end-frame";

export interface WorkflowTransitionAsset {
  url: string;
  prompt?: string;
  assetId?: string;
  projectId?: string;
  sessionId?: string;
  conceptId?: string;
}

interface WorkflowTransitionModalProps {
  open: boolean;
  onClose: () => void;
  /** Where the handoff originates */
  origin: "image-studio" | "creative-director";
  /** The asset being animated */
  asset: WorkflowTransitionAsset | null;
  /** Default flow pre-selected when modal opens */
  defaultFlow?: WorkflowFlow;
  /** Called when user confirms — allows parent to intercept before route */
  onContinue?: (flow: WorkflowFlow, asset: WorkflowTransitionAsset) => void;
}

// ── Origin metadata ───────────────────────────────────────────────────────────

const ORIGIN_META = {
  "image-studio": {
    label: "Image Studio",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    accentColor: "#6366F1",
    accentGlow:  "rgba(99,102,241,0.18)",
    badgeBg:     "rgba(99,102,241,0.10)",
    badgeBorder: "rgba(99,102,241,0.25)",
    badgeText:   "rgba(165,180,252,0.9)",
  },
  "creative-director": {
    label: "Creative Director",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    accentColor: "#0EA5A0",
    accentGlow:  "rgba(14,165,160,0.18)",
    badgeBg:     "rgba(14,165,160,0.10)",
    badgeBorder: "rgba(14,165,160,0.25)",
    badgeText:   "rgba(94,234,212,0.9)",
  },
} as const;

// ── Flow option definitions ───────────────────────────────────────────────────

interface FlowOption {
  id: WorkflowFlow;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const FLOW_OPTIONS: FlowOption[] = [
  {
    id: "animate",
    label: "Animate Image",
    description: "Use this image as the main reference and let AI animate the scene.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
  },
  {
    id: "start-frame",
    label: "Use as Start Frame",
    description: "Lock this image as the opening frame. Video begins from here.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="5 5 5 19"/>
      </svg>
    ),
  },
  {
    id: "end-frame",
    label: "Use as End Frame",
    description: "Lock this image as the closing frame. Video ends on this shot.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="19 5 19 19"/>
      </svg>
    ),
  },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function WorkflowTransitionModal({
  open,
  onClose,
  origin,
  asset,
  defaultFlow = "animate",
  onContinue,
}: WorkflowTransitionModalProps) {
  const router = useRouter();
  const meta   = ORIGIN_META[origin];

  const [selectedFlow, setSelectedFlow] = useState<WorkflowFlow>(defaultFlow);
  const [launching, setLaunching]       = useState(false);

  // Reset selection whenever modal re-opens with a different defaultFlow
  useEffect(() => {
    if (open) {
      setSelectedFlow(defaultFlow);
      setLaunching(false);
    }
  }, [open, defaultFlow]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const handleContinue = useCallback(() => {
    if (!asset) return;
    setLaunching(true);

    if (onContinue) {
      onContinue(selectedFlow, asset);
      return;
    }

    // Default: build URL and route
    const p = new URLSearchParams({
      from: origin,
      flow: selectedFlow,
    });

    if (selectedFlow === "animate" || selectedFlow === "start-frame") {
      p.set("startFrame", asset.url);
    } else if (selectedFlow === "end-frame") {
      p.set("endFrame", asset.url);
    }

    if (asset.prompt)    p.set("prompt",    asset.prompt);
    if (asset.assetId)   p.set("assetId",   asset.assetId);
    if (asset.projectId) p.set("projectId", asset.projectId);
    if (asset.sessionId) p.set("sessionId", asset.sessionId);
    if (asset.conceptId) p.set("conceptId", asset.conceptId);

    router.push(`/studio/video?${p.toString()}`);
  }, [asset, selectedFlow, origin, onContinue, router]);

  if (!open || !asset) return null;

  const previewPrompt = asset.prompt
    ? asset.prompt.length > 100
      ? asset.prompt.slice(0, 100) + "…"
      : asset.prompt
    : null;

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(2,6,23,0.75)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          animation: "wfm-fade-in 0.2s ease",
        }}
      />

      {/* ── Modal panel ───────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send to Video Studio"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 560,
            background: "linear-gradient(180deg, #0D1427 0%, #080F1E 100%)",
            border: `1px solid ${meta.accentColor}33`,
            borderRadius: 16,
            boxShadow: `0 0 0 1px ${meta.accentColor}1A, 0 24px 72px rgba(0,0,0,0.6), 0 0 80px ${meta.accentGlow}`,
            animation: "wfm-slide-up 0.25s cubic-bezier(0.16,1,0.3,1)",
            overflow: "hidden",
          }}
        >
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Origin badge */}
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 6,
                background: meta.badgeBg,
                border: `1px solid ${meta.badgeBorder}`,
                color: meta.badgeText,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.01em",
              }}>
                {meta.icon}
                {meta.label}
              </span>

              {/* Arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>

              {/* Destination badge */}
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px",
                borderRadius: 6,
                background: "rgba(15,23,42,0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 11,
                fontWeight: 500,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                Video Studio
              </span>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.4)",
                padding: 4,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div style={{ padding: "20px 22px" }}>
            {/* Asset preview + prompt */}
            <div style={{
              display: "flex",
              gap: 14,
              marginBottom: 22,
              padding: "14px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              {/* Thumbnail */}
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                overflow: "hidden",
                flexShrink: 0,
                border: `1px solid ${meta.accentColor}33`,
                boxShadow: `0 0 16px ${meta.accentGlow}`,
                background: "#0D1427",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt="Asset to animate"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              {/* Prompt / placeholder */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 5,
                minWidth: 0,
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: meta.badgeText,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}>
                  Selected image
                </span>
                <span style={{
                  fontSize: 13,
                  color: previewPrompt ? "rgba(245,247,255,0.82)" : "rgba(255,255,255,0.3)",
                  fontStyle: previewPrompt ? "normal" : "italic",
                  lineHeight: "1.45",
                  wordBreak: "break-word",
                }}>
                  {previewPrompt ?? "No prompt attached"}
                </span>
              </div>
            </div>

            {/* Flow selector */}
            <div style={{ marginBottom: 22 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}>
                Choose how to use this image
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {FLOW_OPTIONS.map((opt) => {
                  const isSelected = selectedFlow === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedFlow(opt.id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        width: "100%",
                        textAlign: "left",
                        padding: "11px 14px",
                        borderRadius: 9,
                        border: isSelected
                          ? `1px solid ${meta.accentColor}55`
                          : "1px solid rgba(255,255,255,0.06)",
                        background: isSelected
                          ? `linear-gradient(135deg, ${meta.accentGlow}, rgba(255,255,255,0.02))`
                          : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? `0 0 20px ${meta.accentGlow}` : "none",
                      }}
                    >
                      {/* Radio dot */}
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: isSelected
                          ? `2px solid ${meta.accentColor}`
                          : "2px solid rgba(255,255,255,0.2)",
                        background: isSelected ? meta.accentColor : "transparent",
                        flexShrink: 0,
                        marginTop: 1,
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        {isSelected && (
                          <div style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#fff",
                          }} />
                        )}
                      </div>

                      {/* Icon */}
                      <span style={{
                        color: isSelected ? meta.accentColor : "rgba(255,255,255,0.3)",
                        marginTop: 1,
                        flexShrink: 0,
                        transition: "color 0.15s ease",
                      }}>
                        {opt.icon}
                      </span>

                      {/* Text */}
                      <div>
                        <div style={{
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: isSelected ? "#F5F7FF" : "rgba(245,247,255,0.65)",
                          marginBottom: 2,
                          transition: "color 0.15s ease",
                        }}>
                          {opt.label}
                        </div>
                        <div style={{
                          fontSize: 11.5,
                          color: isSelected ? "rgba(245,247,255,0.55)" : "rgba(255,255,255,0.3)",
                          lineHeight: "1.45",
                          transition: "color 0.15s ease",
                        }}>
                          {opt.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}>
              <button
                onClick={onClose}
                disabled={launching}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: launching ? "not-allowed" : "pointer",
                  opacity: launching ? 0.5 : 1,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { if (!launching) e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              >
                Cancel
              </button>

              <button
                onClick={handleContinue}
                disabled={launching}
                style={{
                  padding: "9px 22px",
                  borderRadius: 8,
                  border: `1px solid ${meta.accentColor}80`,
                  background: launching
                    ? `${meta.accentColor}33`
                    : `linear-gradient(135deg, ${meta.accentColor}CC, ${meta.accentColor}99)`,
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: launching ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.2s ease",
                  boxShadow: launching ? "none" : `0 4px 16px ${meta.accentGlow}`,
                }}
                onMouseEnter={e => {
                  if (!launching) e.currentTarget.style.boxShadow = `0 6px 24px ${meta.accentGlow}, 0 0 0 1px ${meta.accentColor}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = launching ? "none" : `0 4px 16px ${meta.accentGlow}`;
                }}
              >
                {launching ? (
                  <>
                    {/* Spinner */}
                    <span style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "wfm-spin 0.7s linear infinite",
                      display: "inline-block",
                    }} />
                    Launching…
                  </>
                ) : (
                  <>
                    Open in Video Studio
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Keyframe animations ───────────────────────────────────────────────── */}
      <style>{`
        @keyframes wfm-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes wfm-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes wfm-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
