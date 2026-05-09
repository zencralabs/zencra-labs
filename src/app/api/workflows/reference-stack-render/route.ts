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
import { checkStudioRateLimit, checkIpStudioRateLimit, getClientIp }
  from "@/lib/security/rate-limit";
import { checkEntitlement }  from "@/lib/billing/entitlement";
import { StudioDispatchError, dispatchErrorStatus }
  from "@/lib/api/studio-dispatch";
import { createWorkflowRun, runWorkflow }
  from "@/lib/workflows/workflow-engine";
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

  // ── Billing entitlement ───────────────────────────────────────────────────────
  // Reuse the "image" entitlement gate — Reference Stack renders are image outputs.
  // Phase 2C: replace with a workflow-specific entitlement path.
  try {
    await checkEntitlement(userId, "image");
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

  // ── Create workflow run ───────────────────────────────────────────────────────
  // credit_reserved = 0 in Phase 2B — actual credit accounting is handled inside
  // the capability registry via the existing provider creditHooks layer.
  const runResult = await createWorkflowRun({
    userId,
    intentType:     "reference_stack_render",
    inputPayload:   {
      prompt,
      tier,
      references:  references.length > 0 ? references : undefined,
      aspectRatio,
      outputCount,
    },
    creditReserved: 0,
  });

  if (!runResult.ok) {
    logger.error("workflow-route", "createWorkflowRun failed", { userId, error: runResult.error });
    return serverErr(runResult.error ?? "Failed to create workflow run");
  }

  // ── Execute workflow ──────────────────────────────────────────────────────────
  const result = await runWorkflow({
    workflowRunId: runResult.workflowRunId,
    userId,
  });

  if (!result.ok) {
    logger.error("workflow-route", "runWorkflow failed", {
      userId,
      runId: runResult.workflowRunId,
      error: result.error,
    });
    return apiErr("SERVER_ERROR", result.error ?? "Workflow execution failed", 500);
  }

  // ── Return result ─────────────────────────────────────────────────────────────
  return ok({
    runId:      result.runId,
    resultUrls: result.resultUrls ?? [],
  });
}
