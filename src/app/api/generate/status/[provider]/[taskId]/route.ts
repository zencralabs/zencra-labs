
import { NextResponse } from "next/server";
import type { ProviderName, ProviderStatusResult } from "@/lib/ai/types";

type RouteParams = Promise<{
  provider: string;
  taskId: string;
}>;

export async function GET(
  _req: Request,
  context: { params: RouteParams }
) {
  try {
    const { provider, taskId } = await context.params;

    if (!provider || !taskId) {
      return NextResponse.json(
        { success: false, error: "Missing provider or taskId" },
        { status: 400 }
      );
    }

    const result: ProviderStatusResult = {
      provider: provider as ProviderName,
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
