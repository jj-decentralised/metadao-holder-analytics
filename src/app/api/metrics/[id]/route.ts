import { NextRequest, NextResponse } from "next/server";
import { fetchMarketChart } from "@/lib/coingecko";
import { toSeries, simpleReturns, rollingStd, sharpe } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: any
) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? 180);
  const windows = (searchParams.get("windows") ?? "30,90").split(",").map(Number);

  try {
    const params = (await context?.params) ?? context?.params;
    const id: string = params?.id;
    const chart = await fetchMarketChart(id, isNaN(days) ? ("90" as any) : days);
    const series = toSeries(chart.prices);
    const rets = simpleReturns(series);

    const vol: Record<string, { t: number; v: number }[]> = {};
    const shrp: Record<string, { t: number; v: number }[]> = {};
    for (const w of windows) {
      vol[w] = rollingStd(rets, w);
      shrp[w] = sharpe(rets, w);
    }

    return NextResponse.json({ vol, sharpe: shrp });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to compute metrics" },
      { status: 500 }
    );
  }
}
