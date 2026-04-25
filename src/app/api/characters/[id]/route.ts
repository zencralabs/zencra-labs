/**
 * GET    /api/characters/[id]   — get a single character
 * PATCH  /api/characters/[id]   — update character fields
 * DELETE /api/characters/[id]   — soft-delete character (status = 'deleted')
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import { CharacterService } from '@/lib/character';

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
    const character = await CharacterService.getCharacter(id, user.id);
    return NextResponse.json({ character });
  } catch {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json() as Record<string, unknown>;
    const character = await CharacterService.updateCharacter(id, user.id, body);
    return NextResponse.json({ character });
  } catch (err) {
    console.error('[PATCH /api/characters/[id]]', err);
    return NextResponse.json({ error: 'Failed to update character' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await CharacterService.deleteCharacter(id, user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/characters/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete character' }, { status: 500 });
  }
}
