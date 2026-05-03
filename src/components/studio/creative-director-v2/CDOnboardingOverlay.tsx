"use client";

/**
 * CDOnboardingOverlay — Phase 1 interactive guided onboarding for Creative Director.
 *
 * Instruction layer only — canvas is fully interactive beneath.
 *   pointer-events: none on root div.
 *   pointer-events: auto on Skip button only.
 *
 * step prop:
 *   1 = guiding: shows instruction text, waits for user to drag subject into frame.
 *   2 = success: auto-triggers fade-out and calls onDismiss after 280ms.
 *
 * CDMiniFlow.tsx is kept separately for "How it works" / help modal future use.
 */

import { useState, useEffect, useCallback } from "react";

// ─── Keyframes ─────────────────────────────────────────────────────────────────

const OVERLAY_KEYFRAMES = `
@keyframes cd-ob-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes cd-ob-overlay-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes cd-ob-content-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
`;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CDOnboardingOverlayProps {
  onDismiss: () => void;
  step:      number;   // 1=guiding, 2=success → auto-dismiss
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CDOnboardingOverlay({ onDismiss, step }: CDOnboardingOverlayProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem("cd_onboarding_seen", "1");
    } catch {
      // Private browsing mode — sessionStorage may be blocked; fail silently
    }
    setDismissing(true);
    setTimeout(onDismiss, 280);
  }, [onDismiss]);

  // Auto-dismiss when subject is successfully dropped into frame (step 2)
  useEffect(() => {
    if (step === 2 && !dismissing) {
      handleDismiss();
    }
  }, [step, dismissing, handleDismiss]);

  // Escape key skips onboarding
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDismiss]);

  return (
    <>
      <style>{OVERLAY_KEYFRAMES}</style>

      {/* ── Full-screen overlay — pointer-events: none so canvas stays interactive ── */}
      <div
        style={{
          position:             "absolute",
          inset:                0,
          zIndex:               60,
          background:           "rgba(6,5,10,0.52)",
          backdropFilter:       "blur(1.5px)",
          WebkitBackdropFilter: "blur(1.5px)",
          pointerEvents:        "none",   // canvas receives all events
          animation:            dismissing
            ? "cd-ob-overlay-out 0.28s ease both"
            : "cd-ob-overlay-in  0.40s ease both",
        }}
      >
        {/* ── Instruction block — top center ─────────────────────────────── */}
        <div
          style={{
            position:  "absolute",
            top:       32,
            left:      "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            animation: "cd-ob-content-in 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both",
          }}
        >
          <h2
            style={{
              fontFamily:    "var(--font-syne), sans-serif",
              fontSize:      18,
              fontWeight:    600,
              letterSpacing: "0.01em",
              color:         "rgba(255,255,255,0.90)",
              margin:        "0 0 6px",
              lineHeight:    1.2,
              whiteSpace:    "nowrap",
            }}
          >
            Direct the Frame
          </h2>
          <p
            style={{
              fontFamily:    "var(--font-familjen-grotesk), sans-serif",
              fontSize:      13,
              color:         "rgba(255,255,255,0.42)",
              margin:        0,
              lineHeight:    1.5,
              letterSpacing: "0.01em",
              whiteSpace:    "nowrap",
            }}
          >
            Drag a subject into the frame to begin.
          </p>
        </div>

        {/* ── Skip — ONLY interactive element (isolated pointer-events: auto) ── */}
        <button
          onClick={handleDismiss}
          style={{
            position:      "absolute",
            top:           16,
            right:         20,
            pointerEvents: "auto",   // isolated island of interactivity
            background:    "transparent",
            border:        "1px solid rgba(255,255,255,0.12)",
            borderRadius:  8,
            color:         "rgba(255,255,255,0.32)",
            fontSize:      11,
            fontFamily:    "var(--font-sans)",
            letterSpacing: "0.05em",
            cursor:        "pointer",
            padding:       "5px 12px",
            lineHeight:    1,
            transition:    "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background  = "rgba(255,255,255,0.07)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
            e.currentTarget.style.color       = "rgba(255,255,255,0.60)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background  = "transparent";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            e.currentTarget.style.color       = "rgba(255,255,255,0.32)";
          }}
        >
          Skip
        </button>
      </div>
    </>
  );
}
