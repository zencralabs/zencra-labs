/**
 * GET /api/characters/[id]/jobs  — list generation jobs linked to a character
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('generation_jobs')
    .select('*')
    .eq('character_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[GET /api/characters/[id]/jobs]', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
  return NextResponse.json({ jobs: data ?? [] });
}
