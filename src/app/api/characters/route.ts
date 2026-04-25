/**
 * GET  /api/characters   — list authenticated user's characters
 * POST /api/characters   — create a new character
 *
 * CRUD only — no generation happens here.
 * Generation goes through /api/studio/image/generate or /api/studio/video/generate
 * with character_id + soul_id in the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import { CharacterService } from '@/lib/character';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id') ?? undefined;

  try {
    const characters = await CharacterService.listCharacters(user.id, projectId);
    return NextResponse.json({ characters });
  } catch (err) {
    console.error('[GET /api/characters]', err);
    return NextResponse.json({ error: 'Failed to list characters' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as {
      name?: string;
      description?: string;
      platform_intent?: string;
      project_id?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const character = await CharacterService.createCharacter(user.id, {
      name: body.name,
      description: body.description,
      platform_intent: body.platform_intent,
      project_id: body.project_id,
    });
    return NextResponse.json({ character }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/characters]', err);
    return NextResponse.json({ error: 'Failed to create character' }, { status: 500 });
  }
}
