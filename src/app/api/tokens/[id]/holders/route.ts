import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import { generateHolderBuckets } from "@/lib/mock-data";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateHolderTimeseries(tokenId: string, days: number) {
  const rand = seededRandom(hashString(tokenId + "_holder_ts"));
  const token = ALL_TOKENS.find((t) => t.id === tokenId);
  const isMetadao = token?.category === "metadao";
  const isCommunity = token?.category === "community";

  const baseHolders = isMetadao ? 2500 : isCommunity ? 50000 : 8000;
  const baseGini = isMetadao ? 0.55 : isCommunity ? 0.62 : 0.82;

  const points: {
    timestamp: number;
    totalHolders: number;
    gini: number;
    top10Pct: number;
  }[] = [];

  let holders = baseHolders * (0.6 + rand() * 0.2);
  let gini = baseGini + (rand() - 0.5) * 0.1;
  const now = Date.now();

  for (let i = days; i >= 0; i--) {
    const ts = now - i * 86400000;
    const growth = 1 + (rand() - 0.45) * 0.02;
    holders = Math.round(holders * growth);
    gini = Math.max(0.3, Math.min(0.95, gini + (rand() - 0.52) * 0.01));

    const top10Pct = isMetadao
      ? 0.55 + rand() * 0.1
      : isCommunity
        ? 0.65 + rand() * 0.1
        : 0.82 + rand() * 0.08;

    points.push({
      timestamp: ts,
      totalHolders: holders,
      gini: Math.round(gini * 1000) / 1000,
      top10Pct: Math.round(top10Pct * 1000) / 1000,
    });
  }

  return points;
}

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
  const buckets = generateHolderBuckets(token.id);
  const timeseries = generateHolderTimeseries(token.id, days);

  const response = NextResponse.json({
    tokenId: id,
    holderCount:
      buckets.whale + buckets.shark + buckets.dolphin + buckets.fish,
    timeseries,
    buckets,
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });

  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
