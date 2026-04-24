/**
 * POST /api/creative-director/projects/[projectId]/brief/improve
 *
 * AI-powered full-brief enhancement.
 * Accepts the current BriefState, rewrites the three key copy fields
 * (goal, headline, cta) in one OpenAI call, and returns only the
 * improved fields so the shell can merge them into local state.
 *
 * Body: full BriefState (sent by serializeBriefForApi in the shell)
 * Returns: { brief: { goal?, headline?, cta? } }
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkBriefImproveRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.CREATIVE_DIRECTOR_TEXT_MODEL ?? "gpt-4o";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: Request, { params }: RouteContext): Promise<Response> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit (calls OpenAI — 10/hour/user) ────────────────────────────────
  const rateLimitError = await checkBriefImproveRateLimit(user.id);
  if (rateLimitError) return rateLimitError;

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

  // Parse the brief body — we accept the full BriefState shape the shell sends
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Extract fields we need to build context and improve
  const brandName       = String(body.brandName       ?? body.brand_name    ?? "").trim();
  const projectType     = String(body.projectType     ?? body.project_type  ?? "").trim();
  const platform        = String(body.platform        ?? "").trim();
  const audience        = String(body.audience        ?? "").trim();
  const goal            = String(body.goal            ?? "").trim();
  const headline        = String(body.headline        ?? "").trim();
  const cta             = String(body.cta             ?? "").trim();
  const stylePreset     = String(body.stylePreset     ?? body.style_preset  ?? "").trim();
  const additionalNotes = String(body.additionalNotes ?? body.additional_notes ?? "").trim();

  // Build a rich context string for the model
  const context = [
    brandName     && `Brand: ${brandName}`,
    projectType   && `Project type: ${projectType}`,
    platform      && `Platform: ${platform}`,
    audience      && `Audience: ${audience}`,
    stylePreset   && `Visual style: ${stylePreset}`,
    additionalNotes && `Additional notes: ${additionalNotes}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Determine which fields actually have content to improve
  const hasGoal     = goal.length > 0;
  const hasHeadline = headline.length > 0;
  const hasCta      = cta.length > 0;

  if (!hasGoal && !hasHeadline && !hasCta) {
    // Nothing to improve — return empty brief patch so the shell shows "Brief improved"
    return NextResponse.json({ brief: {} });
  }

  const systemPrompt = `You are a senior creative strategist and copywriter helping improve a creative campaign brief.
You will receive the current values of specific brief fields and must return improved versions.
Rules:
- Improve only the fields provided — do not invent content for empty fields
- Keep headline under 12 words; make it benefit-driven or curiosity-driven
- Keep CTA under 6 words; use action verbs and create urgency
- Make the goal specific and outcome-oriented (1-2 sentences)
- Match the brand context provided
- Return ONLY a valid JSON object with improved values for the fields provided
- Do not include any explanation or markdown fences`;

  const userLines: string[] = [];
  if (context)     userLines.push(`=== Campaign Context ===\n${context}`);
  if (hasGoal)     userLines.push(`=== Current Goal ===\n${goal}`);
  if (hasHeadline) userLines.push(`=== Current Headline ===\n${headline}`);
  if (hasCta)      userLines.push(`=== Current CTA ===\n${cta}`);
  userLines.push(`\nReturn a JSON object with keys: ${[hasGoal && "goal", hasHeadline && "headline", hasCta && "cta"].filter(Boolean).join(", ")}`);

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userLines.join("\n\n") },
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ error: "No improvement generated" }, { status: 502 });
    }

    let improved: Record<string, string>;
    try {
      improved = JSON.parse(raw) as Record<string, string>;
    } catch {
      return NextResponse.json({ error: "Invalid response from AI model" }, { status: 502 });
    }

    // Build the partial BriefState patch — only include improved fields
    const briefPatch: Record<string, string> = {};
    if (hasGoal     && typeof improved.goal     === "string") briefPatch.goal     = improved.goal.trim();
    if (hasHeadline && typeof improved.headline === "string") briefPatch.headline = improved.headline.trim();
    if (hasCta      && typeof improved.cta      === "string") briefPatch.cta      = improved.cta.trim();

    return NextResponse.json({ brief: briefPatch });
  } catch (err) {
    console.error(`[brief/improve] OpenAI call failed:`, err);
    return NextResponse.json({ error: "Improvement generation failed" }, { status: 502 });
  }
}
