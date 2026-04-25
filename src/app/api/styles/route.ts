/**
 * GET  /api/styles  — list system + user styles (filterable by category)
 * POST /api/styles  — create a custom user style
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/server';
import { StyleService } from '@/lib/styles';
import type { StyleCategory } from '@/lib/styles/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: StyleCategory[] = [
  'cinematic', 'editorial', 'street', 'fashion', 'anime',
  'realistic', 'fantasy', 'commercial', 'ugc', 'custom',
];

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawCategory = searchParams.get('category');
  const category = rawCategory && VALID_CATEGORIES.includes(rawCategory as StyleCategory)
    ? (rawCategory as StyleCategory)
    : undefined;

  try {
    const styles = await StyleService.listStyles(user.id, { category });
    return NextResponse.json({ styles });
  } catch (err) {
    console.error('[GET /api/styles]', err);
    return NextResponse.json({ error: 'Failed to fetch styles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as {
      name?: string;
      category?: string;
      description?: string;
      prompt_template?: string;
      negative_prompt?: string;
    };

    if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!body.prompt_template?.trim()) return NextResponse.json({ error: 'prompt_template is required' }, { status: 400 });
    if (!body.category || !VALID_CATEGORIES.includes(body.category as StyleCategory)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    const style = await StyleService.createUserStyle(user.id, {
      name: body.name,
      category: body.category as StyleCategory,
      description: body.description,
      prompt_template: body.prompt_template,
      negative_prompt: body.negative_prompt,
    });
    return NextResponse.json({ style }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/styles]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create style' }, { status: 500 });
  }
}
