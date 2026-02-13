import { ALL_TOKENS } from "@/data/tokens";
import {
  generateMetrics,
  generateTradingMetrics,
  generateCurrentPrice,
  generateHolderBuckets,
} from "@/lib/mock-data";
import type { TokenCategory } from "@/types";

// Category type for scatter plot coloring
export type ScatterCategory = "metadao" | "vc" | "community";

export interface ScatterPoint {
  x: number;
  y: number;
  tokenId: string;
  symbol: string;
  category: ScatterCategory;
}

export interface TrendLine {
  slope: number;
  intercept: number;
  rSquared: number;
}

export interface ScatterPlotData {
  points: ScatterPoint[];
  trendLine: TrendLine;
  xLabel: string;
  yLabel: string;
}

// Map token categories to scatter categories
function getScatterCategory(category: TokenCategory): ScatterCategory {
  if (
    category === "metadao" ||
    category === "metadao-ico" ||
    category === "futarchy-dao"
  ) {
    return "metadao";
  }
  if (category === "community") {
    return "community";
  }
  return "vc";
}

// Calculate days since launch
function getTokenAgeDays(launchDate?: string): number {
  if (!launchDate) return 365; // Default to 1 year if unknown
  const launch = new Date(launchDate);
  const now = new Date();
  const diffMs = now.getTime() - launch.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// Compute linear regression trend line
export function computeTrendLine(points: ScatterPoint[]): TrendLine {
  if (points.length < 2) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  const denominator = sumX2 - sumX * meanX;
  if (Math.abs(denominator) < 1e-10) {
    return { slope: 0, intercept: meanY, rSquared: 0 };
  }

  const slope = (sumXY - sumX * meanY) / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, rSquared: Math.max(0, rSquared) };
}

// Generate all scatter plot data
export function getScatterData(): {
  giniVsHolders: ScatterPlotData;
  marketCapVsNakamoto: ScatterPlotData;
  ageVsGini: ScatterPlotData;
  volumeLiquidityVsTurnover: ScatterPlotData;
  buyPressureVsPrice: ScatterPlotData;
  communityAllocationVsGini: ScatterPlotData;
} {
  const tokenData = ALL_TOKENS.map((token) => {
    const metrics = generateMetrics(token.id);
    const trading = generateTradingMetrics(token.id);
    const price = generateCurrentPrice(token.id);
    const buckets = generateHolderBuckets(token.id);
    const totalHolders =
      buckets.whale + buckets.shark + buckets.dolphin + buckets.fish;

    return {
      token,
      metrics,
      trading,
      price,
      totalHolders,
      ageDays: getTokenAgeDays(token.launchDate),
      category: getScatterCategory(token.category),
    };
  });

  // 1. Gini vs Holder Count (X: log scale holders, Y: Gini)
  const giniVsHoldersPoints: ScatterPoint[] = tokenData.map((d) => ({
    x: Math.log10(d.totalHolders),
    y: d.metrics.giniCoefficient,
    tokenId: d.token.id,
    symbol: d.token.symbol,
    category: d.category,
  }));

  // 2. Market Cap vs Nakamoto Coefficient
  const marketCapVsNakamotoPoints: ScatterPoint[] = tokenData.map((d) => ({
    x: d.price.marketCap / 1e6, // In millions
    y: d.metrics.nakamotoCoefficient,
    tokenId: d.token.id,
    symbol: d.token.symbol,
    category: d.category,
  }));

  // 3. Token Age (days) vs Gini
  const ageVsGiniPoints: ScatterPoint[] = tokenData.map((d) => ({
    x: d.ageDays,
    y: d.metrics.giniCoefficient,
    tokenId: d.token.id,
    symbol: d.token.symbol,
    category: d.category,
  }));

  // 4. Volume/Liquidity ratio vs Holder Turnover (approximated)
  const volumeLiquidityVsTurnoverPoints: ScatterPoint[] = tokenData.map(
    (d) => ({
      x:
        d.trading.liquidity > 0 ? d.trading.volume24h / d.trading.liquidity : 0,
      y: d.trading.txnCount24h / Math.max(1, d.totalHolders), // Turnover proxy
      tokenId: d.token.id,
      symbol: d.token.symbol,
      category: d.category,
    })
  );

  // 5. Buy Pressure vs 24h Price Change
  const buyPressureVsPricePoints: ScatterPoint[] = tokenData.map((d) => ({
    x: d.trading.buyPressure * 100, // Convert to percentage
    y: d.price.change24h,
    tokenId: d.token.id,
    symbol: d.token.symbol,
    category: d.category,
  }));

  // 6. Community Allocation % vs Gini
  const communityAllocationVsGiniPoints: ScatterPoint[] = tokenData
    .filter((d) => d.token.communityAllocationPct !== undefined)
    .map((d) => ({
      x: d.token.communityAllocationPct ?? 0,
      y: d.metrics.giniCoefficient,
      tokenId: d.token.id,
      symbol: d.token.symbol,
      category: d.category,
    }));

  return {
    giniVsHolders: {
      points: giniVsHoldersPoints,
      trendLine: computeTrendLine(giniVsHoldersPoints),
      xLabel: "Holder Count (log₁₀)",
      yLabel: "Gini Coefficient",
    },
    marketCapVsNakamoto: {
      points: marketCapVsNakamotoPoints,
      trendLine: computeTrendLine(marketCapVsNakamotoPoints),
      xLabel: "Market Cap ($M)",
      yLabel: "Nakamoto Coefficient",
    },
    ageVsGini: {
      points: ageVsGiniPoints,
      trendLine: computeTrendLine(ageVsGiniPoints),
      xLabel: "Token Age (days)",
      yLabel: "Gini Coefficient",
    },
    volumeLiquidityVsTurnover: {
      points: volumeLiquidityVsTurnoverPoints,
      trendLine: computeTrendLine(volumeLiquidityVsTurnoverPoints),
      xLabel: "Volume/Liquidity Ratio",
      yLabel: "Holder Turnover",
    },
    buyPressureVsPrice: {
      points: buyPressureVsPricePoints,
      trendLine: computeTrendLine(buyPressureVsPricePoints),
      xLabel: "Buy Pressure (%)",
      yLabel: "24h Price Change (%)",
    },
    communityAllocationVsGini: {
      points: communityAllocationVsGiniPoints,
      trendLine: computeTrendLine(communityAllocationVsGiniPoints),
      xLabel: "Community Allocation (%)",
      yLabel: "Gini Coefficient",
    },
  };
}

// Compute category averages for summary table
export interface CategoryStats {
  category: ScatterCategory;
  label: string;
  count: number;
  avgGini: number;
  avgNakamoto: number;
  avgHolders: number;
  avgBuyPressure: number;
  avgMarketCap: number;
  avgCommunityAllocation: number;
}

export function getCategoryStats(): CategoryStats[] {
  const stats: Record<ScatterCategory, CategoryStats> = {
    metadao: {
      category: "metadao",
      label: "MetaDAO / Futarchy",
      count: 0,
      avgGini: 0,
      avgNakamoto: 0,
      avgHolders: 0,
      avgBuyPressure: 0,
      avgMarketCap: 0,
      avgCommunityAllocation: 0,
    },
    vc: {
      category: "vc",
      label: "VC-Backed",
      count: 0,
      avgGini: 0,
      avgNakamoto: 0,
      avgHolders: 0,
      avgBuyPressure: 0,
      avgMarketCap: 0,
      avgCommunityAllocation: 0,
    },
    community: {
      category: "community",
      label: "Community",
      count: 0,
      avgGini: 0,
      avgNakamoto: 0,
      avgHolders: 0,
      avgBuyPressure: 0,
      avgMarketCap: 0,
      avgCommunityAllocation: 0,
    },
  };

  ALL_TOKENS.forEach((token) => {
    const cat = getScatterCategory(token.category);
    const metrics = generateMetrics(token.id);
    const trading = generateTradingMetrics(token.id);
    const price = generateCurrentPrice(token.id);
    const buckets = generateHolderBuckets(token.id);
    const totalHolders =
      buckets.whale + buckets.shark + buckets.dolphin + buckets.fish;

    stats[cat].count++;
    stats[cat].avgGini += metrics.giniCoefficient;
    stats[cat].avgNakamoto += metrics.nakamotoCoefficient;
    stats[cat].avgHolders += totalHolders;
    stats[cat].avgBuyPressure += trading.buyPressure * 100;
    stats[cat].avgMarketCap += price.marketCap / 1e6;
    stats[cat].avgCommunityAllocation += token.communityAllocationPct ?? 0;
  });

  // Compute averages
  Object.values(stats).forEach((s) => {
    if (s.count > 0) {
      s.avgGini /= s.count;
      s.avgNakamoto /= s.count;
      s.avgHolders /= s.count;
      s.avgBuyPressure /= s.count;
      s.avgMarketCap /= s.count;
      s.avgCommunityAllocation /= s.count;
    }
  });

  return [stats.metadao, stats.vc, stats.community];
}
