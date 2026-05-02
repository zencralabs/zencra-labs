"use client";

/**
 * OutputCard — single generation output in the right OutputPanel.
 *
 * States:
 *   processing  → shimmer skeleton + spinner
 *   completed   → image thumbnail + actions (download, fullscreen)
 *   failed      → error state with message
 *
 * Mode badge: "Explore" | "Locked" shown in corner.
 */

import { useState } from "react";
import type { CDGenerationOutput } from "@/lib/creative-director/store";

// ─────────────────────────────────────────────────────────────────────────────

interface OutputCardProps {
  output: CDGenerationOutput;
}

export function OutputCard({ output }: OutputCardProps) {
  const [imgError, setImgError] = useState(false);

  const isProcessing = output.status === "processing";
  const isFailed     = output.status === "failed";
  const isCompleted  = output.status === "completed";
  const hasUrl       = !!output.url && !imgError;

  return (
    <div
      style={{
        position:     "relative",
        borderRadius: 8,
        overflow:     "hidden",
        background:   "rgba(255,255,255,0.03)",
        border:       `1px solid ${
          isFailed     ? "rgba(239,68,68,0.2)"  :
          isCompleted  ? "rgba(255,255,255,0.07)" :
                         "rgba(139,92,246,0.2)"
        }`,
        aspectRatio:  "1 / 1",
        flexShrink:   0,
      }}
    >
      {/* ── Processing skeleton ─────────────────────────────────────────── */}
      {isProcessing && (
        <div
          style={{
            position:   "absolute",
            inset:      0,
            background: "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)",
            backgroundSize: "200% 100%",
            animation:  "shimmer 1.4s ease-in-out infinite",
            display:    "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Spinner />
        </div>
      )}

      {/* ── Failed state ────────────────────────────────────────────────── */}
      {isFailed && (
        <div
          style={{
            position:       "absolute",
            inset:          0,
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            gap:            8,
            padding:        12,
          }}
        >
          <span style={{ fontSize: 20 }}>⚠</span>
          <p
            style={{
              fontSize:   10,
              color:      "rgba(239,68,68,0.8)",
              fontFamily: "var(--font-sans)",
              textAlign:  "center",
              margin:     0,
              lineHeight: 1.4,
            }}
          >
            {output.error_message ?? "Generation failed"}
          </p>
        </div>
      )}

      {/* ── Completed image ──────────────────────────────────────────────── */}
      {isCompleted && hasUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={output.url!}
          alt="Generated output"
          onError={() => setImgError(true)}
          style={{
            width:      "100%",
            height:     "100%",
            objectFit:  "cover",
            display:    "block",
          }}
        />
      )}

      {isCompleted && !hasUrl && (
        <div
          style={{
            position:       "absolute",
            inset:          0,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)" }}>
            No preview
          </span>
        </div>
      )}

      {/* ── Mode badge ────────────────────────────────────────────────────── */}
      <div
        style={{
          position:   "absolute",
          top:        6,
          left:       6,
          fontSize:   9,
          fontFamily: "var(--font-sans)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color:      output.mode === "locked" ? "rgba(251,191,36,0.9)" : "rgba(139,92,246,0.9)",
          background: output.mode === "locked" ? "rgba(251,191,36,0.1)" : "rgba(139,92,246,0.1)",
          border:     `1px solid ${output.mode === "locked" ? "rgba(251,191,36,0.2)" : "rgba(139,92,246,0.2)"}`,
          borderRadius: 4,
          padding:    "2px 6px",
          backdropFilter: "blur(4px)",
        }}
      >
        {output.mode === "locked" ? "🔒" : "◎"} {output.mode}
      </div>

      {/* ── Action overlay (hover) ─────────────────────────────────────── */}
      {isCompleted && hasUrl && (
        <HoverActions url={output.url!} />
      )}

      {/* ── Cost badge ───────────────────────────────────────────────────── */}
      {isCompleted && (
        <div
          style={{
            position:   "absolute",
            bottom:     6,
            right:      6,
            fontSize:   9,
            color:      "rgba(251,191,36,0.7)",
            fontFamily: "var(--font-sans)",
            background: "rgba(0,0,0,0.5)",
            borderRadius: 4,
            padding:    "2px 6px",
            backdropFilter: "blur(4px)",
          }}
        >
          {output.credit_cost} cr
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function HoverActions({ url }: { url: string }) {
  const [visible, setVisible] = useState(false);

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
    } catch {
      // silent
    }
  };

  return (
    <div
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      style={{
        position:       "absolute",
        inset:          0,
        background:     visible ? "rgba(0,0,0,0.55)" : "transparent",
        transition:     "background 0.2s",
        display:        "flex",
        alignItems:     "flex-end",
        justifyContent: "flex-end",
        padding:        6,
        gap:            4,
      }}
    >
      {visible && (
        <>
          <IconBtn title="Download" onClick={handleDownload}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3 5l3 3 3-3M2 11h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconBtn>
          <IconBtn title="Open full size" onClick={() => window.open(url, "_blank")}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M5 2H2v8h8V7M7 1h4v4M11 1 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconBtn>
        </>
      )}
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background:   "rgba(255,255,255,0.1)",
        border:       "1px solid rgba(255,255,255,0.15)",
        borderRadius: 5,
        color:        "rgba(255,255,255,0.85)",
        cursor:       "pointer",
        padding:      "5px 5px",
        display:      "flex",
        alignItems:   "center",
        backdropFilter: "blur(6px)",
      }}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width:  28,
        height: 28,
        borderRadius: "50%",
        border: "2px solid rgba(139,92,246,0.2)",
        borderTopColor: "rgba(139,92,246,0.8)",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
