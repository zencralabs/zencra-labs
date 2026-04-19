"use client";

/**
 * ActionCard — A single "next step" action in the NextStepPanel.
 *
 * Only renders for FULLY FUNCTIONAL backend flows.
 * No "coming soon", no placeholders.
 *
 * Current live actions (only these exist in the card map):
 *   - "variation"  → regenerate in the same studio with identical settings
 *
 * Architecture: add new actions to ACTION_DEFINITIONS below and the
 * CARD_MAP in NextStepPanel.tsx once their backend flows are wired.
 */

import type { FlowStep } from "@/lib/flow/store";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActionId = "variation";

export interface ActionDefinition {
  id:          ActionId;
  /** Primary label — imperative verb, short */
  label:       string;
  /** One-line description shown below the label */
  description: string;
  /** Emoji icon */
  icon:        string;
  /** Accent color for the card border glow */
  accent:      string;
}

export interface ActionCardProps {
  action:    ActionDefinition;
  step:      FlowStep;
  onTrigger: (actionId: ActionId, step: FlowStep) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action definitions
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_DEFINITIONS: Record<ActionId, ActionDefinition> = {
  variation: {
    id:          "variation",
    label:       "Create Variation",
    description: "Same settings, new result",
    icon:        "✦",
    accent:      "#6366F1",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ActionCard component
// ─────────────────────────────────────────────────────────────────────────────

export function ActionCard({ action, step, onTrigger }: ActionCardProps) {
  return (
    <button
      onClick={() => onTrigger(action.id, step)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = `rgba(99,102,241,0.1)`;
        el.style.borderColor = `rgba(99,102,241,0.3)`;
        el.style.transform = "translateY(-1px)";
        el.style.boxShadow = `0 4px 20px rgba(99,102,241,0.15)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "rgba(255,255,255,0.04)";
        el.style.borderColor = "rgba(255,255,255,0.08)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        background: `rgba(99,102,241,0.15)`,
        border: `1px solid rgba(99,102,241,0.25)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        flexShrink: 0,
      }}>
        {action.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#fff",
          letterSpacing: "-0.01em",
          marginBottom: 2,
        }}>
          {action.label}
        </div>
        <div style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.4)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {action.description}
        </div>
      </div>

      {/* Arrow */}
      <span style={{
        fontSize: 14,
        color: "rgba(255,255,255,0.25)",
        flexShrink: 0,
      }}>
        →
      </span>
    </button>
  );
}
