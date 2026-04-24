/**
 * POST /api/generate — DEPRECATED (410 Gone)
 *
 * This route was replaced by the dedicated studio generate routes:
 *   POST /api/studio/image/generate
 *   POST /api/studio/video/generate
 *   POST /api/studio/audio/generate
 *
 * Deprecated as part of Zencra Studio Phase 1 provider migration.
 */

export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      success: false,
      error:   "This endpoint has been removed. Use the appropriate /api/studio/* generate route instead.",
      code:    "ENDPOINT_REMOVED",
    },
    { status: 410 }
  );
}
