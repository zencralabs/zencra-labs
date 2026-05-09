/**
 * src/lib/workflows/types.ts
 *
 * Phase 2A Workflow Engine — Core Type Definitions
 *
 * ── Sacred rule ──────────────────────────────────────────────────────────────
 *   This file contains ONLY engine vocabulary.
 *   No provider imports. No provider names. No provider parameters.
 *
 *   The engine knows:
 *     capabilities ("renderWithQuality")
 *     constraints  ("cinematic", "fast")
 *     semantic intent (WorkflowDefinition)
 *     workflow state  (RunWorkflowResult)
 *
 *   The engine does NOT know:
 *     OpenAI, Kling, Nano Banana, Seedream, or any other provider
 *     API-level quality strings ("low", "medium", "high")
 *     FormData, fetch, model IDs, or API endpoints
 *
 * ── Extension path ────────────────────────────────────────────────────────────
 *   Phase 2B/3: extend CapabilityParams with new capability types.
 *   The engine, workflow definitions, and API routes never change shape.
 *   Only the capability registry adds new adapters.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY NAMES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All capabilities the engine can dispatch.
 *
 * Phase 2A: one capability.
 * Phase 3+: add "upscale" | "lipSync" | "cinematic_extend" | ...
 */
export type CapabilityName = "renderWithQuality";

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY PARAMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semantic parameters for the renderWithQuality capability.
 *
 * "tier" uses Zencra vocabulary — never provider vocabulary.
 * The capability registry translates to provider terms at dispatch time.
 *
 * "references" is the transport for the Reference Stack:
 *   references[0] → subject / identity reference
 *   references[1] → scene / style reference
 * The engine does not know how references are delivered to the provider.
 */
export interface RenderWithQualityParams {
  capability: "renderWithQuality";
  tier:        "fast" | "cinematic";
  prompt:      string;
  references?: string[];   // ordered by semantic priority: [subject, scene]
  outputCount?: number;    // default 1
  aspectRatio?: string;    // e.g. "16:9", "1:1" — default "1:1"
}

/**
 * Union of all capability param shapes.
 * Phase 3+: RenderWithQualityParams | UpscaleParams | LipSyncParams | ...
 */
export type CapabilityParams = RenderWithQualityParams;

/**
 * Full capability dispatch payload sent to the registry.
 * Adds orchestration context (userId) to the semantic params.
 */
export interface CapabilityInput {
  userId: string;
  params: CapabilityParams;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY RESULT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a capability returns to the engine.
 * Engine vocabulary only — no provider-specific fields.
 */
export interface CapabilityResult {
  ok:           boolean;
  resultUrls:   string[];
  creditsUsed:  number;
  error?:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single step within a workflow.
 *
 * buildParams receives the run's raw input_payload (JSONB from workflow_runs)
 * and returns semantic CapabilityParams. The step knows nothing about providers.
 */
export interface WorkflowStepSpec {
  stepIndex:   number;
  capability:  CapabilityName;
  buildParams: (payload: Record<string, unknown>) => CapabilityParams;
}

/**
 * A workflow definition — exported by each file under workflows/.
 *
 * intentType must match workflow_runs.intent_type exactly.
 * The engine looks up the definition by intentType at runtime.
 */
export interface WorkflowDefinition {
  intentType: string;
  steps:      WorkflowStepSpec[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ENGINE I/O
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entry point for runWorkflow().
 * The engine loads the workflow_run row from DB by workflowRunId.
 */
export interface RunWorkflowInput {
  workflowRunId: string;
  userId:        string;
}

/**
 * Result returned by runWorkflow().
 * Callers use resultUrls to persist assets or return to the client.
 */
export interface RunWorkflowResult {
  ok:           boolean;
  runId:        string;
  resultUrls?:  string[];
  error?:       string;
}
