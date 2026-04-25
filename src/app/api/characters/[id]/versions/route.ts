/**
 * GET /api/characters/[id]/versions  — list all versions for a character
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import { VersionService } from '@/lib/character';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const versions = await VersionService.getVersionsForCharacter(id);
    return NextResponse.json({ versions });
  } catch (err) {
    console.error('[GET /api/characters/[id]/versions]', err);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}
