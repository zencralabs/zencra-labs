/**
 * GET /api/character/ai-influencers/slots
 *
 * Returns the user's current identity slot usage and plan limit.
 * Used by InfluencerCanvas (candidate phase header) and InfluencerLibrary.
 *
 * Response: { used: number; limit: number; remaining: number }
 */

import { requireAuthUser } from "@/lib/supabase/server";
import { ok }              from "@/lib/api/route-utils";
import { getUserSlotInfo } from "@/lib/influencer/identity-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const { user, authError } = await requireAuthUser(req);
  if (authError) return authError;

  const slotInfo = await getUserSlotInfo(user!.id);
  return ok(slotInfo);
}
