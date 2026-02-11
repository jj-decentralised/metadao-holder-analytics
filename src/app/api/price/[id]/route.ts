import { NextRequest, NextResponse } from "next/server";
import { fetchMarketChart } from "@/lib/coingecko";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: any
) {
  const { searchParams } = new URL(_req.url);
  const days = searchParams.get("days") ?? "90";
  const vs = searchParams.get("vs") ?? "usd";
  try {
    const params = (await context?.params) ?? context?.params;
    const id: string = params?.id;
    const data = await fetchMarketChart(id, (days as any), vs);
    return NextResponse.json({ prices: data.prices });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch price chart" },
      { status: 500 }
    );
  }
}
