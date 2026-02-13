import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import { getTokenPrice, getTokenMetrics } from "@/lib/data/token-data-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = ALL_TOKENS.find((t) => t.id === id);
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  const [priceResult, metricsResult] = await Promise.all([
    getTokenPrice(token.id),
    getTokenMetrics(token.id),
  ]);

  return NextResponse.json({
    data: {
      ...token,
      currentPrice: priceResult.data,
      metrics: metricsResult.data,
      holderBuckets: metricsResult.data.holderBuckets,
    },
    source: priceResult.source === "mock" && metricsResult.source === "mock" ? "mock" : "mixed",
    priceSource: priceResult.source,
    metricsSource: metricsResult.source,
    cached: priceResult.cached || metricsResult.cached,
    fetchedAt: new Date().toISOString(),
  });
}
