import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import { getPriceHistory } from "@/lib/data/token-data-service";
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

  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "90", 10);
  try {
    const result = await getPriceHistory(token.id, days);
    return NextResponse.json({
      data: { tokenId: id, points: result.data },
      source: result.source,
      cached: result.cached,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    if ((err as Error).message === "MOCKS_DISABLED") {
      return NextResponse.json({ error: "Price history unavailable (mock data disabled)." }, { status: 503 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
