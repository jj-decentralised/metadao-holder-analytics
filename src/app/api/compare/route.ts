import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import {
  generateMetrics,
  generateCurrentPrice,
  generateHolderBuckets,
  generateHolderBalances,
} from "@/lib/mock-data";
import { compareDistributions } from "@/lib/metrics/comparison";

export async function GET(request: NextRequest) {
  const token1Id = request.nextUrl.searchParams.get("token1");
  const token2Id = request.nextUrl.searchParams.get("token2");

  if (!token1Id || !token2Id) {
    return NextResponse.json(
      { error: "Both token1 and token2 query params are required" },
      { status: 400 }
    );
  }

  const token1 = ALL_TOKENS.find((t) => t.id === token1Id);
  const token2 = ALL_TOKENS.find((t) => t.id === token2Id);

  if (!token1) {
    return NextResponse.json(
      { error: `Token not found: ${token1Id}` },
      { status: 404 }
    );
  }

  if (!token2) {
    return NextResponse.json(
      { error: `Token not found: ${token2Id}` },
      { status: 404 }
    );
  }

  const metrics1 = generateMetrics(token1.id);
  const metrics2 = generateMetrics(token2.id);
  const price1 = generateCurrentPrice(token1.id);
  const price2 = generateCurrentPrice(token2.id);
  const buckets1 = generateHolderBuckets(token1.id);
  const buckets2 = generateHolderBuckets(token2.id);

  const balances1 = generateHolderBalances(token1.id);
  const balances2 = generateHolderBalances(token2.id);
  const distributionComparison = compareDistributions(balances1, balances2);

  const response = NextResponse.json({
    token1: {
      ...token1,
      metrics: metrics1,
      price: price1,
      buckets: buckets1,
    },
    token2: {
      ...token2,
      metrics: metrics2,
      price: price2,
      buckets: buckets2,
    },
    comparison: {
      giniDelta: Math.round(distributionComparison.gini.delta * 1000) / 1000,
      nakamotoDelta: distributionComparison.nakamoto.delta,
      hhiDelta: distributionComparison.hhi.delta,
      entropyDelta:
        Math.round(distributionComparison.entropy.delta * 1000) / 1000,
      palmaDelta: Math.round(distributionComparison.palma.delta * 1000) / 1000,
      distribution: distributionComparison,
    },
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });

  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
