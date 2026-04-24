/**
 * GET /api/generate/status/[provider]/[taskId] — DEPRECATED (410 Gone)
 *
 * This route was replaced by GET /api/studio/jobs/[jobId]/status
 * as part of the Zencra Studio provider system (Phase 1).
 */

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      success: false,
      error:   "This endpoint has been removed. Use GET /api/studio/jobs/[jobId]/status instead.",
      code:    "ENDPOINT_REMOVED",
    },
    { status: 410 }
  );
}
