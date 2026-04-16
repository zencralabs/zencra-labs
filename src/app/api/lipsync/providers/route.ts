// GET /api/lipsync/providers
// Returns which lip sync providers are currently configured and ready.
// Used by the frontend to decide whether to show "Coming Soon" or the generate UI.
// No auth required — this is purely capability discovery.

import { NextResponse } from "next/server";
import { getLipSyncProviderStatus } from "@/lib/providers/lipsync";

export async function GET() {
  const status = getLipSyncProviderStatus();
  return NextResponse.json({
    success:  true,
    standard: status.standard,
    pro:      status.pro,
    any:      status.standard || status.pro,
  });
}
