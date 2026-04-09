import { NextResponse } from "next/server";
import { generateContent } from "@/lib/ai/orchestrator";
import type { GenerateContentInput } from "@/lib/ai/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<GenerateContentInput>;

    if (!body.mode || !["image", "video", "audio"].includes(body.mode)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing mode" },
        { status: 400 }
      );
    }

    if (!body.prompt || body.prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const result = await generateContent({
      mode: body.mode,
      prompt: body.prompt,
      provider: body.provider,
      quality: body.quality ?? "cinematic",
      aspectRatio: body.aspectRatio,
      durationSeconds: body.durationSeconds,
      imageUrl: body.imageUrl,
      voiceId: body.voiceId,
      metadata: body.metadata,
    });

    const statusCode = result.status === "error" ? 400 : 200;

    return NextResponse.json(
      {
        success: result.status !== "error",
        data: result,
      },
      { status: statusCode }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
