"use client";

/**
 * NextStepPanel — Fixed right-side panel showing context-aware action cards.
 *
 * Layout: `position: fixed`, right side of viewport, sits below the nav bar.
 * Width: 360px.
 * Visibility: slides in when `activeStep` is non-null (i.e., after a generation).
 *
 * Card map (only fully-wired actions appear):
 *   image  → variation
 *   video  → variation
 *   audio  → variation
 *   fcs    → variation
 *
 * When a card is triggered:
 *   variation → emits onVariation(step) back to the parent studio page,
 *               which re-runs generate() with the same settings.
 *
 * UX rule: no text saying "workflow", "step", "pipeline".
 * UI labels use: "Create", "Continue", "Use this".
 */

import { useState, useEffect } from "react";
import { useFlowStore } from "@/lib/flow/store";
import type { FlowStep, FlowStudioType } from "@/lib/flow/store";
import { ActionCard, ACTION_DEFINITIONS } from "./ActionCard";
import type { ActionId } from "./ActionCard";

// ─────────────────────────────────────────────────────────────────────────────
// Card map — per studio type, ordered list of action IDs to render
// Only include actions whose backend is fully wired.
// ─────────────────────────────────────────────────────────────────────────────

const CARD_MAP: Record<FlowStudioType, ActionId[]> = {
  image:  ["variation"],
  video:  ["variation"],
  audio:  ["variation"],
  fcs:    ["variation"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Studio display labels (no internal terminology)
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_LABEL: Record<FlowStudioType, string> = {
  image:  "Image",
  video:  "Video",
  audio:  "Audio",
  fcs:    "Cinema",
};

const STUDIO_ICON: Record<FlowStudioType, string> = {
  image:  "🎨",
  video:  "🎬",
  audio:  "🎙️",
  fcs:    "🎞️",
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface NextStepPanelProps {
  /**
   * Called when the user clicks "Create Variation".
   * The parent studio page handles re-running generate() with the step's settings.
   */
  onVariation: (step: FlowStep) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultPreview — small image/video thumbnail at the top of the panel
// ─────────────────────────────────────────────────────────────────────────────

function ResultPreview({ step }: { step: FlowStep }) {
  const url = step.resultUrl;
  if (!url) return null;

  const isVideo = step.studioType === "video" || step.studioType === "fcs";
  const isAudio = step.studioType === "audio";

  if (isAudio) {
    return (
      <div style={{
        width: "100%",
        height: 72,
        borderRadius: 10,
        background: "rgba(198,255,0,0.06)",
        border: "1px solid rgba(198,255,0,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 24 }}>🎙️</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Audio generated</span>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div style={{
        width: "100%",
        aspectRatio: "16/9",
        borderRadius: 10,
        overflow: "hidden",
        background: "#0A0A12",
        marginBottom: 16,
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <video
          src={url}
          muted
          loop
          autoPlay
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }

  // Image
  return (
    <div style={{
      width: "100%",
      borderRadius: 10,
      overflow: "hidden",
      background: "#0A0A12",
      marginBottom: 16,
      border: "1px solid rgba(255,255,255,0.08)",
      maxHeight: 220,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={step.prompt.slice(0, 60)}
        style={{
          width: "100%",
          maxHeight: 220,
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NextStepPanel
// ─────────────────────────────────────────────────────────────────────────────

export default function NextStepPanel({ onVariation }: NextStepPanelProps) {
  const { activeStep } = useFlowStore();

  // dismissed = user manually closed the panel; resets whenever a new step arrives
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed when a new generation completes (activeStep.id changes)
  useEffect(() => {
    if (activeStep) setDismissed(false);
  }, [activeStep?.id]);

  // Panel visible: step exists AND user hasn't dismissed it
  // NOTE: no status check — rely only on activeStep presence + dismissed flag
  const panelVisible = !!activeStep && !dismissed;

  function handleAction(actionId: ActionId, step: FlowStep) {
    if (actionId === "variation") {
      onVariation(step);
    }
  }

  return (
    <>
      {/* ── Main panel ────────────────────────────────────────────────────── */}
      <div
        style={{
          position:       "fixed",
          top:            64,
          right:          0,
          bottom:         0,
          width:          360,
          zIndex:         1000,
          background:     "rgba(6,6,10,0.97)",
          backdropFilter: "blur(20px)",
          borderLeft:     "1px solid rgba(255,255,255,0.07)",
          display:        "flex",
          flexDirection:  "column",
          fontFamily:     "var(--font-body, system-ui, sans-serif)",
          color:          "#fff",
          transform:      panelVisible ? "translateX(0)" : "translateX(100%)",
          opacity:        panelVisible ? 1 : 0,
          transition:     "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease",
          pointerEvents:  panelVisible ? "all" : "none",
          overflow:       "hidden",
        }}
      >
        {activeStep && (
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}>

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{STUDIO_ICON[activeStep.studioType]}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                  {STUDIO_LABEL[activeStep.studioType]}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.2)",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}>
                  What&apos;s next?
                </span>
                {/* Close button */}
                <button
                  onClick={() => setDismissed(true)}
                  title="Dismiss panel"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.25)", fontSize: 15, lineHeight: 1,
                    padding: "3px 4px", borderRadius: 4, transition: "color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
                >✕</button>
              </div>
            </div>

            {/* ── Result preview ──────────────────────────────────────────── */}
            <ResultPreview step={activeStep} />

            {/* ── Prompt snippet ──────────────────────────────────────────── */}
            {activeStep.prompt && (
              <p style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                lineHeight: 1.5,
                marginBottom: 16,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {activeStep.prompt}
              </p>
            )}

            {/* ── Divider ─────────────────────────────────────────────────── */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 16 }} />

            {/* ── Action cards ────────────────────────────────────────────── */}
            <p style={{
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255,255,255,0.25)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}>
              Continue creating
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(CARD_MAP[activeStep.studioType] ?? []).map((actionId) => {
                const def = ACTION_DEFINITIONS[actionId];
                return (
                  <ActionCard
                    key={actionId}
                    action={def}
                    step={activeStep}
                    onTrigger={handleAction}
                  />
                );
              })}
            </div>

          </div>
        )}
      </div>

      {/* ── Reopen tab ─────────────────────────────────────────────────────
           Shown whenever activeStep exists AND panel was dismissed.
           Logic is purely panel-state — no dependency on zoomLevel,
           hideHoverActions, or any other gallery-level state.
           zIndex 1000: above gallery (40), prompt bar (50), navbar context. */}
      {activeStep && dismissed && (
        <button
          onClick={() => setDismissed(false)}
          title="Reopen panel"
          style={{
            position:       "fixed",
            top:            "50%",
            right:          0,
            transform:      "translateY(-50%)",
            zIndex:         1000,
            pointerEvents:  "auto",
            background:     "#0B0F1A",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRight:    "none",
            borderRadius:   "8px 0 0 8px",
            padding:        "12px 8px",
            cursor:         "pointer",
            color:          "rgba(255,255,255,0.5)",
            fontSize:       18,
            lineHeight:     1,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            transition:     "background 0.15s, color 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(30,30,50,0.98)";
            (e.currentTarget as HTMLElement).style.color = "#fff";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "#0B0F1A";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
          }}
        >‹</button>
      )}
    </>
  );
}
