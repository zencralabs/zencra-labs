"use client";

/**
 * CDOnboardingOverlay — Welcome card shown on first visit to Creative Director.
 *
 * A centered glassmorphism card explaining the 3-step workflow.
 * The full canvas stays interactive beneath (pointer-events: none on overlay root).
 * The card itself uses pointer-events: auto so the button works.
 *
 * Dismissed by: "Start Directing" button, Escape key, or first user interaction
 * (SceneCanvas calls onDismiss when the first element or frame is added).
 *
 * CDMiniFlow.tsx is kept separately for a future "How it works" help modal.
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
@keyframes cd-ob-card-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.94) translateY(10px); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1)    translateY(0);    }
}
`;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CDOnboardingOverlayProps {
  onDismiss: () => void;
}

// ─── Step data ─────────────────────────────────────────────────────────────────

const QUICKSTART_STEPS = [
  {
    label: "Add subjects and elements",
    hint:  "Double-click canvas · Right-click for menu",
  },
  {
    label: "Add a Generation Frame",
    hint:  "Click + Frame in the toolbar above",
  },
  {
    label: "Connect and generate",
    hint:  "Drag node handles → frame · hit Generate",
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function CDOnboardingOverlay({ onDismiss }: CDOnboardingOverlayProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem("cd_onboarding_seen", "1");
    } catch {
      // Private browsing — sessionStorage blocked; fail silently
    }
    setDismissing(true);
    setTimeout(onDismiss, 280);
  }, [onDismiss]);

  // Escape key dismisses
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
          background:           "rgba(6,5,10,0.62)",
          backdropFilter:       "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          pointerEvents:        "none",
          animation:            dismissing
            ? "cd-ob-overlay-out 0.28s ease both"
            : "cd-ob-overlay-in  0.40s ease both",
        }}
      >
        {/* ── Centered welcome card — isolated interactive island ─────────────── */}
        <div
          style={{
            position:       "absolute",
            top:            "50%",
            left:           "50%",
            transform:      "translate(-50%, -50%)",
            pointerEvents:  "auto",
            width:          316,
            background:     "rgba(10,8,20,0.94)",
            border:         "1px solid rgba(139,92,246,0.22)",
            borderRadius:   20,
            padding:        "28px 28px 24px",
            boxShadow: [
              "0 32px 80px rgba(0,0,0,0.72)",
              "0 0 0 1px rgba(139,92,246,0.08)",
              "inset 0 0 40px rgba(139,92,246,0.04)",
            ].join(", "),
            backdropFilter: "blur(28px)",
            animation:      dismissing
              ? "cd-ob-overlay-out 0.22s ease both"
              : "cd-ob-card-in 0.52s cubic-bezier(0.16,1,0.3,1) 0.06s both",
            display:        "flex",
            flexDirection:  "column",
            gap:            20,
          }}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span
              style={{
                fontSize:   22,
                color:      "rgba(139,92,246,0.9)",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ✦
            </span>
            <div>
              <p
                style={{
                  fontFamily:    "var(--font-syne), sans-serif",
                  fontSize:      16,
                  fontWeight:    700,
                  color:         "rgba(255,255,255,0.93)",
                  margin:        0,
                  letterSpacing: "0.01em",
                  lineHeight:    1.2,
                }}
              >
                Creative Director
              </p>
              <p
                style={{
                  fontFamily:    "var(--font-familjen-grotesk), sans-serif",
                  fontSize:      11,
                  color:         "rgba(255,255,255,0.36)",
                  margin:        "3px 0 0",
                  letterSpacing: "0.04em",
                }}
              >
                Build your scene in three steps
              </p>
            </div>
          </div>

          {/* ── Step list ──────────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {QUICKSTART_STEPS.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {/* Step number badge */}
                <div
                  style={{
                    width:          26,
                    height:         26,
                    borderRadius:   8,
                    background:     "rgba(139,92,246,0.12)",
                    border:         "1px solid rgba(139,92,246,0.24)",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    fontSize:       10,
                    fontFamily:     "var(--font-syne), sans-serif",
                    fontWeight:     700,
                    color:          "rgba(139,92,246,0.85)",
                    flexShrink:     0,
                    letterSpacing:  "0.02em",
                  }}
                >
                  {i + 1}
                </div>
                {/* Step text */}
                <div>
                  <p
                    style={{
                      fontFamily:    "var(--font-familjen-grotesk), sans-serif",
                      fontSize:      13,
                      fontWeight:    500,
                      color:         "rgba(255,255,255,0.84)",
                      margin:        "0 0 2px",
                      lineHeight:    1.3,
                      letterSpacing: "0.01em",
                    }}
                  >
                    {step.label}
                  </p>
                  <p
                    style={{
                      fontFamily:    "var(--font-familjen-grotesk), sans-serif",
                      fontSize:      11,
                      color:         "rgba(255,255,255,0.32)",
                      margin:        0,
                      letterSpacing: "0.02em",
                      lineHeight:    1.45,
                    }}
                  >
                    {step.hint}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── CTA ────────────────────────────────────────────────────────── */}
          <button
            onClick={handleDismiss}
            style={{
              width:         "100%",
              padding:       "10px 0",
              background:    "rgba(139,92,246,0.16)",
              border:        "1px solid rgba(139,92,246,0.32)",
              borderRadius:  10,
              color:         "rgba(139,92,246,1)",
              fontSize:      13,
              fontFamily:    "var(--font-syne), sans-serif",
              fontWeight:    600,
              letterSpacing: "0.05em",
              cursor:        "pointer",
              transition:    "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background  = "rgba(139,92,246,0.28)";
              e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)";
              e.currentTarget.style.color       = "rgba(255,255,255,0.95)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background  = "rgba(139,92,246,0.16)";
              e.currentTarget.style.borderColor = "rgba(139,92,246,0.32)";
              e.currentTarget.style.color       = "rgba(139,92,246,1)";
            }}
          >
            Start Directing
          </button>
        </div>
      </div>
    </>
  );
}
