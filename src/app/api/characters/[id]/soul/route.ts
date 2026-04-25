/**
 * GET  /api/characters/[id]/soul   — list soul records for a character
 * POST /api/characters/[id]/soul   — create a new soul record
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import { SoulService } from '@/lib/character';

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
    const souls = await SoulService.getSoulsForCharacter(id);
    return NextResponse.json({ souls });
  } catch (err) {
    console.error('[GET /api/characters/[id]/soul]', err);
    return NextResponse.json({ error: 'Failed to fetch soul records' }, { status: 500 });
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
      identity_prompt?: string;
      style_dna?: Record<string, unknown>;
      reference_asset_ids?: string[];
    };
    const soul = await SoulService.createSoul(id, {
      identity_prompt: body.identity_prompt,
      style_dna: body.style_dna,
      reference_asset_ids: body.reference_asset_ids,
    });
    return NextResponse.json({ soul }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/characters/[id]/soul]', err);
    return NextResponse.json({ error: 'Failed to create soul record' }, { status: 500 });
  }
}
