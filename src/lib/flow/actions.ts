"use server";

/**
 * src/lib/flow/actions.ts
 *
 * Creative Flow — server actions for workflow DB persistence.
 *
 * These are called from studio pages AFTER a successful generation.
 * The Zustand store is the cache layer; these actions are the source of truth.
 *
 * Conventions:
 *   - All actions use the service-role admin client (billing-grade operations).
 *   - RLS is enforced at the table level; these bypass it via service role.
 *   - All functions return a typed result (never throw to the client).
 *   - UX-facing strings avoid "workflow", "step", "pipeline".
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FlowStep, FlowStudioType } from "./store";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CreateWorkflowResult =
  | { ok: true;  workflowId: string }
  | { ok: false; error: string };

export type AddStepResult =
  | { ok: true;  step: FlowStep }
  | { ok: false; error: string };

export type GetRecentStepsResult =
  | { ok: true;  steps: FlowStep[] }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// createWorkflow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new workflow row.
 * Called when the user makes their first generation in a session
 * and the store has no workflowId yet.
 */
export async function createWorkflow(
  userId: string,
): Promise<CreateWorkflowResult> {
  const { data, error } = await supabaseAdmin
    .from("workflows_legacy")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[flow/actions] createWorkflow error:", error?.message);
    return { ok: false, error: error?.message ?? "Failed to create workflow" };
  }

  return { ok: true, workflowId: data.id as string };
}

// ─────────────────────────────────────────────────────────────────────────────
// addWorkflowStep
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a workflow_step row and optionally links an asset.
 * Returns the full FlowStep shape for the Zustand store.
 */
export async function addWorkflowStep(params: {
  workflowId:    string;
  userId:        string;
  studioType:    FlowStudioType;
  modelKey:      string;
  prompt:        string;
  negativePrompt?: string;
  aspectRatio?:  string;
  seed?:         number;
  resultUrl?:    string;
  resultUrls?:   string[];
  status:        "pending" | "success" | "error";
  creditsUsed?:  number;
  assetId?:      string;   // generations table row ID
}): Promise<AddStepResult> {
  // Determine next step_number for this workflow
  const { count } = await supabaseAdmin
    .from("workflow_steps_legacy")
    .select("id", { count: "exact", head: true })
    .eq("workflow_id", params.workflowId);

  const stepNumber = (count ?? 0) + 1;

  const { data: stepRow, error: stepErr } = await supabaseAdmin
    .from("workflow_steps_legacy")
    .insert({
      workflow_id:     params.workflowId,
      user_id:         params.userId,
      step_number:     stepNumber,
      studio_type:     params.studioType,
      model_key:       params.modelKey,
      prompt:          params.prompt,
      negative_prompt: params.negativePrompt ?? null,
      aspect_ratio:    params.aspectRatio ?? null,
      seed:            params.seed ?? null,
      result_url:      params.resultUrl ?? null,
      result_urls:     params.resultUrls ?? null,
      status:          params.status,
      credits_used:    params.creditsUsed ?? null,
    })
    .select("id, created_at")
    .single();

  if (stepErr || !stepRow) {
    console.error("[flow/actions] addWorkflowStep error:", stepErr?.message);
    return { ok: false, error: stepErr?.message ?? "Failed to add step" };
  }

  // Optionally link the asset
  if (params.assetId) {
    try {
      await supabaseAdmin
        .from("workflow_step_assets_legacy")
        .insert({
          step_id:    stepRow.id,
          user_id:    params.userId,
          asset_id:   params.assetId,
          asset_type: "generation",
        });
    } catch (e) {
      // Non-fatal — step is already persisted
      console.warn("[flow/actions] workflow_step_assets insert failed:", e);
    }
  }

  const step: FlowStep = {
    id:           stepRow.id as string,
    stepNumber,
    studioType:   params.studioType,
    modelKey:     params.modelKey,
    prompt:       params.prompt,
    resultUrl:    params.resultUrl ?? null,
    thumbnailUrl: params.resultUrl ?? null,
    status:       params.status,
    createdAt:    stepRow.created_at as string,
  };

  return { ok: true, step };
}

// ─────────────────────────────────────────────────────────────────────────────
// getRecentSteps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the last N steps for a workflow.
 * Used to hydrate the FlowBar when the store is empty (e.g., page refresh).
 */
export async function getRecentSteps(
  workflowId: string,
  limit: number = 3,
): Promise<GetRecentStepsResult> {
  const { data, error } = await supabaseAdmin
    .from("workflow_steps")
    .select("id, step_number, studio_type, model_key, prompt, result_url, status, created_at")
    .eq("workflow_id", workflowId)
    .order("step_number", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[flow/actions] getRecentSteps error:", error.message);
    return { ok: false, error: error.message };
  }

  const steps: FlowStep[] = (data ?? []).map((row) => ({
    id:           row.id as string,
    stepNumber:   row.step_number as number,
    studioType:   row.studio_type as FlowStudioType,
    modelKey:     row.model_key as string,
    prompt:       row.prompt as string,
    resultUrl:    row.result_url as string | null,
    thumbnailUrl: row.result_url as string | null,
    status:       row.status as "pending" | "success" | "error",
    createdAt:    row.created_at as string,
  }));

  // Return in ascending order (oldest first) for FlowBar left-to-right rendering
  return { ok: true, steps: steps.reverse() };
}
