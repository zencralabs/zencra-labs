
import { NextResponse } from "next/server";
import type { ProviderStatusResult } from "@/lib/ai/types";

export async function GET(
  _req: Request,
  { params }: { params: { provider: string; taskId: string } }
) {
  try {
    const { provider, taskId } = params;

    if (!provider || !taskId) {
      return NextResponse.json(
        { success: false, error: "Missing provider or taskId" },
        { status: 400 }
      );
    }

    const result: ProviderStatusResult = {
      provider: provider as any,
      taskId,
      status: "success",
      url: "https://example.com/mock-video",
      metadata: {
        note: "Mock status response",
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
