"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowStrip — cinematic 5-step journey at the bottom
// Each card: gradient image background + step number + title + description + CTA
// active = amber glow, completed = checkmark badge, future = muted
// Props UNCHANGED from Phase 3A
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
  amberDim:    "rgba(245,158,11,0.12)",
  amberBorder: "rgba(245,158,11,0.30)",
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
  description: string;
  cta: string;
  gradient: string;
  accentColor: string;
}> = [
  {
    num: "01", label: "Generate Base",
    mode: "base",
    description: "Create your character's foundational identity and Soul ID",
    cta: "Generate",
    gradient: "linear-gradient(160deg, #1a120a 0%, #0d0a06 60%, #090c13 100%)",
    accentColor: "#f59e0b",
  },
  {
    num: "02", label: "Refine Identity",
    mode: "refine",
    description: "Polish features, adjust angles, lock in your character's look",
    cta: "Refine",
    gradient: "linear-gradient(160deg, #0a1020 0%, #080d1a 60%, #090c13 100%)",
    accentColor: "#3b82f6",
  },
  {
    num: "03", label: "Lookbook",
    mode: "lookbook",
    description: "Generate multiple styled variations for your content library",
    cta: "Lookbook",
    gradient: "linear-gradient(160deg, #160a1a 0%, #0f0814 60%, #090c13 100%)",
    accentColor: "#a855f7",
  },
  {
    num: "04", label: "Scene Builder",
    mode: "scene",
    description: "Place your character in environments and cinematic setups",
    cta: "Scene",
    gradient: "linear-gradient(160deg, #091a10 0%, #07130c 60%, #090c13 100%)",
    accentColor: "#10b981",
  },
  {
    num: "05", label: "Motion Starter",
    mode: "motion",
    description: "Animate your character for reels, intros, and viral content",
    cta: "Animate",
    gradient: "linear-gradient(160deg, #1a0a12 0%, #13080d 60%, #090c13 100%)",
    accentColor: "#f43f5e",
  },
];

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step, active, completed, hasCharacter, onClick,
}: {
  step: typeof STEPS[number];
  active: boolean;
  completed: boolean;
  hasCharacter: boolean;
  onClick: () => void;
}) {
  const muted = !hasCharacter && !active;

  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0,
        borderRadius: 12,
        border: active
          ? `1px solid ${step.accentColor}55`
          : `1px solid ${T.border}`,
        background: step.gradient,
        cursor: hasCharacter ? "pointer" : "default",
        textAlign: "left",
        transition: "all 0.25s ease",
        position: "relative", overflow: "hidden",
        padding: "14px 14px 12px",
        boxShadow: active
          ? `0 0 0 1px ${step.accentColor}33, 0 0 24px ${step.accentColor}22, 0 8px 32px rgba(0,0,0,0.5)`
          : "0 4px 20px rgba(0,0,0,0.3)",
        opacity: muted ? 0.55 : 1,
      }}
      onMouseEnter={e => {
        if (!hasCharacter) return;
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 0 1px ${step.accentColor}44, 0 0 28px ${step.accentColor}28, 0 12px 40px rgba(0,0,0,0.55)`;
        (e.currentTarget as HTMLElement).style.borderColor = `${step.accentColor}44`;
      }}
      onMouseLeave={e => {
        if (!hasCharacter) return;
        (e.currentTarget as HTMLElement).style.boxShadow =
          active
            ? `0 0 0 1px ${step.accentColor}33, 0 0 24px ${step.accentColor}22, 0 8px 32px rgba(0,0,0,0.5)`
            : "0 4px 20px rgba(0,0,0,0.3)";
        (e.currentTarget as HTMLElement).style.borderColor =
          active ? `${step.accentColor}55` : T.border;
      }}
    >
      {/* Active badge */}
      {active && (
        <div style={{
          position: "absolute", top: 9, right: 9,
          padding: "2px 8px", borderRadius: 4,
          background: `${step.accentColor}22`,
          border: `1px solid ${step.accentColor}44`,
          fontSize: 8, fontWeight: 900, color: step.accentColor,
          letterSpacing: "0.10em", textTransform: "uppercase",
        }}>
          Active
        </div>
      )}

      {/* Completed badge */}
      {completed && !active && (
        <div style={{
          position: "absolute", top: 9, right: 9,
          width: 18, height: 18, borderRadius: "50%",
          background: "rgba(16,185,129,0.15)",
          border: "1px solid rgba(16,185,129,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
            stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Step number */}
      <div style={{
        fontSize: 10, fontWeight: 800, fontFamily: "monospace",
        color: active ? `${step.accentColor}99` : T.textGhost,
        letterSpacing: "0.08em", marginBottom: 6,
      }}>
        {step.num}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: active ? step.accentColor : T.textSec,
        marginBottom: 5, lineHeight: 1.3,
      }}>
        {step.label}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 10, color: T.textGhost,
        lineHeight: 1.55, marginBottom: 12,
      }}>
        {step.description}
      </div>

      {/* CTA */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 11px", borderRadius: 6,
        border: active
          ? `1px solid ${step.accentColor}55`
          : `1px solid ${T.border}`,
        background: active ? `${step.accentColor}18` : "rgba(255,255,255,0.03)",
        color: active ? step.accentColor : T.textMuted,
        fontSize: 10, fontWeight: active ? 700 : 500,
        transition: "all 0.15s",
        letterSpacing: "0.03em",
      }}>
        {active && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
          </svg>
        )}
        {step.cta}
      </div>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function WorkflowStrip({ activeMode, onStepClick, character }: WorkflowStripProps) {
  const hasCharacter = !!character;

  // Determine which steps are completed (before the active mode in the sequence)
  const modeOrder: CharacterMode[] = ["base", "refine", "lookbook", "scene", "motion"];
  const activeIdx = modeOrder.indexOf(activeMode);

  return (
    <div style={{
      width: "100%",
      padding: "16px 0",
      borderTop: `1px solid ${T.border}`,
      marginTop: 12,
    }}>
      {/* Strip heading */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 14,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: T.textGhost,
          letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          Character Workflow
        </div>
        {hasCharacter && (
          <div style={{
            fontSize: 10, color: T.textMuted,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: T.amber, boxShadow: `0 0 6px ${T.amber}`,
            }} />
            {character.name ?? "Character"} · Step {activeIdx + 1} of 5
          </div>
        )}
      </div>

      {/* Cards row */}
      <div style={{ display: "flex", gap: 10 }}>
        {STEPS.map((step, i) => (
          <StepCard
            key={step.mode}
            step={step}
            active={activeMode === step.mode}
            completed={hasCharacter && i < activeIdx}
            hasCharacter={hasCharacter}
            onClick={() => hasCharacter && onStepClick(step.mode)}
          />
        ))}
      </div>
    </div>
  );
}
