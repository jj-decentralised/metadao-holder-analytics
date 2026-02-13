import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import {
  getTokenPrice,
  getTokenMetrics,
  type TokenPriceData,
  type TokenMetricsData,
} from "@/lib/data/token-data-service";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  let tokens = ALL_TOKENS;
  if (category) {
    tokens = tokens.filter((t) => t.category === category);
  }

  // Fetch prices and metrics in parallel for each token
  const data = await Promise.all(
    tokens.map(async (token) => {
      const [priceResult, metricsResult] = await Promise.all([
        getTokenPrice(token.id),
        getTokenMetrics(token.id),
      ]);

      return {
        ...token,
        currentPrice: priceResult.data,
        metrics: metricsResult.data,
        priceSource: priceResult.source,
        metricsSource: metricsResult.source,
      };
    })
  );

  // Determine overall source ("real" if any data is from APIs, "mock" otherwise)
  const sources = new Set(data.flatMap((d) => [d.priceSource, d.metricsSource]));
  const hasRealData = sources.has("coingecko") || sources.has("defillama") || sources.has("codex");

  return NextResponse.json({
    data,
    source: hasRealData ? "mixed" : "mock",
    fetchedAt: new Date().toISOString(),
  });
}
