/**
 * DELETE /api/characters/[id]/styles/[styleId]  — remove a style from a character
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import { StyleService } from '@/lib/styles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; styleId: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, styleId } = await params;
  try {
    await StyleService.removeStyleFromCharacter(id, user.id, styleId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/characters/[id]/styles/[styleId]]', err);
    return NextResponse.json({ error: 'Failed to remove style' }, { status: 500 });
  }
}
