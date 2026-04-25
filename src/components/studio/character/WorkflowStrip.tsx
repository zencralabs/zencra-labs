"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowStrip — cinematic 5-step journey bar (Phase 3D)
// Part of fixed shell layout — always visible at bottom
// Cards: gradient image background + title + description + CTA
// States: active (amber glow), completed (green check), future (muted)
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
  amber:    "#f59e0b",
  border:   "#1a2035",
  textSec:  "#8b92a8",
  textMuted:"#4a5168",
  textGhost:"#3d4560",
} as const;

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS: Array<{
  num: string; label: string; mode: CharacterMode;
  description: string; cta: string;
  gradient: string; imageBg: string; accent: string;
}> = [
  {
    num: "01", label: "Generate Base",
    mode: "base",
    description: "Build foundational Soul ID",
    cta: "Generate",
    gradient: "linear-gradient(160deg, #1a110a 0%, #0d0a04 100%)",
    imageBg: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.22) 0%, transparent 70%)",
    accent: "#f59e0b",
  },
  {
    num: "02", label: "Refine Identity",
    mode: "refine",
    description: "Polish features & angles",
    cta: "Refine",
    gradient: "linear-gradient(160deg, #080d1a 0%, #040810 100%)",
    imageBg: "radial-gradient(ellipse at 50% 30%, rgba(59,130,246,0.20) 0%, transparent 70%)",
    accent: "#3b82f6",
  },
  {
    num: "03", label: "Explore Looks",
    mode: "lookbook",
    description: "Generate styled variations",
    cta: "Lookbook",
    gradient: "linear-gradient(160deg, #140a1a 0%, #0d0712 100%)",
    imageBg: "radial-gradient(ellipse at 50% 30%, rgba(168,85,247,0.20) 0%, transparent 70%)",
    accent: "#a855f7",
  },
  {
    num: "04", label: "Build Scenes",
    mode: "scene",
    description: "Place in environments",
    cta: "Scene",
    gradient: "linear-gradient(160deg, #071510 0%, #050e09 100%)",
    imageBg: "radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.18) 0%, transparent 70%)",
    accent: "#10b981",
  },
  {
    num: "05", label: "Motion Starter",
    mode: "motion",
    description: "Animate for reels & content",
    cta: "Animate",
    gradient: "linear-gradient(160deg, #1a0810 0%, #120509 100%)",
    imageBg: "radial-gradient(ellipse at 50% 30%, rgba(244,63,94,0.18) 0%, transparent 70%)",
    accent: "#f43f5e",
  },
];

const MODE_ORDER: CharacterMode[] = ["base", "refine", "lookbook", "scene", "motion"];

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step, active, completed, hasCharacter, onClick,
}: {
  step: typeof STEPS[number];
  active: boolean; completed: boolean; hasCharacter: boolean;
  onClick: () => void;
}) {
  const muted = !hasCharacter;

  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column",
        borderRadius: 11,
        border: active
          ? `1px solid ${step.accent}50`
          : `1px solid ${T.border}`,
        background: step.gradient,
        cursor: hasCharacter ? "pointer" : "default",
        textAlign: "left",
        transition: "all 0.22s ease",
        position: "relative", overflow: "hidden",
        boxShadow: active
          ? `0 0 0 1px ${step.accent}30, 0 0 20px ${step.accent}18, 0 4px 24px rgba(0,0,0,0.5)`
          : "0 2px 16px rgba(0,0,0,0.35)",
        opacity: muted && !active ? 0.52 : 1,
        padding: 0,
      }}
      onMouseEnter={e => {
        if (!hasCharacter) return;
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 0 1px ${step.accent}45, 0 0 26px ${step.accent}22, 0 8px 32px rgba(0,0,0,0.55)`;
        (e.currentTarget as HTMLElement).style.borderColor = `${step.accent}45`;
      }}
      onMouseLeave={e => {
        if (!hasCharacter) return;
        (e.currentTarget as HTMLElement).style.boxShadow = active
          ? `0 0 0 1px ${step.accent}30, 0 0 20px ${step.accent}18, 0 4px 24px rgba(0,0,0,0.5)`
          : "0 2px 16px rgba(0,0,0,0.35)";
        (e.currentTarget as HTMLElement).style.borderColor = active ? `${step.accent}50` : T.border;
      }}
    >
      {/* Image area — 52% of card height */}
      <div style={{
        width: "100%",
        paddingTop: "52%",
        position: "relative",
        flexShrink: 0,
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: step.imageBg,
        }} />

        {/* Silhouette suggestion */}
        <div style={{
          position: "absolute",
          bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "35%", paddingBottom: "55%",
          background: `radial-gradient(ellipse at 50% 20%, ${step.accent}30 0%, transparent 60%)`,
          borderRadius: "50% 50% 30% 30%",
        }} />

        {/* Step number badge */}
        <div style={{
          position: "absolute", top: 8, left: 10,
          fontSize: 10, fontWeight: 900, fontFamily: "monospace",
          color: active ? step.accent : T.textGhost,
          letterSpacing: "0.08em",
        }}>
          {step.num}
        </div>

        {/* Active badge */}
        {active && (
          <div style={{
            position: "absolute", top: 7, right: 8,
            padding: "2px 7px", borderRadius: 4,
            background: `${step.accent}22`,
            border: `1px solid ${step.accent}44`,
            fontSize: 8, fontWeight: 900, color: step.accent,
            letterSpacing: "0.10em", textTransform: "uppercase",
          }}>
            Active
          </div>
        )}

        {/* Completed badge */}
        {completed && !active && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            width: 18, height: 18, borderRadius: "50%",
            background: "rgba(16,185,129,0.18)",
            border: "1px solid rgba(16,185,129,0.38)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* Text area */}
      <div style={{ padding: "10px 12px 10px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Label */}
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: active ? step.accent : T.textSec,
          marginBottom: 4, lineHeight: 1.3,
        }}>
          {step.label}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 10, color: T.textGhost,
          lineHeight: 1.5, marginBottom: 10, flex: 1,
        }}>
          {step.description}
        </div>

        {/* CTA */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 11px", borderRadius: 6,
          border: active ? `1px solid ${step.accent}55` : `1px solid ${T.border}`,
          background: active ? `${step.accent}18` : "rgba(255,255,255,0.03)",
          color: active ? step.accent : T.textMuted,
          fontSize: 10, fontWeight: active ? 700 : 500,
          letterSpacing: "0.03em", transition: "all 0.15s",
          alignSelf: "flex-start",
        }}>
          {active && (
            <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          {step.cta}
        </div>
      </div>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function WorkflowStrip({ activeMode, onStepClick, character }: WorkflowStripProps) {
  const hasCharacter = !!character;
  const activeIdx = MODE_ORDER.indexOf(activeMode);

  return (
    <div style={{
      width: "100%",
      borderTop: `1px solid ${T.border}`,
      paddingTop: 12,
    }}>
      {/* Strip header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 10,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: T.textGhost,
          letterSpacing: "0.14em", textTransform: "uppercase",
        }}>
          Character Workflow
        </div>
        {hasCharacter && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, color: T.textMuted,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: T.amber, boxShadow: `0 0 6px ${T.amber}`,
            }} />
            {character.name}  ·  Step {activeIdx + 1} / 5
          </div>
        )}
      </div>

      {/* Cards */}
      <div style={{ display: "flex", gap: 8 }}>
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
