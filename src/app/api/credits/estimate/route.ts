import { NextResponse } from "next/server";
import type { CreditEstimateInput } from "@/lib/ai/types";
import { calculateCredits } from "@/lib/credits/calculate";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CreditEstimateInput>;

    if (!body.mode || !["image", "video", "audio"].includes(body.mode)) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing mode" },
        { status: 400 }
      );
    }

    const estimate = calculateCredits({
      mode:            body.mode,
      quality:         body.quality,
      durationSeconds: body.durationSeconds,
      aspectRatio:     body.aspectRatio,
    });

    return NextResponse.json({
      success: true,
      data: estimate,
    });
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
