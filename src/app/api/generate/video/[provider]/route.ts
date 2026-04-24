/**
 * POST /api/generate/video/[provider] — DEPRECATED (410 Gone)
 *
 * This route was replaced by POST /api/studio/video/generate
 * as part of the Zencra Studio provider system (Phase 1).
 */

export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      success: false,
      error:   "This endpoint has been removed. Use POST /api/studio/video/generate instead.",
      code:    "ENDPOINT_REMOVED",
    },
    { status: 410 }
  );
}
