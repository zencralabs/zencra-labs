"use client";

/**
 * OutputCard — premium generation output card for the right OutputPanel.
 *
 * States:
 *   processing  → animated shimmer skeleton + spinner
 *   completed   → image thumbnail + hover overlay with actions
 *   failed      → error state with message
 *
 * isBest: shows "✦ Best" badge on first completed card in Locked mode.
 * Hover overlay: gradient veil + Download / Open icons (24px buttons).
 */

import { useState } from "react";
import type { CDGenerationOutput } from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

interface OutputCardProps {
  output: CDGenerationOutput;
  isBest?: boolean;
}

export function OutputCard({ output, isBest = false }: OutputCardProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered,  setHovered]  = useState(false);

  const isProcessing = output.status === "processing";
  const isFailed     = output.status === "failed";
  const isCompleted  = output.status === "completed";
  const hasUrl       = !!output.url && !imgError;

  const borderColor = isFailed
    ? "rgba(239,68,68,0.25)"
    : isCompleted && isBest
      ? "rgba(251,191,36,0.45)"
      : isCompleted
        ? "rgba(255,255,255,0.1)"
        : "rgba(139,92,246,0.3)";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position:     "relative",
        borderRadius: 12,
        overflow:     "hidden",
        background:   "rgba(12,10,16,0.9)",
        border:       `1px solid ${borderColor}`,
        aspectRatio:  "1 / 1",
        flexShrink:   0,
        transition:   "border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease",
        transform:    hovered && isCompleted ? "scale(1.015)" : "scale(1)",
        boxShadow:    hovered && isCompleted
          ? (isBest
              ? "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(251,191,36,0.25)"
              : "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.15)")
          : "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {/* ── Processing: shimmer skeleton ─────────────────────────────────── */}
      {isProcessing && (
        <div style={{
          position:       "absolute",
          inset:          0,
          background:     "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)",
          backgroundSize: "200% 100%",
          animation:      "cd-shimmer 1.6s ease-in-out infinite",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            10,
        }}>
          <Spinner />
          <span style={{
            fontSize:   9,
            color:      "rgba(139,92,246,0.55)",
            fontFamily: "var(--font-sans)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            Generating…
          </span>
        </div>
      )}

      {/* ── Failed state ─────────────────────────────────────────────────── */}
      {isFailed && (
        <div style={{
          position:       "absolute",
          inset:          0,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            8,
          padding:        16,
          background:     "rgba(239,68,68,0.04)",
        }}>
          <span style={{ fontSize: 22, opacity: 0.7 }}>⚠</span>
          <p style={{
            fontSize:   10,
            color:      "rgba(239,68,68,0.75)",
            fontFamily: "var(--font-sans)",
            textAlign:  "center",
            margin:     0,
            lineHeight: 1.5,
          }}>
            {output.error_message ?? "Generation failed"}
          </p>
        </div>
      )}

      {/* ── Completed: image ─────────────────────────────────────────────── */}
      {isCompleted && hasUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={output.url!}
          alt="Generated output"
          onError={() => setImgError(true)}
          style={{
            width:     "100%",
            height:    "100%",
            objectFit: "cover",
            display:   "block",
            transition: "opacity 0.3s ease",
            opacity:   hovered ? 0.92 : 1,
          }}
        />
      )}

      {isCompleted && !hasUrl && (
        <div style={{
          position:       "absolute",
          inset:          0,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-sans)" }}>
            No preview
          </span>
        </div>
      )}

      {/* ── Best badge ────────────────────────────────────────────────────── */}
      {isBest && isCompleted && (
        <div style={{
          position:      "absolute",
          top:           8,
          left:          8,
          display:       "flex",
          alignItems:    "center",
          gap:           4,
          fontSize:      9,
          fontFamily:    "var(--font-sans)",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color:         "rgba(251,191,36,1)",
          background:    "rgba(10,8,0,0.75)",
          border:        "1px solid rgba(251,191,36,0.4)",
          borderRadius:  6,
          padding:       "3px 8px",
          backdropFilter: "blur(8px)",
          fontWeight:    700,
          boxShadow:     "0 0 12px rgba(251,191,36,0.2)",
        }}>
          <span style={{ fontSize: 8 }}>✦</span>
          Best
        </div>
      )}

      {/* ── Mode badge (non-best cards) ───────────────────────────────────── */}
      {!isBest && (
        <div style={{
          position:      "absolute",
          top:           8,
          left:          8,
          fontSize:      8,
          fontFamily:    "var(--font-sans)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color:         output.mode === "locked" ? "rgba(251,191,36,0.8)" : "rgba(139,92,246,0.8)",
          background:    output.mode === "locked" ? "rgba(10,8,0,0.7)" : "rgba(10,8,18,0.7)",
          border:        `1px solid ${output.mode === "locked" ? "rgba(251,191,36,0.2)" : "rgba(139,92,246,0.2)"}`,
          borderRadius:  5,
          padding:       "2px 7px",
          backdropFilter: "blur(6px)",
        }}>
          {output.mode === "locked" ? "🔒" : "◎"} {output.mode}
        </div>
      )}

      {/* ── Creative Director source badge ───────────────────────────────── */}
      <div style={{
        position:      "absolute",
        bottom:        8,
        left:          8,
        fontSize:      8,
        fontFamily:    "var(--font-sans)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color:         "rgba(139,92,246,0.7)",
        background:    "rgba(10,8,18,0.75)",
        border:        "1px solid rgba(139,92,246,0.18)",
        borderRadius:  5,
        padding:       "2px 6px",
        backdropFilter: "blur(6px)",
        display:       "flex",
        alignItems:    "center",
        gap:           4,
      }}>
        <span style={{ fontSize: 7 }}>✦</span>
        CD
      </div>

      {/* ── Credit cost badge ─────────────────────────────────────────────── */}
      {isCompleted && (
        <div style={{
          position:      "absolute",
          bottom:        8,
          right:         8,
          fontSize:      9,
          color:         "rgba(251,191,36,0.65)",
          fontFamily:    "var(--font-sans)",
          background:    "rgba(0,0,0,0.6)",
          borderRadius:  5,
          padding:       "3px 7px",
          backdropFilter: "blur(6px)",
          letterSpacing: "0.02em",
        }}>
          {output.credit_cost} cr
        </div>
      )}

      {/* ── Hover action overlay ─────────────────────────────────────────── */}
      {isCompleted && hasUrl && (
        <HoverActions url={output.url!} visible={hovered} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function HoverActions({ url, visible }: { url: string; visible: boolean }) {
  const handleDownload = async () => {
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = href;
      a.download = `cd-output-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(href);
    } catch { /* silent */ }
  };

  return (
    <div style={{
      position:       "absolute",
      inset:          0,
      background:     visible
        ? "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)"
        : "transparent",
      transition:     "background 0.25s ease",
      display:        "flex",
      alignItems:     "flex-end",
      justifyContent: "center",
      padding:        "0 0 12px",
      gap:            8,
      pointerEvents:  visible ? "auto" : "none",
    }}>
      {visible && (
        <>
          <ActionBtn title="Download" onClick={handleDownload}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 6l3 3 3-3M2 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download
          </ActionBtn>
          <ActionBtn title="Open full size" onClick={() => window.open(url, "_blank")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M6 2H2v10h10V8M8 1h5v5M13 1 7.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Open
          </ActionBtn>
        </>
      )}
    </div>
  );
}

function ActionBtn({ title, onClick, children }: {
  title:    string;
  onClick:  () => void;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:    hov ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.55)",
        border:        "1px solid rgba(255,255,255,0.2)",
        borderRadius:  8,
        color:         "rgba(255,255,255,0.9)",
        cursor:        "pointer",
        padding:       "6px 12px",
        display:       "flex",
        alignItems:    "center",
        gap:           6,
        fontSize:      10,
        fontFamily:    "var(--font-sans)",
        backdropFilter: "blur(10px)",
        transition:    "background 0.15s ease",
        letterSpacing: "0.03em",
      }}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div style={{
      width:          32,
      height:         32,
      borderRadius:   "50%",
      border:         "2px solid rgba(139,92,246,0.15)",
      borderTopColor: "rgba(139,92,246,0.7)",
      animation:      "cd-spin 0.8s linear infinite",
    }} />
  );
}
