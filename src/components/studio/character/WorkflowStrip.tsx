"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowStrip — 5-step lifecycle at the bottom
// Mode-aware: amber if active, ghost if not
// ─────────────────────────────────────────────────────────────────────────────

import type { CharacterMode, Character } from "@/lib/character";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface WorkflowStripProps {
  activeMode: CharacterMode;
  onStepClick: (mode: CharacterMode) => void;
  character: Character | null;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.10)",
  amberBorder: "rgba(245,158,11,0.25)",
  surface:     "#0b0e17",
  border:      "#1a2035",
  textPrimary: "#e8eaf0",
  textSec:     "#8b92a8",
  textMuted:   "#4a5168",
  textGhost:   "#3d4560",
} as const;

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS: Array<{
  num: string;
  label: string;
  mode: CharacterMode;
  cta: string;
}> = [
  { num: "01", label: "Generate Base",    mode: "base",     cta: "Generate" },
  { num: "02", label: "Refine Identity",  mode: "refine",   cta: "Refine"   },
  { num: "03", label: "Lookbook",         mode: "lookbook", cta: "Lookbook" },
  { num: "04", label: "Scene Builder",    mode: "scene",    cta: "Scene"    },
  { num: "05", label: "Motion Starter",   mode: "motion",   cta: "Animate"  },
];

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step, active, hasCharacter, onClick,
}: {
  step: typeof STEPS[number];
  active: boolean;
  hasCharacter: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0,
        padding: "12px 14px",
        borderRadius: 10,
        border: active ? `1px solid ${T.amberBorder}` : `1px solid ${T.border}`,
        background: active ? T.amberDim : "rgba(11,14,23,0.5)",
        cursor: "pointer", textAlign: "left",
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      {/* Active badge */}
      {active && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          padding: "2px 7px", borderRadius: 4,
          background: "rgba(245,158,11,0.2)",
          border: "1px solid rgba(245,158,11,0.35)",
          fontSize: 8, fontWeight: 800, color: T.amber,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Active
        </div>
      )}

      {/* Step number */}
      <div style={{
        fontSize: 10, fontWeight: 700, fontFamily: "monospace",
        color: active ? "rgba(245,158,11,0.6)" : T.textGhost,
        letterSpacing: "0.08em", marginBottom: 5,
      }}>
        {step.num}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: active ? T.amber : T.textSec,
        marginBottom: 2,
      }}>
        {step.label}
      </div>

      {/* Mode code */}
      <div style={{
        fontSize: 9, fontFamily: "monospace",
        color: T.textGhost, letterSpacing: "0.06em",
        marginBottom: 10,
      }}>
        mode={step.mode}
      </div>

      {/* CTA button */}
      <div style={{
        padding: "5px 10px", borderRadius: 6,
        border: active ? `1px solid ${T.amber}` : `1px solid ${T.border}`,
        background: active ? "rgba(245,158,11,0.15)" : "transparent",
        color: active ? T.amber : hasCharacter ? T.textSec : T.textGhost,
        fontSize: 10, fontWeight: active ? 700 : 500,
        display: "inline-flex", alignItems: "center",
        transition: "all 0.15s",
        opacity: hasCharacter ? 1 : 0.5,
      }}>
        {step.cta}
      </div>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function WorkflowStrip({ activeMode, onStepClick, character }: WorkflowStripProps) {
  const hasCharacter = !!character;

  return (
    <div style={{
      width: "100%",
      padding: "12px 0",
      borderTop: `1px solid ${T.border}`,
      marginTop: 12,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: T.textGhost,
        letterSpacing: "0.12em", textTransform: "uppercase",
        marginBottom: 10,
      }}>
        Character Workflow
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {STEPS.map(step => (
          <StepCard
            key={step.mode}
            step={step}
            active={activeMode === step.mode}
            hasCharacter={hasCharacter}
            onClick={() => onStepClick(step.mode)}
          />
        ))}
      </div>
    </div>
  );
}
