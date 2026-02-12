import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import { generateCurrentPrice, generateMetrics, generateHolderBuckets } from "@/lib/mock-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = ALL_TOKENS.find((t) => t.id === id);
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  const price = generateCurrentPrice(token.id);
  const metrics = generateMetrics(token.id);
  const buckets = generateHolderBuckets(token.id);

  return NextResponse.json({
    data: { ...token, currentPrice: price, metrics, holderBuckets: buckets },
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });
}
