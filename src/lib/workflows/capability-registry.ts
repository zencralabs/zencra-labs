/**
 * src/lib/workflows/capability-registry.ts
 *
 * Phase 2A Static Capability Registry
 *
 * ── What this file is ─────────────────────────────────────────────────────────
 *   The ONLY file in src/lib/workflows/ that imports from src/lib/providers/.
 *   Every other workflow layer (engine, definitions, types) is provider-free.
 *
 *   The registry is the translation boundary:
 *     Engine vocabulary IN  → provider vocabulary (internal to adapter)
 *     Provider result      → engine vocabulary OUT
 *
 * ── Phase 2A: static routing ──────────────────────────────────────────────────
 *   renderWithQuality → gpt-image-2 (static, unconditional)
 *
 * ── Phase 2B/3: dynamic resolver (do not build yet) ──────────────────────────
 *   Replace the static switch with a resolver that can select providers
 *   by capability, cost, latency, or health state.
 *   The engine and workflow definitions never change — only this file changes.
 *
 * ── The line to protect ───────────────────────────────────────────────────────
 *   Provider knowledge (API strings, model IDs, FormData shapes, size maps)
 *   must NEVER appear above this file. If it leaks upward into the engine
 *   or workflow definitions, the orchestration boundary has collapsed.
 */

import type { CapabilityInput, CapabilityParams, CapabilityResult } from "./types";
import type { ZProviderInput, AspectRatio } from "../providers/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a capability to the appropriate provider adapter.
 *
 * The switch is exhaustive — TypeScript will error if a CapabilityName
 * is added to types.ts without a matching case here.
 */
export async function executeCapability(
  input: CapabilityInput,
): Promise<CapabilityResult> {
  const { params, userId } = input;

  switch (params.capability) {
    case "renderWithQuality":
      // billingMode is carried on the CapabilityInput but is NOT forwarded to
      // createJob(). The registry calls createJob() directly — the orchestrator's
      // credit hooks are never invoked here regardless of mode. billingMode is
      // consumed upstream: the route reserves credits ("workflow_reserved") or
      // the orchestrator's dispatch() reserves them ("direct"). The registry's
      // job is execution only.
      return renderWithQuality({ userId, params, billingMode: input.billingMode });

    default: {
      // TypeScript exhaustiveness guard — compile error if a new capability
      // is added to CapabilityName without a matching case.
      const exhausted = params as never;
      return {
        ok:          false,
        resultUrls:  [],
        creditsUsed: 0,
        error:       `Unknown capability: ${String((exhausted as CapabilityInput["params"]).capability)}`,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COST ESTIMATION (route-level pre-reservation support)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimate the credit cost for a capability without executing it.
 *
 * Used by workflow routes to pre-reserve credits before calling createWorkflowRun().
 * Uses the same DB-backed pricing engine as the direct Image Studio path so
 * estimates are consistent between billing modes.
 *
 * Returns the expected cost in credits (integer). Returns 0 on any estimation
 * error — callers should treat 0 as "unknown cost, proceed with caution."
 *
 * This function is the ONLY place in the workflow layer that imports from
 * src/lib/credits/ — consistent with the registry being the only file that
 * imports from src/lib/providers/.
 */
export async function estimateCapabilityCost(
  params: CapabilityParams,
): Promise<number> {
  switch (params.capability) {
    case "renderWithQuality": {
      try {
        // Dynamic imports — keep credit system out of the module graph for unit
        // tests that mock executeCapability without Supabase credentials.
        const { supabaseAdmin }                         = await import("../supabase/admin");
        const { buildSupabaseCreditStore, buildCreditHooks } = await import("../credits/hooks");

        const store = buildSupabaseCreditStore(supabaseAdmin);
        const hooks = buildCreditHooks({
          provider: "openai",
          modelKey: "gpt-image-2",   // Phase 2A: static. Phase 3: resolved by registry.
          studio:   "image",
          store,
        });

        // Construct a minimal ZProviderInput — only the fields estimate() reads.
        // userId is intentionally empty: estimate() does not use it.
        const zpInput: ZProviderInput = {
          requestId:      `wf-estimate-${Date.now()}`,
          userId:         "",
          studioType:     "image",
          modelKey:       "gpt-image-2",
          prompt:         params.prompt,
          aspectRatio:    (params.aspectRatio ?? "1:1") as AspectRatio,
          providerParams: { quality: params.tier },
        };

        const estimate = await hooks.estimate(zpInput);
        return estimate.expected;
      } catch (err) {
        console.error("[capability-registry] estimateCapabilityCost error:", err);
        return 0; // unknown — caller proceeds without pre-reservation guarantee
      }
    }

    default: {
      // TypeScript exhaustiveness guard — compile error if CapabilityName grows
      // without a matching case in this function.
      const _exhausted = params as never;
      void _exhausted;
      return 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// renderWithQuality → gpt-image-2 (Phase 2A static routing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapter for the "renderWithQuality" capability.
 *
 * Translates engine vocabulary → ZProviderInput, calls gpt-image-2,
 * translates the result back to CapabilityResult.
 *
 * Provider knowledge that lives HERE and nowhere else:
 *   - "gpt-image-2" model key
 *   - providerParams.quality carries the Zencra tier string
 *     ("fast" | "cinematic") — gpt-image.ts translates to OpenAI values
 *   - studioType: "image"
 *
 * The calling code (engine, workflow definition) sees only:
 *   tier: "cinematic"  →  CapabilityResult { ok, resultUrls, creditsUsed }
 */
async function renderWithQuality(input: CapabilityInput): Promise<CapabilityResult> {
  const { params, userId, billingMode } = input;
  void billingMode; // consumed upstream — no provider-level hook to suppress here
  if (params.capability !== "renderWithQuality") {
    return { ok: false, resultUrls: [], creditsUsed: 0, error: "Capability mismatch" };
  }

  // Dynamic import — keeps provider out of the module graph for unit tests
  // that mock executeCapability without needing real OpenAI credentials.
  const { gptImage2Provider } = await import("../providers/image/gpt-image");

  // Translate: engine vocabulary → ZProviderInput (provider contract)
  //   tier ("fast" | "cinematic") → providerParams.quality
  //   gpt-image.ts translates "cinematic" → OpenAI "medium" internally.
  //   The engine never learns about "low" / "medium" / "high".
  const zpInput: ZProviderInput = {
    requestId:      `wf-cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    studioType:     "image",
    modelKey:       "gpt-image-2",
    prompt:         params.prompt,
    imageUrls:      params.references,
    aspectRatio:    (params.aspectRatio ?? "1:1") as AspectRatio,
    providerParams: { quality: params.tier },
    // outputCount is intentionally not forwarded — gpt-image-2 Phase 2A
    // uses n=1 per dispatch call. Multi-output is a Phase 2B concern.
  };

  try {
    const job = await gptImage2Provider.createJob(zpInput);

    if (job.status !== "success") {
      return {
        ok:          false,
        resultUrls:  [],
        creditsUsed: 0,
        error:       job.error ?? "Render step did not complete",
      };
    }

    // Extract result URLs — prefer urls[] (batch), fall back to url (single)
    const urls: string[] = job.result?.urls?.length
      ? job.result.urls
      : job.result?.url
        ? [job.result.url]
        : [];

    if (urls.length === 0) {
      return {
        ok:          false,
        resultUrls:  [],
        creditsUsed: 0,
        error:       "Provider returned no image URLs",
      };
    }

    return {
      ok:          true,
      resultUrls:  urls,
      creditsUsed: job.actualCredits ?? job.estimatedCredits?.expected ?? 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[capability-registry] renderWithQuality error:", message);
    return { ok: false, resultUrls: [], creditsUsed: 0, error: message };
  }
}
