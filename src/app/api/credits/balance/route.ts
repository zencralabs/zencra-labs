import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      available: 100,
      subscription: 60,
      addon: 30,
      bonus: 10,
    },
  });
}
