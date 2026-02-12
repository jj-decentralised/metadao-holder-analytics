import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import { generateCurrentPrice } from "@/lib/mock-data";

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

interface OHLCVPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function generateOHLCV(tokenId: string, days: number): OHLCVPoint[] {
  const rand = seededRandom(hashString(tokenId + "_ohlcv"));
  const basePrice = tokenId === "bonk" ? 0.00002 : rand() * 20 + 0.5;
  const volatility = tokenId.length < 4 ? 0.06 : 0.04;

  const points: OHLCVPoint[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = days; i >= 0; i--) {
    const ts = now - i * 86400000;
    const open = price;
    const change = (rand() - 0.48) * volatility;
    const close = Math.max(open * (1 + change), basePrice * 0.05);

    const high = Math.max(open, close) * (1 + rand() * 0.03);
    const low = Math.min(open, close) * (1 - rand() * 0.03);
    const volume = close * (rand() * 5000000 + 100000);

    points.push({
      timestamp: ts,
      open: Math.round(open * 100000000) / 100000000,
      high: Math.round(high * 100000000) / 100000000,
      low: Math.round(low * 100000000) / 100000000,
      close: Math.round(close * 100000000) / 100000000,
      volume: Math.round(volume * 100) / 100,
    });

    price = close;
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

  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "90", 10);
  const priceData = generateCurrentPrice(token.id);
  const ohlcv = generateOHLCV(token.id, days);

  const rand = seededRandom(hashString(token.id + "_trading"));
  const buyPressure = 0.4 + rand() * 0.2;
  const buyVolume24h = priceData.volume24h * buyPressure;
  const sellVolume24h = priceData.volume24h * (1 - buyPressure);
  const txnCount24h = Math.round(500 + rand() * 5000);
  const liquidity = priceData.marketCap * (0.02 + rand() * 0.08);

  const response = NextResponse.json({
    tokenId: id,
    volume24h: Math.round(priceData.volume24h * 100) / 100,
    buyVolume24h: Math.round(buyVolume24h * 100) / 100,
    sellVolume24h: Math.round(sellVolume24h * 100) / 100,
    txnCount24h,
    liquidity: Math.round(liquidity * 100) / 100,
    buyPressure: Math.round(buyPressure * 1000) / 1000,
    ohlcv,
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });

  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
