/**
 * /api/studio/video/multi-elements — Kling Multi-Elements Editing route
 *
 * STATUS: 503 Stub — Phase 2 activation required.
 *
 * This route is intentionally disabled in production.
 * It returns 503 Service Unavailable until:
 *   1. KLING_MULTI_ELEMENTS_ENABLED=true is set in Vercel env vars
 *   2. Pricing is locked in credit_model_costs (base_credits > 1, active = true)
 *   3. The full session-flow implementation is wired (see kling-multi-elements.ts)
 *
 * IMPORTANT: Kling Multi-Elements Editing is NOT a standard ZProvider route.
 * Do NOT route it through /api/studio/video/generate or studio-dispatch.
 * It is a separate stateful workflow with 7 endpoints and session lifecycle.
 *
 * See: src/lib/providers/video/kling-multi-elements.ts for full documentation.
 */

import { NextResponse } from "next/server";
import { isMultiElementsEnabled } from "@/lib/providers/video/kling-multi-elements";

export async function POST() {
  if (!isMultiElementsEnabled()) {
    return NextResponse.json(
      {
        error:   "SERVICE_UNAVAILABLE",
        message: "Kling Multi-Elements Editing is not yet available. " +
                 "This feature requires account activation and pricing confirmation before launch.",
        code:    503,
      },
      { status: 503 },
    );
  }

  // Phase 2: Full implementation goes here.
  // Steps:
  //   1. Auth check (requireAuthUser)
  //   2. Entitlement check (checkEntitlement)
  //   3. Parse operation from request body (init | add | delete | preview | create | poll | list)
  //   4. Route to the correct kling-multi-elements function
  //   5. Return typed response
  //
  // Credits: lock pricing in credit_model_costs before implementing step 2.
  return NextResponse.json(
    { error: "NOT_IMPLEMENTED", message: "Multi-Elements implementation pending Phase 2 activation." },
    { status: 501 },
  );
}

export async function GET() {
  if (!isMultiElementsEnabled()) {
    return NextResponse.json(
      {
        error:   "SERVICE_UNAVAILABLE",
        message: "Kling Multi-Elements Editing is not yet available.",
        code:    503,
      },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: "NOT_IMPLEMENTED", message: "Multi-Elements status/list pending Phase 2 activation." },
    { status: 501 },
  );
}
