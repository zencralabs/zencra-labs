"use client";

/**
 * FlowBar — Minimal chain of the last 2–3 creation nodes.
 *
 * Positioned as a fixed strip just below the studio top bar.
 * Only renders when the current workflow has 2 or more steps.
 * Clicking a node makes it the active step (re-opens its NextStepPanel context).
 *
 * Design rules:
 *   - Shows at most 3 nodes (the last 3 steps in the chain).
 *   - No scrolling, no history drawer — this is a glance element only.
 *   - Studio type shown as an icon + small label.
 *   - Active step is highlighted.
 *   - No UX text that says "workflow", "step", or "pipeline".
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFlowStore } from "@/lib/flow/store";
import type { FlowStep, FlowStudioType } from "@/lib/flow/store";
import { getRecentSteps } from "@/lib/flow/actions";

// ─────────────────────────────────────────────────────────────────────────────
// Studio icon map
// ─────────────────────────────────────────────────────────────────────────────

const STUDIO_ICON: Record<FlowStudioType, string> = {
  image:  "🎨",
  video:  "🎬",
  audio:  "🎙️",
  fcs:    "🎞️",
};

const STUDIO_LABEL: Record<FlowStudioType, string> = {
  image:  "Image",
  video:  "Video",
  audio:  "Audio",
  fcs:    "Cinema",
};

// ─────────────────────────────────────────────────────────────────────────────
// FlowNode
// ─────────────────────────────────────────────────────────────────────────────

function FlowNode({
  step,
  isActive,
  isLast,
  onClick,
}: {
  step:     FlowStep;
  isActive: boolean;
  isLast:   boolean;
  onClick:  () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {/* Node button */}
      <button
        onClick={onClick}
        title={step.prompt.slice(0, 80)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 8,
          border: `1px solid ${isActive ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.1)"}`,
          background: isActive
            ? "rgba(37,99,235,0.18)"
            : "rgba(255,255,255,0.05)",
          cursor: "pointer",
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
          }
        }}
      >
        {/* Thumbnail or icon */}
        {step.thumbnailUrl && step.studioType === "image" ? (
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            overflow: "hidden",
            flexShrink: 0,
            background: "rgba(255,255,255,0.06)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.thumbnailUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <span style={{ fontSize: 14, lineHeight: 1 }}>
            {STUDIO_ICON[step.studioType]}
          </span>
        )}

        {/* Label */}
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: isActive ? "#93C5FD" : "rgba(255,255,255,0.55)",
          letterSpacing: "0.01em",
          whiteSpace: "nowrap",
        }}>
          {STUDIO_LABEL[step.studioType]}
        </span>

        {/* Status dot */}
        {step.status === "error" && (
          <span style={{ fontSize: 9, color: "#F87171" }}>●</span>
        )}
      </button>

      {/* Connector arrow — shown between nodes, not after the last one */}
      {!isLast && (
        <span style={{
          color: "rgba(255,255,255,0.2)",
          fontSize: 12,
          margin: "0 2px",
          flexShrink: 0,
          userSelect: "none",
        }}>
          →
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FlowBar
// ─────────────────────────────────────────────────────────────────────────────

export default function FlowBar() {
  const pathname = usePathname();
  const { workflowId, steps, activeStep, pushStep, setActiveStep } = useFlowStore();

  // Hydrate from DB when store is empty but workflowId is known (page refresh case)
  useEffect(() => {
    if (!workflowId || steps.length > 0) return;

    getRecentSteps(workflowId, 3).then((result) => {
      if (!result.ok) return;
      // Push each step in ascending order so newest is last pushed (becomes activeStep)
      for (const step of result.steps) {
        pushStep(step);
      }
    });
  }, [workflowId, steps.length, pushStep]);

  // Route guard — Flow is exclusive to Image Studio. Must come after all hooks.
  if (pathname !== "/studio/image") return null;

  // Don't render until there are at least 2 steps (a chain needs 2+ nodes)
  const visibleSteps = steps.slice(-3);   // show last 3 steps, oldest first
  if (visibleSteps.length < 2) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",     // hangs below the toolbar wrapper it lives inside
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,      // above gallery content, below global modals
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 12px",
        background: "rgba(8,8,14,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: "0 0 12px 12px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTop: "none",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        // Fade in when it first appears
        animation: "flowBarFadeIn 0.3s ease",
      }}
    >
      <style>{`
        @keyframes flowBarFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Subtle label */}
      <span style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.2)",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginRight: 4,
        flexShrink: 0,
      }}>
        Flow
      </span>

      {visibleSteps.map((step: FlowStep, i: number) => (
        <FlowNode
          key={step.id}
          step={step}
          isActive={activeStep?.id === step.id}
          isLast={i === visibleSteps.length - 1}
          onClick={() => setActiveStep(step)}
        />
      ))}
    </div>
  );
}
