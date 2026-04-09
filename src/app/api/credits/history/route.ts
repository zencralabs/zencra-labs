import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: [
      {
        id: "txn_1",
        type: "debit",
        amount: 5,
        description: "Image generation",
        createdAt: new Date().toISOString(),
      },
      {
        id: "txn_2",
        type: "credit",
        amount: 20,
        description: "Subscription refill",
        createdAt: new Date().toISOString(),
      },
    ],
  });
}
