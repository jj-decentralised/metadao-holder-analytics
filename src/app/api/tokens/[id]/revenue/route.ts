import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS, defillamaAddress } from "@/data/tokens";
import type { RevenueMetrics, RevenueDataPoint } from "@/types";

// Seeded random for reproducible mock data
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

function generateMockRevenueData(tokenId: string, days: number): RevenueMetrics {
  const rand = seededRandom(hashString(tokenId + "_revenue"));
  const token = ALL_TOKENS.find((t) => t.id === tokenId);
  const category = token?.category ?? "vc-backed";

  // Base revenue varies by category
  const baseRevenue =
    category === "metadao" || category === "metadao-ico" || category === "futarchy-dao"
      ? 5000 + rand() * 15000
      : category === "community"
        ? 1000 + rand() * 5000
        : 20000 + rand() * 80000;

  const feeRatio = 0.1 + rand() * 0.15; // 10-25% of revenue is fees
  const growthTrend = category === "metadao" ? 0.002 : category === "community" ? 0.001 : -0.001;

  const timeSeries: RevenueDataPoint[] = [];
  const now = Date.now();
  let currentRevenue = baseRevenue;

  for (let i = days; i >= 0; i--) {
    const dailyNoise = (rand() - 0.5) * 0.3;
    currentRevenue *= 1 + growthTrend + dailyNoise;
    currentRevenue = Math.max(currentRevenue, baseRevenue * 0.1);

    const fees = currentRevenue * feeRatio * (0.8 + rand() * 0.4);
    const protocolRevenue = currentRevenue * 0.7 * (0.8 + rand() * 0.4);

    timeSeries.push({
      timestamp: now - i * 86400000,
      revenue: Math.round(currentRevenue * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      protocolRevenue: Math.round(protocolRevenue * 100) / 100,
    });
  }

  // Calculate aggregates
  const dailyRevenue = timeSeries[timeSeries.length - 1]?.revenue ?? 0;
  const weeklyRevenue = timeSeries.slice(-7).reduce((sum, d) => sum + d.revenue, 0);
  const monthlyRevenue = timeSeries.slice(-30).reduce((sum, d) => sum + d.revenue, 0);
  const totalRevenue = timeSeries.reduce((sum, d) => sum + d.revenue, 0);
  const dailyFees = timeSeries[timeSeries.length - 1]?.fees ?? 0;

  // Calculate 30d growth
  const recent30 = timeSeries.slice(-30);
  const prev30 = timeSeries.slice(-60, -30);
  const recentSum = recent30.reduce((sum, d) => sum + d.revenue, 0);
  const prevSum = prev30.length > 0 ? prev30.reduce((sum, d) => sum + d.revenue, 0) : recentSum;
  const revenueGrowth30d = prevSum > 0 ? ((recentSum - prevSum) / prevSum) * 100 : 0;

  return {
    tokenId,
    dailyRevenue,
    weeklyRevenue,
    monthlyRevenue,
    totalRevenue,
    dailyFees,
    revenueGrowth30d: Math.round(revenueGrowth30d * 100) / 100,
    timeSeries,
  };
}

interface DefiLlamaRevenueResponse {
  totalDataChart?: Array<[number, number]>;
}

async function fetchDefiLlamaRevenue(
  mintAddress: string,
  _days: number
): Promise<RevenueDataPoint[] | null> {
  try {
    const url = `https://api.llama.fi/summary/fees/solana:${mintAddress}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const data: DefiLlamaRevenueResponse = await response.json();
    if (!data.totalDataChart?.length) return null;

    return data.totalDataChart.map(([timestamp, revenue]) => ({
      timestamp: timestamp * 1000,
      revenue,
      fees: revenue * 0.15, // Estimate fees as 15% of revenue
    }));
  } catch {
    return null;
  }
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

  // Try DeFiLlama first
  const llamaData = await fetchDefiLlamaRevenue(token.mintAddress, days);

  if (llamaData && llamaData.length > 0) {
    // Build RevenueMetrics from DeFiLlama data
    const timeSeries = llamaData.slice(-days);
    const dailyRevenue = timeSeries[timeSeries.length - 1]?.revenue ?? 0;
    const weeklyRevenue = timeSeries.slice(-7).reduce((sum, d) => sum + d.revenue, 0);
    const monthlyRevenue = timeSeries.slice(-30).reduce((sum, d) => sum + d.revenue, 0);
    const totalRevenue = timeSeries.reduce((sum, d) => sum + d.revenue, 0);
    const dailyFees = timeSeries[timeSeries.length - 1]?.fees ?? 0;

    const recent30 = timeSeries.slice(-30);
    const prev30 = timeSeries.slice(-60, -30);
    const recentSum = recent30.reduce((sum, d) => sum + d.revenue, 0);
    const prevSum = prev30.length > 0 ? prev30.reduce((sum, d) => sum + d.revenue, 0) : recentSum;
    const revenueGrowth30d = prevSum > 0 ? ((recentSum - prevSum) / prevSum) * 100 : 0;

    const metrics: RevenueMetrics = {
      tokenId: id,
      dailyRevenue,
      weeklyRevenue,
      monthlyRevenue,
      totalRevenue,
      dailyFees,
      revenueGrowth30d: Math.round(revenueGrowth30d * 100) / 100,
      timeSeries,
    };

    return NextResponse.json({
      data: metrics,
      source: "defillama",
      fetchedAt: new Date().toISOString(),
    });
  }

  // Fallback to mock data
  const mockData = generateMockRevenueData(id, days);

  return NextResponse.json({
    data: mockData,
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });
}
