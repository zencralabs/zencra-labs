/**
 * POST /api/creative-director/projects/[projectId]/brief/improve
 *
 * AI-powered brief field improvement.
 * Rewrites a specific brief field (headline, cta, goal) using
 * CREATIVE_DIRECTOR_TEXT_MODEL with context from the project brief.
 *
 * Body: { field: "headline" | "cta" | "goal", currentValue: string, context: string }
 * Returns: { improved: string }
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateBriefImprove } from "@/lib/creative-director/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREATIVE_DIRECTOR_TEXT_MODEL =
  process.env.CREATIVE_DIRECTOR_TEXT_MODEL ?? "gpt-4o";

const FIELD_PROMPTS: Record<"headline" | "cta" | "goal", string> = {
  headline: `You are a professional copywriter. Rewrite the provided headline to be more compelling, clear, and impactful.
Rules:
- Keep it concise (under 10 words ideally)
- Make it benefit-driven or curiosity-driven
- Match the brand context provided
- Return ONLY the improved headline text, nothing else`,

  cta: `You are a conversion copywriter. Rewrite the provided CTA (call-to-action) to drive more clicks.
Rules:
- Keep it short (2-5 words ideally)
- Use action verbs
- Create urgency or value clarity
- Match the brand context provided
- Return ONLY the improved CTA text, nothing else`,

  goal: `You are a creative strategist. Rewrite the provided campaign goal to be clearer and more specific.
Rules:
- Be specific about the intended outcome
- Use measurable language where possible
- Keep it to 1-2 sentences
- Return ONLY the improved goal text, nothing else`,
};

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  // Verify project ownership
  const { data: project, error: projErr } = await supabaseAdmin
    .from("creative_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBriefImprove(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { field, currentValue, context } = validation.data;

  const systemPrompt = FIELD_PROMPTS[field];
  const userMessage = `Context: ${context}\n\nCurrent ${field}: ${currentValue}\n\nImprove this ${field}:`;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: CREATIVE_DIRECTOR_TEXT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const improved = response.choices[0]?.message?.content?.trim();
    if (!improved) {
      return NextResponse.json(
        { error: "No improvement generated" },
        { status: 502 }
      );
    }

    return NextResponse.json({ improved });
  } catch (err) {
    console.error(`[brief/improve] OpenAI call failed:`, err);
    return NextResponse.json({ error: "Improvement generation failed" }, { status: 502 });
  }
}
