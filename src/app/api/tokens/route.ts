import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import { generateCurrentPrice, generateMetrics } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  let tokens = ALL_TOKENS;
  if (category) {
    tokens = tokens.filter((t) => t.category === category);
  }

  const data = tokens.map((token) => {
    const price = generateCurrentPrice(token.id);
    const metrics = generateMetrics(token.id);
    return { ...token, currentPrice: price, metrics };
  });

  return NextResponse.json({ data, source: "mock", fetchedAt: new Date().toISOString() });
}
