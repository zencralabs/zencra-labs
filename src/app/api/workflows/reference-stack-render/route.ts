/**
 * POST /api/workflows/reference-stack-render
 *
 * Phase 2B — First public workflow endpoint.
 *
 * ── What this route knows ─────────────────────────────────────────────────────
 *   intent:      "reference_stack_render"
 *   inputs:      prompt, references[], tier ("fast" | "cinematic"), aspectRatio
 *   constraints: references capped at 2, outputCount capped at 4
 *
 * ── What this route does NOT know ────────────────────────────────────────────
 *   OpenAI, GPT Image 2, provider quality strings, size maps, FormData shapes,
 *   or any API-level detail. Those live in the capability registry and below.
 *
 * ── Credit accounting ─────────────────────────────────────────────────────────
 *   Actual credit deduction is handled by the capability registry → provider
 *   layer via the existing creditHooks (reserve / finalize / rollback).
 *   credit_reserved on the workflow_run row is observability only in Phase 2B;
 *   workflow-level pre-reservation is a Phase 2C concern.
 *
 * ── Request body ─────────────────────────────────────────────────────────────
 *   {
 *     prompt:       string              // required
 *     references?:  string[]            // ordered [subject, scene]; max 2
 *     tier?:        "fast" | "cinematic" // default: "cinematic"
 *     aspectRatio?: string              // default: "1:1"
 *     outputCount?: number              // default: 1, max 4
 *   }
 *
 * ── Response (200 OK) ─────────────────────────────────────────────────────────
 *   { success: true, data: { runId, resultUrls: string[] } }
 *
 * ── Error responses ───────────────────────────────────────────────────────────
 *   401 UNAUTHORIZED          — missing or invalid Bearer token
 *   402 INSUFFICIENT_CREDITS  — entitlement gate failed
 *   400 INVALID_INPUT         — missing prompt or malformed body
 *   500 SERVER_ERROR          — workflow run creation or execution failed
 */

import { requireAuthUser }   from "@/lib/supabase/server";
import {
  parseBody,
  requireField,
  serverErr,
  ok,
  apiErr,
} from "@/lib/api/route-utils";
import {
  checkStudioRateLimit,
  checkIpStudioRateLimit,
  checkConcurrentWorkflowLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { checkEntitlement }  from "@/lib/billing/entitlement";
import { StudioDispatchError, dispatchErrorStatus }
  from "@/lib/api/studio-dispatch";
import { createWorkflowRun, runWorkflow }
  from "@/lib/workflows/workflow-engine";
import { WORKFLOW_REGISTRY } from "@/lib/workflows/workflows/index";
import { estimateCapabilityCost } from "@/lib/workflows/capability-registry";
import { buildSupabaseCreditStore } from "@/lib/credits/hooks";
import { supabaseAdmin }     from "@/lib/supabase/admin";
import { logger }            from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;
  const userId = user!.id;

  // ── Rate limit ────────────────────────────────────────────────────────────────
  const rateLimitError = await checkStudioRateLimit(userId);
  if (rateLimitError) return rateLimitError;

  const clientIp = getClientIp(req);
  const ipRateLimitError = await checkIpStudioRateLimit(clientIp);
  if (ipRateLimitError) return ipRateLimitError;

  // ── S3-D: Concurrent workflow cap ─────────────────────────────────────────────
  const concurrentLimitError = await checkConcurrentWorkflowLimit(userId);
  if (concurrentLimitError) return concurrentLimitError;

  // ── Billing entitlement ───────────────────────────────────────────────────────
  // Reuse the "image" entitlement gate — Reference Stack renders are image outputs.
  // Creative Director is paid-only: free users are blocked here, before any credit
  // deduction, workflow_runs write, workflow_steps write, or provider execution.
  // Free-tier image generation is available through the normal Image Studio route
  // with Nano Banana models only.
  let entitlement: import("@/lib/billing/entitlement").EntitlementResult | null = null;
  try {
    entitlement = await checkEntitlement(userId, "image");
  } catch (err) {
    if (err instanceof StudioDispatchError) {
      return Response.json(
        { success: false, error: err.message, code: err.code },
        { status: dispatchErrorStatus(err.code) },
      );
    }
    logger.error("workflow-route", "entitlement check failed", { userId, err });
    return serverErr();
  }

  // Creative Director is a paid workflow. Free users cannot generate here.
  if (entitlement?.path === "free") {
    return Response.json(
      {
        success: false,
        error: "Creative Director generation requires a paid plan. Upgrade to continue.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 402 },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  const { body, parseError } = await parseBody(req);
  if (parseError) return parseError;

  // Required
  const { value: prompt, fieldError: pErr } = requireField(body!, "prompt");
  if (pErr) return pErr;

  // Optional — apply defaults and constraints at the route boundary.
  // The workflow definition also validates these, but explicit route-level
  // validation returns cleaner 400s with user-facing messages.
  const tier: "fast" | "cinematic" =
    body!.tier === "fast" ? "fast" : "cinematic";

  const references: string[] = Array.isArray(body!.references)
    ? (body!.references as unknown[])
        .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
        .slice(0, 2) // hard cap: 2 references (Reference Stack semantic contract)
    : [];

  const aspectRatio: string =
    typeof body!.aspectRatio === "string" ? body!.aspectRatio : "1:1";

  const outputCount: number =
    typeof body!.outputCount === "number" && body!.outputCount >= 1
      ? Math.min(body!.outputCount, 4)
      : 1;

  // ── Phase 2C: Workflow-level credit reservation ───────────────────────────────
  //
  // The reference_stack_render workflow uses "workflow_reserved" billing:
  //   1. Estimate the credit cost for each step via the capability registry.
  //   2. Check the user's balance and deduct upfront via spend_credits.
  //   3. Pass the reserved amount to createWorkflowRun so the engine can
  //      release the unused remainder at terminal state.
  //
  // The capability registry still calls createJob() directly — provider-level
  // credit hooks are NOT involved. This keeps the direct Image Studio path
  // (which uses dispatch() + creditHooks) completely isolated.

  const inputPayload = {
    prompt,
    tier,
    references: references.length > 0 ? references : undefined,
    aspectRatio,
    outputCount,
  };

  // ── Estimate total workflow cost ──────────────────────────────────────────────
  const definition = WORKFLOW_REGISTRY["reference_stack_render"];
  let estimatedCost = 0;
  if (definition) {
    for (const step of definition.steps) {
      const stepParams = step.buildParams(inputPayload);
      estimatedCost += await estimateCapabilityCost(stepParams);
    }
  }

  // ── Pre-deduct credits ────────────────────────────────────────────────────────
  // spend_credits is atomic (row-level lock on profiles). If the user has
  // insufficient credits, it returns success=false and we gate here.
  // If estimatedCost is 0 (unknown — estimator fallback), we proceed without
  // pre-deduction and fall back to Phase 2B behaviour (no workflow-level reserve).
  let creditReserved = 0;

  if (estimatedCost > 0) {
    const store = buildSupabaseCreditStore(supabaseAdmin);
    const deducted = await store.deduct(
      userId,
      estimatedCost,
      `Workflow reserve [reference_stack_render] — ${estimatedCost} cr`,
    );

    if (!deducted) {
      return Response.json(
        { success: false, error: "Insufficient credits for this workflow.", code: "INSUFFICIENT_CREDITS" },
        { status: 402 },
      );
    }

    creditReserved = estimatedCost;
    logger.info("workflow-route", "credits reserved", { userId, estimatedCost, creditReserved });
  } else {
    logger.warn("workflow-route", "estimatedCost=0; skipping pre-deduction (fallback to Phase 2B billing)", { userId });
  }

  // ── Create workflow run ───────────────────────────────────────────────────────
  const runResult = await createWorkflowRun({
    userId,
    intentType:   "reference_stack_render",
    inputPayload,
    creditReserved,
  });

  // If run creation fails AFTER credits were deducted, refund immediately.
  // The engine never ran, so no further refund will happen from within the engine.
  if (!runResult.ok) {
    if (creditReserved > 0) {
      const store = buildSupabaseCreditStore(supabaseAdmin);
      await store.restore(
        userId,
        creditReserved,
        `Workflow create-fail refund [reference_stack_render] — ${creditReserved} cr restored`,
      );
      logger.warn("workflow-route", "createWorkflowRun failed; credits refunded", { userId, creditReserved });
    }
    logger.error("workflow-route", "createWorkflowRun failed", { userId, error: runResult.error });
    return serverErr(runResult.error ?? "Failed to create workflow run");
  }

  // ── Execute workflow ──────────────────────────────────────────────────────────
  // Pass creditReserved so the engine can refund on the rare run-load-fail path.
  // All other failure/success terminal states are handled inside runWorkflow().
  const result = await runWorkflow({
    workflowRunId:  runResult.workflowRunId,
    userId,
    creditReserved,
  });

  if (!result.ok) {
    logger.error("workflow-route", "runWorkflow failed", {
      userId,
      runId: runResult.workflowRunId,
      error: result.error,
    });
    return apiErr("SERVER_ERROR", result.error ?? "Workflow execution failed", 500);
  }

  // ── Persist outputs to assets table ──────────────────────────────────────────
  // Non-fatal: failure is caught and logged; resultUrls are still returned.
  const resultUrls = result.resultUrls ?? [];
  let assetIds: string[] = [];
  let assets: Array<Record<string, unknown>> = [];

  try {
    const now = new Date().toISOString();
    const records = resultUrls.map((url) => {
      const id = crypto.randomUUID();
      return {
        id,
        job_id:       result.runId,   // workflow_run id acts as job reference
        user_id:      userId,
        studio:       "image" as const,
        provider:     "workflow",
        model_key:    "reference-stack-render",
        asset_type:   "image" as const,
        status:       "ready" as const,
        mime_type:    "image/png",
        url,
        storage_path: "",
        bucket:       "",
        prompt:       inputPayload.prompt,
        aspect_ratio: inputPayload.aspectRatio,
        studio_meta:  { workflow: { runId: result.runId, tier: inputPayload.tier } },
        created_at:   now,
        updated_at:   now,
      };
    });

    if (records.length > 0) {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("assets")
        .upsert(records, { onConflict: "id" })
        .select("id, url, status, created_at");

      if (insertErr) {
        console.error("[workflow-route] asset persistence failed (non-fatal):", insertErr.message);
      } else {
        assetIds = (inserted ?? []).map((r) => r.id as string);
        assets   = (inserted ?? []) as Array<Record<string, unknown>>;
      }
    }
  } catch (persistErr) {
    console.error("[workflow-route] asset persistence threw (non-fatal):", persistErr);
  }

  // ── Return result ─────────────────────────────────────────────────────────────
  return ok({
    runId: result.runId,
    resultUrls,
    assetIds,
    assets,
  });
}
