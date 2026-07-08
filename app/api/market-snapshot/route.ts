import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/market-snapshot";

export async function GET() {
  try {
    const snapshot = await getMarketSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        fetchedAt: new Date().toISOString(),
        source: "yahoo-finance-chart",
        quotes: [],
        error: error instanceof Error ? error.message : "Market snapshot unavailable",
      },
      { status: 200 }
    );
  }
}
