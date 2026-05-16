/**
 * src/lib/workflows/workflow-engine.ts
 *
 * Phase 2A Workflow Engine — Orchestration Runtime
 *
 * ── What this is ──────────────────────────────────────────────────────────────
 *   The engine executes a workflow_run:
 *     1. Load the workflow_run row from workflow_runs (DB)
 *     2. Resolve the WorkflowDefinition by intent_type
 *     3. Execute each step via the capability registry
 *     4. Persist step state to workflow_steps (DB)
 *     5. Finalize the workflow_run at terminal state
 *
 *   The engine knows:
 *     - workflow state (pending / running / completed / failed)
 *     - step state (pending / running / completed / failed)
 *     - idempotency_key format: "{run_id}:{step_index}:{attempt}"
 *     - credit accounting (credit_used per step → credit_released at terminal)
 *
 *   The engine does NOT know:
 *     - Which provider executes a step (that is the registry's concern)
 *     - How a provider's API works (that is the adapter's concern)
 *     - How to build step inputs (that is the workflow definition's concern)
 *
 * ── DB tables ─────────────────────────────────────────────────────────────────
 *   workflow_runs  — one row per orchestration intent
 *   workflow_steps — one row per step × attempt
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 *   Each step insertion is guarded by the (workflow_run_id, step_index, attempt)
 *   UNIQUE constraint. Duplicate dispatch on retry is safe — the DB rejects the
 *   second INSERT and the engine reads the existing row instead.
 *
 * ── Phase 2B additions (do not build yet) ─────────────────────────────────────
 *   - Retry loop: on step failure, increment attempt, re-dispatch
 *   - Multi-step workflows: pass step N output as step N+1 input
 *   - Credit reservation: reserve at run creation, release at terminal
 *   - Long-poll / webhook bridging for async providers
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { executeCapability } from "./capability-registry";
import { WORKFLOW_REGISTRY } from "./workflows";
import type {
  RunWorkflowInput,
  RunWorkflowResult,
  WorkflowDefinition,
  CapabilityInput,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT RELEASE HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically return credits to a user balance via the refund_credits RPC.
 * Non-fatal: logs on error but does not propagate — the job is already done.
 * A refund failure means the user keeps their credits (safe direction).
 *
 * @param userId          User who reserved the credits
 * @param amount          Credits to return (must be > 0)
 * @param description     Audit description for credit_transactions
 * @param workflowRunId   Associated run (passed as p_generation_id for auditability)
 */
async function releaseCredits(
  userId:        string,
  amount:        number,
  description:   string,
  workflowRunId: string,
): Promise<void> {
  if (amount <= 0) return;

  const { error } = await supabaseAdmin.rpc("refund_credits", {
    p_user_id:       userId,
    p_amount:        amount,
    p_description:   description,
    p_generation_id: workflowRunId,
  });

  if (error) {
    console.error(
      `[workflow-engine] releaseCredits failed (run=${workflowRunId} amount=${amount}):`,
      error.message,
    );
  } else {
    console.info(
      `[workflow-engine] releaseCredits ok (run=${workflowRunId} amount=${amount})`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a workflow run end-to-end.
 *
 * The caller has already created the workflow_run row (via createWorkflowRun)
 * and stored the input_payload. This function picks it up and executes it.
 *
 * Returns a typed result — never throws. All errors are caught and surfaced
 * in the result.error field, and persisted to workflow_runs.error_message.
 */
export async function runWorkflow(
  input: RunWorkflowInput,
): Promise<RunWorkflowResult> {
  const { workflowRunId, userId, creditReserved: inputCreditReserved = 0 } = input;

  // ── 1. Load the workflow_run row ───────────────────────────────────────────
  const { data: runRow, error: runLoadErr } = await supabaseAdmin
    .from("workflow_runs")
    .select("id, intent_type, input_payload, status, credit_reserved")
    .eq("id", workflowRunId)
    .eq("user_id", userId)
    .single();

  if (runLoadErr || !runRow) {
    const msg = runLoadErr?.message ?? "workflow_run not found";
    console.error("[workflow-engine] load run error:", msg);

    // Defensive refund: if the caller pre-reserved credits but we can't even
    // load the run row, return the reserved amount now. This is an edge case
    // (DB transient error after createWorkflowRun succeeded) — log it loudly.
    if (inputCreditReserved > 0) {
      console.error(
        `[workflow-engine] run-load-fail with pre-reserved credits (amount=${inputCreditReserved}). ` +
        `Refunding to userId=${userId}.`,
      );
      await releaseCredits(
        userId,
        inputCreditReserved,
        `Workflow run-load-fail refund (run=${workflowRunId})`,
        workflowRunId,
      );
    }

    return { ok: false, runId: workflowRunId, error: msg };
  }

  // Prevent re-running a terminal workflow
  if (runRow.status === "completed" || runRow.status === "failed" || runRow.status === "cancelled") {
    return {
      ok:    runRow.status === "completed",
      runId: workflowRunId,
      error: runRow.status !== "completed" ? `Run already in terminal state: ${runRow.status}` : undefined,
    };
  }

  // ── 2. Resolve the workflow definition ────────────────────────────────────
  const definition: WorkflowDefinition | undefined = WORKFLOW_REGISTRY[runRow.intent_type];
  if (!definition) {
    const msg = `No workflow definition for intent_type: ${runRow.intent_type}`;
    console.error("[workflow-engine]", msg);
    await failRun(workflowRunId, msg, { userId, creditReserved: (runRow.credit_reserved as number) ?? 0, creditUsedSoFar: 0 });
    return { ok: false, runId: workflowRunId, error: msg };
  }

  // ── 3. Mark run as running ────────────────────────────────────────────────
  await supabaseAdmin
    .from("workflow_runs")
    .update({ status: "running" })
    .eq("id", workflowRunId);

  // ── 4. Execute steps ──────────────────────────────────────────────────────
  const payload          = (runRow.input_payload ?? {}) as Record<string, unknown>;
  const creditReservedDB = (runRow.credit_reserved as number) ?? 0;
  const allResultUrls: string[] = [];
  let totalCreditsUsed = 0;

  for (const stepSpec of definition.steps) {
    const { stepIndex, capability, buildParams } = stepSpec;
    const attempt = 1; // Phase 2B: retry loop increments this
    const idempotencyKey = `${workflowRunId}:${stepIndex}:${attempt}`;

    // ── Insert step row (idempotent via UNIQUE constraint) ─────────────────
    const stepInput = buildParams(payload);
    const { data: stepRow, error: stepInsertErr } = await supabaseAdmin
      .from("workflow_steps")
      .upsert(
        {
          workflow_run_id:  workflowRunId,
          step_index:       stepIndex,
          attempt,
          idempotency_key:  idempotencyKey,
          capability,
          status:           "pending",
          input_payload:    stepInput,
        },
        { onConflict: "workflow_run_id,step_index,attempt", ignoreDuplicates: false },
      )
      .select("id, status, output_payload")
      .single();

    if (stepInsertErr || !stepRow) {
      const msg = stepInsertErr?.message ?? "Failed to create workflow_step row";
      console.error("[workflow-engine] step insert error:", msg);
      await failRun(workflowRunId, msg, { userId, creditReserved: creditReservedDB, creditUsedSoFar: totalCreditsUsed });
      return { ok: false, runId: workflowRunId, error: msg };
    }

    // If this step already completed (resume after crash), collect its output
    if (stepRow.status === "completed") {
      const out = stepRow.output_payload as Record<string, unknown> | null;
      const urls = (out?.resultUrls as string[] | undefined) ?? [];
      allResultUrls.push(...urls);
      continue;
    }

    // ── Mark step as running ───────────────────────────────────────────────
    await supabaseAdmin
      .from("workflow_steps")
      .update({
        status:        "running",
        started_at:    new Date().toISOString(),
        provider_key:  "openai",    // Phase 2A: static. Phase 3: resolved by registry.
        model_key:     "gpt-image-2",
      })
      .eq("id", stepRow.id);

    // ── Dispatch to capability registry ────────────────────────────────────
    // billingMode: "workflow_reserved" — credits were pre-deducted at the route.
    // The registry must NOT apply provider-level credit hooks (it already bypasses
    // them by calling createJob() directly, but the field makes the contract explicit).
    const capInput: CapabilityInput = {
      userId,
      params:      stepInput,
      billingMode: "workflow_reserved",
    };
    const capResult = await executeCapability(capInput);

    if (!capResult.ok) {
      const msg = capResult.error ?? "Capability execution failed";
      console.error(`[workflow-engine] step ${stepIndex} failed:`, msg);

      await supabaseAdmin
        .from("workflow_steps")
        .update({
          status:        "failed",
          error_message: msg,
          completed_at:  new Date().toISOString(),
        })
        .eq("id", stepRow.id);

      await failRun(workflowRunId, msg, { userId, creditReserved: creditReservedDB, creditUsedSoFar: totalCreditsUsed });
      return { ok: false, runId: workflowRunId, error: msg };
    }

    // ── Mark step as completed ─────────────────────────────────────────────
    totalCreditsUsed += capResult.creditsUsed;
    allResultUrls.push(...capResult.resultUrls);

    await supabaseAdmin
      .from("workflow_steps")
      .update({
        status:         "completed",
        output_payload: { resultUrls: capResult.resultUrls, creditsUsed: capResult.creditsUsed },
        credits_used:   capResult.creditsUsed,
        completed_at:   new Date().toISOString(),
      })
      .eq("id", stepRow.id);

    console.info(
      `[workflow-engine] step ${stepIndex} completed: ${capResult.resultUrls.length} url(s), ${capResult.creditsUsed} cr`,
    );
  }

  // ── 5. Mark run as completed ──────────────────────────────────────────────
  const creditReleased = Math.max(0, creditReservedDB - totalCreditsUsed);

  await supabaseAdmin
    .from("workflow_runs")
    .update({
      status:          "completed",
      credit_used:     totalCreditsUsed,
      credit_released: creditReleased,
      completed_at:    new Date().toISOString(),
    })
    .eq("id", workflowRunId);

  // ── Release unused pre-reserved credits ───────────────────────────────────
  // Return the difference between what was reserved and what was actually used.
  // This is the "workflow_reserved" billing path: the route pre-deducted the
  // full estimated cost; we refund the unused portion now at terminal state.
  if (creditReleased > 0) {
    await releaseCredits(
      userId,
      creditReleased,
      `Workflow completed — ${creditReleased} cr released (reserved=${creditReservedDB} used=${totalCreditsUsed})`,
      workflowRunId,
    );
  }

  console.info(
    `[workflow-engine] run ${workflowRunId} completed: ${allResultUrls.length} url(s), ` +
    `${totalCreditsUsed} cr used, ${creditReleased} cr released`,
  );

  return { ok: true, runId: workflowRunId, resultUrls: allResultUrls };
}

// ─────────────────────────────────────────────────────────────────────────────
// createWorkflowRun
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a workflow_run row before calling runWorkflow().
 *
 * Called by API routes after auth + credit pre-check.
 * Accepts the semantic input payload — the engine reads it at execution time.
 */
export async function createWorkflowRun(params: {
  userId:         string;
  intentType:     string;
  inputPayload:   Record<string, unknown>;
  creditReserved?: number;
}): Promise<{ ok: true; workflowRunId: string } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdmin
    .from("workflow_runs")
    .insert({
      user_id:         params.userId,
      intent_type:     params.intentType,
      input_payload:   params.inputPayload,
      credit_reserved: params.creditReserved ?? 0,
      source:          "studio",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[workflow-engine] createWorkflowRun error:", error?.message);
    return { ok: false, error: error?.message ?? "Failed to create workflow run" };
  }

  return { ok: true, workflowRunId: data.id as string };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a workflow run as failed and optionally refund pre-reserved credits.
 *
 * creditContext — present when the route pre-reserved credits (workflow billing).
 *   creditReserved   — total credits deducted upfront by the route.
 *   creditUsedSoFar  — credits consumed by steps that completed before the failure.
 *   The refund amount = max(0, reserved - usedSoFar).
 *
 * On failure of a single-step workflow (Phase 2C), creditUsedSoFar is always 0
 * because the capability failure means no assets were produced and no provider-level
 * billing occurred (the registry calls createJob() directly, not dispatch()).
 */
async function failRun(
  workflowRunId: string,
  errorMessage:  string,
  creditContext?: { userId: string; creditReserved: number; creditUsedSoFar: number },
): Promise<void> {
  const creditUsedSoFar = creditContext?.creditUsedSoFar ?? 0;
  const refundAmount    = creditContext
    ? Math.max(0, creditContext.creditReserved - creditUsedSoFar)
    : 0;

  await supabaseAdmin
    .from("workflow_runs")
    .update({
      status:          "failed",
      error_message:   errorMessage,
      credit_used:     creditUsedSoFar,
      credit_released: refundAmount,
      completed_at:    new Date().toISOString(),
    })
    .eq("id", workflowRunId);

  // Return unused pre-reserved credits to the user's balance.
  if (creditContext && refundAmount > 0) {
    await releaseCredits(
      creditContext.userId,
      refundAmount,
      `Workflow failed — ${refundAmount} cr returned (reserved=${creditContext.creditReserved} used=${creditUsedSoFar})`,
      workflowRunId,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STALE-RUN RECOVERY (Phase 2D)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result returned by recoverStaleWorkflowRun().
 *
 * recovered      — true if the run was actually transitioned pending/running → failed.
 *                  false if the run was already terminal (no-op, no refund).
 * refundedCredits — credits returned to the user's balance (0 if recovered=false).
 * error          — set when a DB or refund operation failed mid-recovery.
 */
export interface StaleRecoveryResult {
  recovered:       boolean;
  refundedCredits: number;
  error?:          string;
}

/**
 * Safely recover a single stale workflow run.
 *
 * ── Idempotency contract ──────────────────────────────────────────────────────
 *   The DB UPDATE is conditioned on `status IN ('pending', 'running')`.
 *   If the run is already at a terminal state (completed / failed / cancelled),
 *   the UPDATE touches zero rows and this function returns { recovered: false }.
 *   No refund is issued. Re-running the cron against the same run is always safe.
 *
 * ── Refund logic ─────────────────────────────────────────────────────────────
 *   Refund = max(0, credit_reserved - credit_used).
 *   credit_used is NULL for runs that never reached a terminal state — treat as 0.
 *   This returns the full reserved amount for crashes before any step completed.
 *
 * ── Error handling ────────────────────────────────────────────────────────────
 *   A DB error on the UPDATE surfaces in result.error but does NOT throw.
 *   The cron handler must continue processing remaining stale runs on error.
 *
 * @param workflowRunId  ID of the stale workflow_run row
 * @param userId         Owner — used for credit refund
 * @param creditReserved Credits reserved at run creation (from credit_reserved column)
 * @param creditUsedSoFar Credits consumed by completed steps (from credit_used column; null → 0)
 */
export async function recoverStaleWorkflowRun(
  workflowRunId:   string,
  userId:          string,
  creditReserved:  number,
  creditUsedSoFar: number,
): Promise<StaleRecoveryResult> {
  const safeUsed     = Math.max(0, creditUsedSoFar);
  const refundAmount = Math.max(0, creditReserved - safeUsed);
  const now          = new Date().toISOString();

  // ── Atomic transition: pending/running → failed ───────────────────────────
  // The .in("status", [...]) condition is the idempotency guard.
  // If status is already completed/failed/cancelled, zero rows are updated
  // and `updated` will be an empty array — skip refund entirely.
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("workflow_runs")
    .update({
      status:          "failed",
      error_message:   "Workflow recovered as stale after exceeding timeout.",
      credit_used:     safeUsed,
      credit_released: refundAmount,
      completed_at:    now,
    })
    .eq("id", workflowRunId)
    .in("status", ["pending", "running"])   // ← idempotency guard
    .select("id");

  if (updateErr) {
    console.error(
      `[workflow-engine] recoverStaleWorkflowRun DB error (run=${workflowRunId}):`,
      updateErr.message,
    );
    return { recovered: false, refundedCredits: 0, error: updateErr.message };
  }

  // No rows updated — run was already terminal. No refund, no error.
  if (!updated || updated.length === 0) {
    console.info(
      `[workflow-engine] recoverStaleWorkflowRun: run=${workflowRunId} already terminal — skipped`,
    );
    return { recovered: false, refundedCredits: 0 };
  }

  // Row transitioned. Now issue the credit refund if applicable.
  console.info(
    `[workflow-engine] recoverStaleWorkflowRun: run=${workflowRunId} marked failed ` +
    `(reserved=${creditReserved} used=${safeUsed} refund=${refundAmount})`,
  );

  if (refundAmount > 0) {
    await releaseCredits(
      userId,
      refundAmount,
      `Stale workflow recovery — ${refundAmount} cr returned (reserved=${creditReserved} used=${safeUsed})`,
      workflowRunId,
    );
  }

  return { recovered: true, refundedCredits: refundAmount };
}
