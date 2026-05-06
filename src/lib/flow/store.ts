/**
 * src/lib/flow/store.ts
 *
 * Creative Flow — lightweight global store (no external dependencies).
 *
 * Implements the same API surface as a Zustand store so this can be swapped
 * to `zustand` later with minimal changes. Under the hood it uses a module-level
 * state object + a Set of React re-render triggers.
 *
 * Usage (identical to Zustand):
 *   const { workflowId, steps, activeStep, pushStep } = useFlowStore();
 *   useFlowStore.getState()  ← for access outside React (server actions, callbacks)
 *
 * Persistence model:
 *   - workflowId is persisted to sessionStorage so a same-tab page refresh
 *     continues the same workflow DB row.
 *   - The full steps array is NOT persisted — it hydrates from DB via FlowBar.
 *
 * UX terminology rule (HARD): no "workflow", "step", "pipeline" in UI strings.
 */

"use client";

import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FlowStudioType = "image" | "video" | "audio" | "fcs";

export interface FlowStep {
  /** DB workflow_steps.id */
  id:           string;
  /** 1-based position within the workflow */
  stepNumber:   number;
  studioType:   FlowStudioType;
  modelKey:     string;
  prompt:       string;
  /** Primary output URL — null while pending */
  resultUrl:    string | null;
  /** Thumbnail (same as resultUrl for images; null for video until frame extracted) */
  thumbnailUrl: string | null;
  status:       "pending" | "success" | "error";
  createdAt:    string; // ISO
}

export interface FlowState {
  /** DB workflows.id for the current session — null = no workflow started yet */
  workflowId:  string | null;
  /** Last MAX_STEPS completed steps (newest first) */
  steps:       FlowStep[];
  /** The most recently completed step — drives NextStepPanel */
  activeStep:  FlowStep | null;

  // ── Actions ──────────────────────────────────────────────────────────────────
  initWorkflow: (workflowId: string) => void;
  pushStep:     (step: FlowStep) => void;
  updateStep:   (stepId: string, patch: Partial<FlowStep>) => void;
  setActiveStep:(step: FlowStep | null) => void;
  resetFlow:    () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS  = 20;
const SESSION_KEY = "zencra_flow_workflow_id";

// ─────────────────────────────────────────────────────────────────────────────
// sessionStorage helpers (safe — no-op on SSR)
// ─────────────────────────────────────────────────────────────────────────────

function readSessionWorkflowId(): string | null {
  if (typeof window === "undefined") return null;
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}

function writeSessionWorkflowId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state (shared across all hook instances)
// ─────────────────────────────────────────────────────────────────────────────

type StateCore = Pick<FlowState, "workflowId" | "steps" | "activeStep">;

let _state: StateCore = {
  workflowId:  readSessionWorkflowId(),
  steps:       [],
  activeStep:  null,
};

const _listeners = new Set<() => void>();

function notifyAll() {
  _listeners.forEach((fn) => fn());
}

function setState(updater: Partial<StateCore> | ((s: StateCore) => Partial<StateCore>)) {
  const patch = typeof updater === "function" ? updater(_state) : updater;
  _state = { ..._state, ...patch };
  notifyAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions (stable references — defined once at module level)
// ─────────────────────────────────────────────────────────────────────────────

function initWorkflow(workflowId: string) {
  writeSessionWorkflowId(workflowId);
  setState({ workflowId });
}

function pushStep(step: FlowStep) {
  setState((s) => {
    if (s.steps.some((existing) => existing.id === step.id)) return s;
    const steps = [step, ...s.steps].slice(0, MAX_STEPS);
    return { steps, activeStep: step };
  });
}

function updateStep(stepId: string, patch: Partial<FlowStep>) {
  setState((s) => {
    const steps      = s.steps.map((st) => st.id === stepId ? { ...st, ...patch } : st);
    const activeStep = s.activeStep?.id === stepId ? { ...s.activeStep, ...patch } : s.activeStep;
    return { steps, activeStep };
  });
}

function setActiveStep(step: FlowStep | null) {
  setState({ activeStep: step });
}

function resetFlow() {
  writeSessionWorkflowId(null);
  setState({ workflowId: null, steps: [], activeStep: null });
}

const _actions: Pick<FlowState, "initWorkflow" | "pushStep" | "updateStep" | "setActiveStep" | "resetFlow"> = {
  initWorkflow,
  pushStep,
  updateStep,
  setActiveStep,
  resetFlow,
};

// ─────────────────────────────────────────────────────────────────────────────
// useFlowStore hook
// ─────────────────────────────────────────────────────────────────────────────

function _useFlowStore(): FlowState {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [, rerender] = useState(0);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const trigger = () => rerender((n) => n + 1);
    _listeners.add(trigger);
    return () => { _listeners.delete(trigger); };
  }, []);

  return { ..._state, ..._actions };
}

// Attach getState() for outside-React access (callbacks, server action wrappers)
_useFlowStore.getState = (): FlowState => ({ ..._state, ..._actions });

export const useFlowStore = _useFlowStore;
