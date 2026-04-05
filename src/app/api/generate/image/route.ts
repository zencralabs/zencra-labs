/**
 * POST /api/generate/image
 *
 * Generates an image using OpenAI DALL-E 3.
 * - Validates user session via Supabase
 * - Checks + deducts credits BEFORE calling the API
 * - Logs generation to the database
 * - Refunds credits if generation fails
 *
 * Credit cost: 2 credits per image (DALL-E 3 standard)
 * API cost:    ~$0.04 per image (1024x1024)
 * Margin:      2 credits × $0.015/credit = $0.03 margin per image
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { deductCredits, refundCredits } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Credit costs per tool (edit this to adjust margins)
export const CREDIT_COSTS: Record<string, number> = {
  "dalle3-standard": 2,
  "dalle3-hd":       4,
};

// Actual API costs in USD (for margin tracking)
const API_COSTS: Record<string, number> = {
  "dalle3-standard": 0.04,
  "dalle3-hd":       0.08,
};

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth: verify user session ─────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // ── 2. Parse request body ─────────────────────────────────
    const body = await req.json();
    const {
      prompt,
      quality = "standard",  // "standard" | "hd"
      size = "1024x1024",    // "1024x1024" | "1792x1024" | "1024x1792"
      style = "vivid",       // "vivid" | "natural"
      n = 1,
    } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return NextResponse.json({ error: "prompt too long (max 4000 chars)" }, { status: 400 });
    }

    const toolKey = `dalle3-${quality}`;
    const creditCost = (CREDIT_COSTS[toolKey] ?? 2) * Math.min(n, 4);
    const apiCost = (API_COSTS[toolKey] ?? 0.04) * Math.min(n, 4);

    // ── 3. Deduct credits upfront ─────────────────────────────
    const deduction = await deductCredits(
      user.id,
      creditCost,
      `DALL-E 3 image generation (${quality})`,
      { tool: "dalle3", quality, size, prompt_preview: prompt.slice(0, 100) }
    );

    if (!deduction.success) {
      return NextResponse.json(
        { error: deduction.error ?? "Insufficient credits" },
        { status: 402 }
      );
    }

    // ── 4. Log generation record (pending) ───────────────────
    const admin = createAdminClient();
    const { data: genRecord } = await admin
      .from("generations")
      .insert({
        user_id: user.id,
        tool: "dalle3",
        tool_category: "image",
        prompt,
        parameters: { quality, size, style, n },
        status: "processing",
        credits_used: creditCost,
        api_cost_usd: apiCost,
      })
      .select()
      .single();

    // ── 5. Call OpenAI DALL-E 3 ───────────────────────────────
    let imageUrls: string[] = [];
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        quality: quality as "standard" | "hd",
        size: size as "1024x1024" | "1792x1024" | "1024x1792",
        style: style as "vivid" | "natural",
        n: Math.min(n, 4),  // DALL-E 3 max 4 per request
        response_format: "url",
      });

      imageUrls = (response.data ?? [])
        .map((img) => img.url)
        .filter((url): url is string => Boolean(url));

    } catch (openaiError: unknown) {
      // Log the actual OpenAI error for debugging
      console.error("[DALL-E 3 Error]", openaiError instanceof Error ? openaiError.message : openaiError);

      // Generation failed — refund credits and update record
      await refundCredits(
        user.id,
        creditCost,
        "Refund: DALL-E 3 generation failed",
        { generation_id: genRecord?.id }
      );

      if (genRecord?.id) {
        await admin
          .from("generations")
          .update({
            status: "failed",
            error_message: openaiError instanceof Error
              ? openaiError.message
              : "Generation failed",
          })
          .eq("id", genRecord.id);
      }

      const errMsg = openaiError instanceof Error ? openaiError.message : "Unknown error";
      return NextResponse.json(
        { error: `Image generation failed. Credits have been refunded. (${errMsg})` },
        { status: 500 }
      );
    }

    // ── 6. Mark generation as complete ───────────────────────
    if (genRecord?.id) {
      await admin
        .from("generations")
        .update({
          status: "completed",
          result_url: imageUrls[0],
          result_urls: imageUrls,
          completed_at: new Date().toISOString(),
        })
        .eq("id", genRecord.id);
    }

    // ── 7. Return result ──────────────────────────────────────
    return NextResponse.json({
      success: true,
      images: imageUrls,
      credits_used: creditCost,
      credits_remaining: deduction.newBalance,
      generation_id: genRecord?.id,
    });

  } catch (err) {
    console.error("[/api/generate/image] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
