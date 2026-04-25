/**
 * GET  /api/characters/[id]/styles  — list styles applied to a character
 * POST /api/characters/[id]/styles  — apply a style to a character
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import { StyleService } from '@/lib/styles';

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
    const styles = await StyleService.listCharacterStyles(id, user.id);
    return NextResponse.json({ styles });
  } catch (err) {
    console.error('[GET /api/characters/[id]/styles]', err);
    return NextResponse.json({ error: 'Failed to fetch character styles' }, { status: 404 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json() as {
      style_id?: string;
      weight?: number;
      is_primary?: boolean;
    };
    if (!body.style_id) return NextResponse.json({ error: 'style_id is required' }, { status: 400 });
    const characterStyle = await StyleService.applyStyleToCharacter(id, user.id, body.style_id, {
      weight: body.weight,
      is_primary: body.is_primary,
    });
    return NextResponse.json({ characterStyle }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/characters/[id]/styles]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to apply style' }, { status: 500 });
  }
}
