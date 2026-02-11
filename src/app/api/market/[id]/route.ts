import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CG = "https://api.coingecko.com/api/v3";

export async function GET(_req: NextRequest, context: any) {
  try {
    const params = (await context?.params) ?? context?.params;
    const id: string = params?.id;

    // Simple price endpoint gives us price, 24h change, mcap, volume in one call
    const url = `${CG}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    const res = await fetch(url, {
      headers: { "User-Agent": "metadao-analytics/0.2" },
      cache: "no-store",
    } as RequestInit);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = await res.json();
    const d = json?.[id];
    if (!d) throw new Error("Token not found");

    return NextResponse.json({
      price: d.usd ?? 0,
      change24h: d.usd_24h_change ?? 0,
      marketCap: d.usd_market_cap ?? 0,
      volume24h: d.usd_24h_vol ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
