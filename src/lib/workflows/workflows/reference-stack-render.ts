/**
 * src/lib/workflows/workflows/reference-stack-render.ts
 *
 * Phase 2A — First Workflow Definition: Reference Stack Render
 *
 * ── What this is ──────────────────────────────────────────────────────────────
 *   The first orchestration workflow in Zencra's engine.
 *   It is intentionally the smallest workflow that exercises the full stack:
 *
 *     semantic quality   →  tier: "cinematic"
 *     render policy      →  renderWithQuality capability
 *     compositional transport → references[]
 *     capability resolution  → capability registry
 *     provider execution     → gpt-image-2 (invisible to this file)
 *     asset output           → resultUrls[]
 *     workflow state         → workflow_runs + workflow_steps
 *     retry foundation       → idempotency_key on step
 *
 *   This makes it the ideal proof system for Phase 2A.
 *
 * ── What this file knows ──────────────────────────────────────────────────────
 *   - The semantic shape of the input payload (prompt, tier, references, etc.)
 *   - The capability name: "renderWithQuality"
 *   - The step sequence (one step, Phase 2A)
 *
 * ── What this file does NOT know ─────────────────────────────────────────────
 *   - Which provider executes the step
 *   - What "cinematic" means to the provider (OpenAI "medium")
 *   - How references are delivered (FormData, array, URL list)
 *   - Any API-level detail
 *
 * ── Expected input_payload shape (in workflow_runs) ──────────────────────────
 *   {
 *     prompt:      string              // required
 *     tier?:       "fast" | "cinematic" // default: "cinematic"
 *     references?: string[]            // ordered: [subject, scene]
 *     aspectRatio?: string             // e.g. "16:9" — default: "1:1"
 *     outputCount?: number             // default: 1
 *   }
 */

import type { WorkflowDefinition, RenderWithQualityParams } from "../types";

export const referenceStackRenderWorkflow: WorkflowDefinition = {
  intentType: "reference_stack_render",

  steps: [
    {
      stepIndex:  0,
      capability: "renderWithQuality",

      /**
       * Build capability params from the run's input_payload.
       *
       * Validates required fields and applies sensible defaults.
       * The engine calls this immediately before dispatching the step.
       */
      buildParams(payload: Record<string, unknown>): RenderWithQualityParams {
        const prompt = typeof payload.prompt === "string" && payload.prompt.trim().length > 0
          ? payload.prompt.trim()
          : (() => { throw new Error("reference_stack_render: input_payload.prompt is required"); })();

        const tier = payload.tier === "fast" || payload.tier === "cinematic"
          ? payload.tier
          : "cinematic"; // default: cinematic — the Reference Stack's primary use case

        const references = Array.isArray(payload.references)
          ? (payload.references as unknown[])
              .filter((r): r is string => typeof r === "string" && r.length > 0)
              .slice(0, 2) // hard cap: 2 references max (matching gpt-image-2 capability)
          : undefined;

        const aspectRatio = typeof payload.aspectRatio === "string"
          ? payload.aspectRatio
          : "1:1";

        const outputCount = typeof payload.outputCount === "number" && payload.outputCount >= 1
          ? Math.min(payload.outputCount, 4) // max 4 per call
          : 1;

        return {
          capability:  "renderWithQuality",
          tier,
          prompt,
          references,
          aspectRatio,
          outputCount,
        };
      },
    },
  ],
};
