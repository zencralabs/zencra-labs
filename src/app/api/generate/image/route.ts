/**
 * POST /api/generate/image — DEPRECATED (410 Gone)
 *
 * This route was replaced by POST /api/studio/image/generate
 * as part of the Zencra Studio provider system (Phase 1).
 *
 * All image generation must use the new studio route.
 */

export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      success: false,
      error:   "This endpoint has been removed. Use POST /api/studio/image/generate instead.",
      code:    "ENDPOINT_REMOVED",
    },
    { status: 410 }
  );
}
