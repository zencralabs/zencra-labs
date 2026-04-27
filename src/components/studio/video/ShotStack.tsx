"use client";

/**
 * ShotStack — Left Panel Shot Stack UI
 *
 * Renders the ordered list of shots for a cinematic sequence.
 * Layout position: left panel [ShotStack | Canvas | Controls]
 *
 * Receives all state and actions from useSequenceState via props.
 * Does NOT manage its own state — it is a pure controlled component.
 *
 * Features:
 *   - Add / remove shots (max 10)
 *   - Edit prompt per shot (textarea)
 *   - Continuity toggle per shot
 *   - Transition type selector (shots 2+ only): Cut To / Match Action / Continue Motion
 *   - Composition type selector (all shots): Reveal / Close-Up / Wide / Reaction / OTS
 *   - Status indicator per shot (pending / generating / done / failed)
 *   - Start generation CTA at the bottom
 */

import type {
  SequenceShot,
  SequenceState,
  SequenceActions,
  TransitionType,
  CompositionType,
} from "@/hooks/useSequenceState";

// ─────────────────────────────────────────────────────────────────────────────
// STATUS INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

function ShotStatusDot({ status }: { status: SequenceShot["status"] }) {
  const COLOR: Record<SequenceShot["status"], string> = {
    pending:     "rgba(255,255,255,0.2)",
    dispatching: "#F59E0B",
    generating:  "#3B82F6",
    done:        "#22C55E",
    failed:      "#EF4444",
  };
  const LABEL: Record<SequenceShot["status"], string> = {
    pending:     "Queued",
    dispatching: "Starting…",
    generating:  "Generating",
    done:        "Done",
    failed:      "Failed",
  };
  const isAnimated = status === "generating" || status === "dispatching";

  return (
    <span title={LABEL[status]} style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{
        display:       "block",
        width:         8,
        height:        8,
        borderRadius:  "50%",
        background:    COLOR[status],
        flexShrink:    0,
        animation:     isAnimated ? "zPulse 1.4s ease-in-out infinite" : "none",
      }} />
      <style>{`
        @keyframes zPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PILL SELECTOR (shared by transition + composition)
// ─────────────────────────────────────────────────────────────────────────────

interface PillOption<T extends string> {
  value: T;
  label: string;
  /** Optional tooltip — shown on hover */
  tip?: string;
}

interface PillSelectorProps<T extends string> {
  options:   PillOption<T>[];
  value:     T | null | undefined;
  onChange:  (next: T | null) => void;
  disabled?: boolean;
}

function PillSelector<T extends string>({ options, value, onChange, disabled }: PillSelectorProps<T>) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {options.map(opt => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            title={opt.tip ?? opt.label}
            onClick={() => onChange(isActive ? null : opt.value)}
            disabled={disabled}
            style={{
              background:    isActive ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
              border:        `1px solid ${isActive ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.08)"}`,
              borderRadius:  5,
              padding:       "3px 8px",
              fontSize:      10,
              fontWeight:    700,
              letterSpacing: "0.05em",
              color:         isActive ? "#A5B4FC" : "rgba(255,255,255,0.3)",
              cursor:        disabled ? "default" : "pointer",
              opacity:       disabled ? 0.4 : 1,
              transition:    "background 0.1s, border-color 0.1s, color 0.1s",
              fontFamily:    "var(--font-syne), Syne, sans-serif",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP DATA
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITION_OPTIONS: PillOption<TransitionType>[] = [
  { value: "cut_to",          label: "Cut To",        tip: "Hard cut — maintains overall visual consistency" },
  { value: "match_action",    label: "Match Action",  tip: "Continues exact motion and timing from previous shot" },
  { value: "continue_motion", label: "Continue Motion", tip: "Direct continuation — unbroken camera movement. Requires continuity on." },
];

const COMPOSITION_OPTIONS: PillOption<CompositionType>[] = [
  { value: "reveal",            label: "Reveal",    tip: "Opens to a wider view, exposing new visual information" },
  { value: "close_up",          label: "Close-Up",  tip: "Tight framing on subject face or detail" },
  { value: "wide_establishing", label: "Wide",      tip: "Full environment visible, subject small in frame" },
  { value: "reaction_shot",     label: "Reaction",  tip: "Subject's emotional response to the previous moment" },
  { value: "over_the_shoulder", label: "OTS",       tip: "Framed from behind another character or foreground element" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHOT CARD
// ─────────────────────────────────────────────────────────────────────────────

interface ShotCardProps {
  shot:        SequenceShot;
  isOnly:      boolean;
  onUpdate:    (localId: string, patch: Partial<SequenceShot>) => void;
  onRemove:    (localId: string) => void;
}

function ShotCard({ shot, isOnly, onUpdate, onRemove }: ShotCardProps) {
  const isLocked = shot.status !== "pending";
  // continue_motion requires continuity on — lock the LINK toggle
  const continuityLocked = shot.transitionType === "continue_motion";

  return (
    <div style={{
      background:   "rgba(255,255,255,0.03)",
      border:       "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      padding:      "12px 14px",
      display:      "flex",
      flexDirection: "column",
      gap:          10,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShotStatusDot status={shot.status} />
          <span style={{
            fontSize:    12,
            fontWeight:  700,
            color:       "rgba(255,255,255,0.5)",
            letterSpacing: "0.06em",
            fontFamily:  "var(--font-syne), Syne, sans-serif",
          }}>
            SHOT {String(shot.shotNumber).padStart(2, "0")}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Continuity toggle — locked to ON when continue_motion is selected */}
          {shot.shotNumber > 1 && (
            <button
              onClick={() => {
                if (continuityLocked) return; // continue_motion forces continuity on
                onUpdate(shot.localId, { continuityDisabled: !shot.continuityDisabled });
              }}
              disabled={isLocked || continuityLocked}
              title={
                continuityLocked
                  ? "Continuity required — Continue Motion transition needs frame carry-forward"
                  : shot.continuityDisabled
                    ? "Continuity off — enable to carry previous frame"
                    : "Continuity on — previous shot's frame will carry forward"
              }
              style={{
                background: shot.continuityDisabled && !continuityLocked
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(99,102,241,0.15)",
                border: `1px solid ${shot.continuityDisabled && !continuityLocked ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.3)"}`,
                borderRadius: 6,
                padding:      "3px 8px",
                fontSize:     10,
                fontWeight:   700,
                letterSpacing: "0.05em",
                color:        shot.continuityDisabled && !continuityLocked ? "rgba(255,255,255,0.3)" : "#818CF8",
                cursor:       (isLocked || continuityLocked) ? "default" : "pointer",
                opacity:      isLocked ? 0.5 : 1,
              }}
            >
              {shot.continuityDisabled && !continuityLocked ? "LINK OFF" : "LINK ON"}
            </button>
          )}

          {/* Remove button */}
          {!isOnly && !isLocked && (
            <button
              onClick={() => onRemove(shot.localId)}
              title="Remove shot"
              style={{
                background:   "none",
                border:       "none",
                padding:      "2px 4px",
                cursor:       "pointer",
                color:        "rgba(255,255,255,0.25)",
                fontSize:     16,
                lineHeight:   1,
                borderRadius: 4,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Prompt textarea */}
      <textarea
        value={shot.prompt}
        onChange={e => onUpdate(shot.localId, { prompt: e.target.value })}
        disabled={isLocked}
        placeholder={`Describe shot ${shot.shotNumber}…`}
        rows={3}
        style={{
          width:        "100%",
          resize:       "none",
          background:   "rgba(255,255,255,0.04)",
          border:       "1px solid rgba(255,255,255,0.08)",
          borderRadius: 7,
          padding:      "8px 10px",
          fontSize:     13,
          fontFamily:   "var(--font-familjen), 'Familjen Grotesk', sans-serif",
          color:        isLocked ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)",
          outline:      "none",
          lineHeight:   1.5,
          boxSizing:    "border-box",
          opacity:      isLocked ? 0.7 : 1,
        }}
      />

      {/* ── Relationship selectors ─────────────────────────────────────────── */}

      {/* Transition type — shots 2+ only */}
      {shot.shotNumber > 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: "0.08em",
              color:         "rgba(255,255,255,0.25)",
              fontFamily:    "var(--font-syne), Syne, sans-serif",
            }}>
              TRANSITION
            </span>
            {shot.isSuggested && shot.transitionType && (
              <span style={{
                fontSize:      8,
                fontWeight:    600,
                letterSpacing: "0.06em",
                color:         "rgba(99,102,241,0.7)",
                fontFamily:    "var(--font-syne), Syne, sans-serif",
              }}>
                SUGGESTED
              </span>
            )}
          </div>
          <PillSelector<TransitionType>
            options={TRANSITION_OPTIONS}
            value={shot.transitionType}
            disabled={isLocked}
            onChange={next => onUpdate(shot.localId, { transitionType: next })}
          />
        </div>
      )}

      {/* Composition type — all shots */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize:      9,
            fontWeight:    700,
            letterSpacing: "0.08em",
            color:         "rgba(255,255,255,0.25)",
            fontFamily:    "var(--font-syne), Syne, sans-serif",
          }}>
            COMPOSITION
          </span>
          {shot.isSuggested && shot.compositionType && (
            <span style={{
              fontSize:      8,
              fontWeight:    600,
              letterSpacing: "0.06em",
              color:         "rgba(99,102,241,0.7)",
              fontFamily:    "var(--font-syne), Syne, sans-serif",
            }}>
              SUGGESTED
            </span>
          )}
        </div>
        <PillSelector<CompositionType>
          options={COMPOSITION_OPTIONS}
          value={shot.compositionType}
          disabled={isLocked}
          onChange={next => onUpdate(shot.localId, { compositionType: next })}
        />
      </div>

      {/* Failure message */}
      {shot.status === "failed" && shot.errorMessage && (
        <span style={{
          fontSize:  11,
          color:     "#EF4444",
          lineHeight: 1.4,
        }}>
          {shot.errorMessage}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOT STACK
// ─────────────────────────────────────────────────────────────────────────────

interface ShotStackProps {
  state:           SequenceState;
  actions:         SequenceActions;
  modelId:         string;
  aspectRatio:     string;
  durationSeconds: number;
}

export function ShotStack({
  state,
  actions,
  modelId,
  aspectRatio,
  durationSeconds,
}: ShotStackProps) {
  const { shots, loading, error, sequenceStatus } = state;
  const isGenerating = sequenceStatus === "generating" || sequenceStatus === "creating";
  const canAddShot   = shots.length < 10 && !isGenerating;
  const canGenerate  = shots.length > 0 && shots.every(s => s.prompt.trim()) && !isGenerating;

  const doneCount   = shots.filter(s => s.status === "done").length;
  const progress    = shots.length > 0 ? Math.round((doneCount / shots.length) * 100) : 0;

  return (
    <div style={{
      display:        "flex",
      flexDirection:  "column",
      height:         "100%",
      background:     "#111111",
      borderRight:    "1px solid rgba(255,255,255,0.06)",
      overflow:       "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding:        "16px 16px 12px",
        borderBottom:   "1px solid rgba(255,255,255,0.06)",
        flexShrink:     0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontSize:     12,
            fontWeight:   800,
            letterSpacing: "0.08em",
            color:        "rgba(255,255,255,0.45)",
            fontFamily:   "var(--font-syne), Syne, sans-serif",
          }}>
            SHOT STACK
          </span>
          <span style={{
            fontSize:   11,
            color:      "rgba(255,255,255,0.3)",
          }}>
            {shots.length} / 10
          </span>
        </div>

        {/* Progress bar — visible during generation */}
        {isGenerating && (
          <div style={{
            marginTop:    10,
            height:       3,
            background:   "rgba(255,255,255,0.06)",
            borderRadius: 2,
            overflow:     "hidden",
          }}>
            <div style={{
              height:       "100%",
              width:        `${progress}%`,
              background:   "#C6FF00",
              borderRadius: 2,
              transition:   "width 0.4s ease",
            }} />
          </div>
        )}
      </div>

      {/* Shot list — scrollable */}
      <div style={{
        flex:          1,
        overflowY:     "auto",
        padding:       "12px 12px 0",
        display:       "flex",
        flexDirection: "column",
        gap:           8,
      }}>
        {shots.map((shot, idx) => (
          <ShotCard
            key={shot.localId}
            shot={shot}
            isOnly={shots.length === 1}
            onUpdate={actions.updateShot}
            onRemove={actions.removeShot}
          />
        ))}

        {/* Add shot button */}
        {canAddShot && (
          <button
            onClick={() => actions.addShot()}
            style={{
              background:   "rgba(255,255,255,0.03)",
              border:       "1px dashed rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding:      "12px 14px",
              width:        "100%",
              cursor:       "pointer",
              color:        "rgba(255,255,255,0.3)",
              fontSize:     13,
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              gap:          8,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            Add Shot
          </button>
        )}
      </div>

      {/* Footer — error + generate CTA */}
      <div style={{
        padding:       "12px 12px 16px",
        borderTop:     "1px solid rgba(255,255,255,0.06)",
        flexShrink:    0,
        display:       "flex",
        flexDirection: "column",
        gap:           10,
      }}>
        {error && (
          <div style={{
            background:   "rgba(239,68,68,0.08)",
            border:       "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding:      "8px 12px",
            fontSize:     12,
            color:        "#FCA5A5",
          }}>
            {error}
          </div>
        )}

        {/* Completion summary */}
        {(sequenceStatus === "completed" || sequenceStatus === "partial") && (
          <div style={{
            background:   sequenceStatus === "completed"
              ? "rgba(34,197,94,0.08)"
              : "rgba(245,158,11,0.08)",
            border: `1px solid ${sequenceStatus === "completed" ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
            borderRadius: 8,
            padding:      "8px 12px",
            fontSize:     12,
            color:        sequenceStatus === "completed" ? "#86EFAC" : "#FCD34D",
          }}>
            {sequenceStatus === "completed"
              ? `All ${shots.length} shots complete`
              : `${doneCount} of ${shots.length} shots complete`}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {/* Clear / Reset */}
          {sequenceStatus !== "idle" && (
            <button
              onClick={actions.clearSequence}
              disabled={isGenerating}
              style={{
                background:   "rgba(255,255,255,0.04)",
                border:       "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding:      "10px 14px",
                fontSize:     12,
                fontWeight:   600,
                color:        "rgba(255,255,255,0.4)",
                cursor:       isGenerating ? "default" : "pointer",
                opacity:      isGenerating ? 0.4 : 1,
              }}
            >
              Reset
            </button>
          )}

          {/* Generate */}
          <button
            onClick={() => void actions.startGeneration(modelId, aspectRatio, durationSeconds)}
            disabled={!canGenerate}
            style={{
              flex:          1,
              background:    canGenerate ? "#C6FF00" : "rgba(255,255,255,0.06)",
              border:        "none",
              borderRadius:  8,
              padding:       "10px 14px",
              fontSize:      13,
              fontWeight:    700,
              fontFamily:    "var(--font-syne), Syne, sans-serif",
              color:         canGenerate ? "#0A0A0A" : "rgba(255,255,255,0.2)",
              cursor:        canGenerate ? "pointer" : "default",
              letterSpacing: "0.04em",
              transition:    "background 0.15s, color 0.15s",
            }}
          >
            {isGenerating
              ? `${doneCount} / ${shots.length} generating…`
              : "Generate Sequence"}
          </button>
        </div>
      </div>
    </div>
  );
}
