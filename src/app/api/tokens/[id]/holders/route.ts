import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import {
  getTokenMetrics,
  getTokenHolders,
  generateHolderTimeSeries,
} from "@/lib/data/token-data-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = ALL_TOKENS.find((t) => t.id === id);
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "180", 10);
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10);
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

  // Fetch metrics and holders in parallel
  const [metricsResult, holdersResult] = await Promise.all([
    getTokenMetrics(token.id),
    getTokenHolders(token.id, limit, cursor),
  ]);

  // Generate timeseries data (still mock for now - would need historical data API)
  const timeseries = generateHolderTimeSeries(token.id, days);

  const response = NextResponse.json({
    tokenId: id,
    holderCount: metricsResult.data.holderCount,
    holders: holdersResult.data.holders,
    holdersCursor: holdersResult.data.cursor,
    timeseries: timeseries.map((p) => ({
      timestamp: p.timestamp,
      totalHolders: p.totalHolders,
      gini: p.gini,
      top10Pct: p.top10Pct,
    })),
    buckets: metricsResult.data.holderBuckets,
    source: metricsResult.source === "mock" && holdersResult.source === "mock" ? "mock" : "mixed",
    metricsSource: metricsResult.source,
    holdersSource: holdersResult.source,
    cached: metricsResult.cached || holdersResult.cached,
    fetchedAt: new Date().toISOString(),
  });

  response.headers.set("Cache-Control", "public, max-age=300");
  return response;
}
