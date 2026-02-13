import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import {
  getTokenMetrics,
  getTokenHolders,
  generateHolderTimeSeries,
} from "@/lib/data/token-data-service";
import { ALLOW_MOCKS } from "@/lib/config";

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
  try {
    const [metricsResult, holdersResult] = await Promise.all([
      getTokenMetrics(token.id),
      getTokenHolders(token.id, limit, cursor),
    ]);

    // Block if any source is mock and mocks are disabled
    if (!ALLOW_MOCKS && (metricsResult.source === "mock" || holdersResult.source === "mock")) {
      return NextResponse.json({ error: "Holder data unavailable (mock data disabled)." }, { status: 503 });
    }

    // Generate timeseries data (use empty if mocks disabled)
    const timeseries = ALLOW_MOCKS ? generateHolderTimeSeries(token.id, days) : [];

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
  } catch (err) {
    if ((err as Error).message === "MOCKS_DISABLED") {
      return NextResponse.json({ error: "Holder data unavailable (mock data disabled)." }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
