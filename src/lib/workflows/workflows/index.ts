/**
 * src/lib/workflows/workflows/index.ts
 *
 * Workflow Registry — static map of intent_type → WorkflowDefinition
 *
 * The engine resolves workflow definitions at runtime by looking up
 * intent_type in this registry.
 *
 * To add a new workflow:
 *   1. Create src/lib/workflows/workflows/<name>.ts
 *   2. Export a WorkflowDefinition with the correct intentType
 *   3. Add it to WORKFLOW_REGISTRY below
 *
 * Phase 2A: one workflow.
 * Phase 3+: cinematic_sequence, lip_sync, style_transfer, ...
 */

import type { WorkflowDefinition } from "../types";
import { referenceStackRenderWorkflow } from "./reference-stack-render";

export const WORKFLOW_REGISTRY: Record<string, WorkflowDefinition> = {
  [referenceStackRenderWorkflow.intentType]: referenceStackRenderWorkflow,
};
