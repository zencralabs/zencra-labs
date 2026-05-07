"use client";

import { useEffect, useRef, useState } from "react";
import type { GenerationResult } from "./OutputWorkspace";

// Models available for retry
const RETRY_MODELS = [
  { value: "gpt-image-1",     label: "GPT Image 2"       },
  { value: "nano-banana-pro", label: "Nano Banana Pro"   },
  { value: "nano-banana-2",   label: "Nano Banana 2"     },
  { value: "seedream-v5",     label: "Seedream v5" },
  { value: "flux-kontext",    label: "Flux Kontext Max"  },
];

// ─────────────────────────────────────────────────────────────────────────────
// OutputPreviewModal — Instant-open preview overlay
// Opens the moment Render is clicked (before any API call returns).
// Stays open, updating in real-time as the generation status changes.
// ─────────────────────────────────────────────────────────────────────────────

interface OutputPreviewModalProps {
  isOpen: boolean;
  /** The generation being previewed — starts null (just clicked), fills in once API responds */
  generation: GenerationResult | null;
  /** How many outputs are in this batch (for "1 of N" indicator) */
  batchCount?: number;
  conceptTitle?: string;
  modelLabel?: string;
  onClose: () => void;
  onDownload: (id: string) => void;
  onVariation: (genId: string) => void;
  /** Retry with a different model — fires when user picks from the retry menu in failed state */
  onRetryWithModel?: (model: string) => void;
  /** Whether this generation has been published (local state, no DB change) */
  published?: boolean;
}

export default function OutputPreviewModal({
  isOpen,
  generation,
  batchCount = 1,
  conceptTitle,
  modelLabel,
  onClose,
  onDownload,
  onVariation,
  onRetryWithModel,
  published = false,
}: OutputPreviewModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPublished, setIsPublished] = useState(published);
  const [showRetryMenu, setShowRetryMenu] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLoading = !generation || generation.status === "queued" || generation.status === "processing";
  const isCompleted = generation?.status === "completed";
  const isFailed = generation?.status === "failed";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "pmFadeIn 0.18s ease",
      }}
    >
      <style>{`
        @keyframes pmFadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pmSlideUp   { from { opacity: 0; transform: translateY(28px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pmSpin      { to { transform: rotate(360deg); } }
        @keyframes pmSpinRev   { to { transform: rotate(-360deg); } }
        @keyframes pmPulse     { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
        @keyframes pmGlow      { 0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); } 50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.12); } }
        @keyframes pmBarSweep  { 0% { left: -60%; } 100% { left: 110%; } }
        @keyframes pmImgReveal { from { opacity: 0; transform: scale(1.03); } to { opacity: 1; transform: scale(1); } }
        .pm-action-btn:hover:not([disabled]) { background: rgba(255,255,255,0.09) !important; color: #fff !important; }
        .pm-action-btn[disabled] { opacity: 0.3; cursor: default; }
        .pm-close:hover { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
        .pm-dl:hover:not([disabled]) { background: rgba(255,255,255,0.09) !important; color: #fff !important; border-color: rgba(255,255,255,0.2) !important; }
        .pm-dl[disabled] { opacity: 0.28; cursor: default; }
        .pm-pub:hover { border-color: rgba(251,191,36,0.38) !important; background: rgba(251,191,36,0.12) !important; color: rgba(251,191,36,0.85) !important; }
      `}</style>

      {/* Modal card */}
      <div
        style={{
          width: "min(860px, calc(100vw - 48px))",
          background: "#08101F",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: 20,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
          animation: "pmSlideUp 0.24s cubic-bezier(0.16,1,0.3,1)",
        }}
      >

        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}
        >
          {/* Left: status + context */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {/* Status indicator */}
            {isLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#3B82F6",
                    animation: "pmPulse 1.2s ease-in-out infinite",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: "rgba(147,197,253,0.9)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  Rendering
                </span>
              </div>
            )}
            {isCompleted && (
              <span style={{ fontSize: 13, color: "#34d399", fontWeight: 600, flexShrink: 0 }}>
                ✓ Complete
              </span>
            )}
            {isFailed && (
              <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600, flexShrink: 0 }}>
                ⚠ Failed
              </span>
            )}

            {/* Concept + model context chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {conceptTitle && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(167,176,197,0.7)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    padding: "2px 8px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 200,
                  }}
                >
                  {conceptTitle}
                </span>
              )}
              {modelLabel && (
                <span style={{ fontSize: 11, color: "rgba(107,130,170,0.55)", fontWeight: 500, whiteSpace: "nowrap" }}>
                  {modelLabel}
                </span>
              )}
              {batchCount > 1 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(120,140,180,0.5)",
                    fontWeight: 600,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 5,
                    padding: "1px 7px",
                    whiteSpace: "nowrap",
                  }}
                >
                  1 of {batchCount}
                </span>
              )}
            </div>
          </div>

          {/* Close */}
          <button
            className="pm-close"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.45)",
              cursor: "pointer",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.12s ease",
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Image / Loading area ── */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 5",
            maxHeight: "calc(100vh - 230px)",
            minHeight: 240,
            background: "#050816",
            overflow: "hidden",
            flexShrink: 1,
          }}
        >
          {/* ── LOADING state — premium dual-ring animation ── */}
          {isLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 24,
                background: "radial-gradient(ellipse at 50% 60%, #0D1A3A 0%, #050816 68%)",
              }}
            >
              {/* Spinner rings */}
              <div style={{ position: "relative", width: 68, height: 68 }}>
                {/* Outer glow */}
                <div
                  style={{
                    position: "absolute",
                    inset: -4,
                    borderRadius: "50%",
                    animation: "pmGlow 2s ease-in-out infinite",
                  }}
                />
                {/* Outer ring */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "2px solid transparent",
                    borderTopColor: "#3B82F6",
                    borderRightColor: "rgba(99,102,241,0.45)",
                    animation: "pmSpin 0.9s linear infinite",
                  }}
                />
                {/* Inner ring */}
                <div
                  style={{
                    position: "absolute",
                    inset: 14,
                    borderRadius: "50%",
                    border: "1.5px solid transparent",
                    borderTopColor: "rgba(139,92,246,0.65)",
                    borderBottomColor: "rgba(59,130,246,0.25)",
                    animation: "pmSpinRev 1.35s linear infinite",
                  }}
                />
                {/* Center dot */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: "#3B82F6",
                      animation: "pmPulse 1.4s ease-in-out infinite",
                      boxShadow: "0 0 12px rgba(59,130,246,0.6)",
                    }}
                  />
                </div>
              </div>

              {/* Text */}
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: "rgba(180,210,255,0.9)",
                    marginBottom: 7,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Generating your visual…
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(100,130,175,0.65)",
                    maxWidth: 290,
                    lineHeight: 1.55,
                  }}
                >
                  Typically 15–45 seconds depending on model and quality
                </div>
              </div>

              {/* Progress shimmer bar */}
              <div
                style={{
                  width: 200,
                  height: 2,
                  borderRadius: 99,
                  background: "rgba(37,99,235,0.18)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "-60%",
                    width: "60%",
                    height: "100%",
                    background: "linear-gradient(90deg, transparent, #3B82F6 50%, rgba(139,92,246,0.7), transparent)",
                    animation: "pmBarSweep 1.7s ease-in-out infinite",
                    borderRadius: 99,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── FAILED state ── */}
          {isFailed && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                background: "#050816",
              }}
            >
              <span style={{ fontSize: 36, opacity: 0.45 }}>⚠</span>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, color: "rgba(248,113,113,0.85)", fontWeight: 600, marginBottom: 6 }}>
                  Generation failed
                </div>
                <div style={{ fontSize: 13, color: "rgba(110,130,165,0.6)", maxWidth: 260, lineHeight: 1.5 }}>
                  This can happen with complex prompts or provider timeouts.
                </div>
              </div>

              {/* Retry with another model picker */}
              {onRetryWithModel && (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowRetryMenu((v) => !v)}
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: "1px solid rgba(120,160,255,0.3)",
                      background: "rgba(37,99,235,0.12)",
                      color: "rgba(147,197,253,0.9)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.14s ease",
                    }}
                  >
                    Try another model
                    <span style={{ fontSize: 10, transform: showRetryMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                  </button>
                  {showRetryMenu && (
                    <>
                      <div
                        style={{ position: "fixed", inset: 0, zIndex: 1090 }}
                        onClick={() => setShowRetryMenu(false)}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: "calc(100% + 8px)",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#0A1120",
                          border: "1px solid rgba(120,160,255,0.18)",
                          borderRadius: 12,
                          overflow: "hidden",
                          zIndex: 1095,
                          minWidth: 180,
                          boxShadow: "0 20px 48px rgba(0,0,0,0.85)",
                        }}
                      >
                        <div style={{ padding: "8px 14px 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(120,140,180,0.5)", textTransform: "uppercase" }}>
                          Select model
                        </div>
                        {RETRY_MODELS.filter((m) => m.value !== generation?.model).map((m) => (
                          <button
                            key={m.value}
                            onClick={() => {
                              setShowRetryMenu(false);
                              onRetryWithModel(m.value);
                              onClose();
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              display: "block",
                              padding: "9px 14px",
                              border: "none",
                              background: "transparent",
                              color: "rgba(245,247,255,0.85)",
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "background 0.1s ease",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,99,235,0.15)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── COMPLETED image ── */}
          {isCompleted && generation?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={generation.url}
              alt="Generated output"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                background: "#050816",
                animation: "pmImgReveal 0.35s ease",
              }}
            />
          )}
        </div>

        {/* ── Action bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(5,8,22,0.5)",
            flexShrink: 0,
            gap: 12,
          }}
        >
          {/* Left: Like + Variations */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="pm-action-btn"
              disabled={!isCompleted}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontWeight: 600,
                cursor: isCompleted ? "pointer" : "default",
                transition: "all 0.12s ease",
              }}
            >
              <span>♡</span> Like
            </button>

            <button
              className="pm-action-btn"
              disabled={!isCompleted || !generation?.id}
              onClick={() => generation?.id && onVariation(generation.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontWeight: 600,
                cursor: (isCompleted && generation?.id) ? "pointer" : "default",
                transition: "all 0.12s ease",
              }}
            >
              <span>⟳</span> Variations
            </button>
          </div>

          {/* Right: Download + Publish */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="pm-dl"
              disabled={!isCompleted || !generation?.url}
              onClick={() => generation?.id && onDownload(generation.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.65)",
                fontSize: 13,
                fontWeight: 600,
                cursor: (isCompleted && generation?.url) ? "pointer" : "default",
                transition: "all 0.12s ease",
              }}
            >
              ↓ Download
            </button>

            <button
              className={isPublished ? undefined : "pm-pub"}
              onClick={() => setIsPublished(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 9,
                border: isPublished
                  ? "1px solid rgba(52,211,153,0.45)"
                  : "1px solid rgba(251,191,36,0.2)",
                background: isPublished
                  ? "rgba(5,150,105,0.18)"
                  : "rgba(251,191,36,0.05)",
                color: isPublished
                  ? "rgba(52,211,153,0.9)"
                  : "rgba(251,191,36,0.48)",
                fontSize: 13,
                fontWeight: 600,
                cursor: isPublished ? "default" : "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {isPublished ? "✓ Published" : "↑ Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
