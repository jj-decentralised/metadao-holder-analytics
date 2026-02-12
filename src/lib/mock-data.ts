import { ALL_TOKENS } from "@/data/tokens";
import type {
  PricePoint,
  DistributionMetrics,
  HolderBuckets,
  TokenMetadata,
} from "@/types";

// Seeded pseudo-random for reproducibility
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

// ── Price History ────────────────────────────────────────────────────────────

export function generatePriceHistory(
  tokenId: string,
  days = 365
): PricePoint[] {
  const rand = seededRandom(hashString(tokenId));
  const basePrice = tokenId === "bonk" ? 0.00002 : rand() * 20 + 0.5;
  const volatility = tokenId.length < 4 ? 0.06 : 0.04;

  const points: PricePoint[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = days; i >= 0; i--) {
    const change = (rand() - 0.48) * volatility;
    price = Math.max(price * (1 + change), basePrice * 0.05);

    const ts = now - i * 86400000;
    points.push({
      timestamp: ts,
      price,
      volume: price * (rand() * 5000000 + 100000),
      marketCap: price * (rand() * 500000000 + 10000000),
    });
  }

  return points;
}

// ── Holder Distribution ──────────────────────────────────────────────────────

export function generateHolderBalances(
  tokenId: string,
  count = 500
): number[] {
  const rand = seededRandom(hashString(tokenId + "_holders"));
  const token = ALL_TOKENS.find((t) => t.id === tokenId);
  const isMetadao = token?.category === "metadao";
  const isCommunity = token?.category === "community";

  // MetaDAO tokens: more equal distribution; VC tokens: top-heavy
  const alpha = isMetadao ? 1.8 : isCommunity ? 1.5 : 2.5;

  const balances: number[] = [];
  for (let i = 0; i < count; i++) {
    // Pareto-like distribution
    const u = rand();
    const val = Math.pow(1 - u, -1 / alpha) - 1;
    balances.push(val * 10000);
  }

  return balances.sort((a, b) => b - a);
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export function generateMetrics(tokenId: string): DistributionMetrics {
  const rand = seededRandom(hashString(tokenId + "_metrics"));
  const token = ALL_TOKENS.find((t) => t.id === tokenId);
  const isMetadao = token?.category === "metadao";
  const isCommunity = token?.category === "community";

  const giniBase = isMetadao ? 0.55 : isCommunity ? 0.62 : 0.82;
  const gini = giniBase + (rand() - 0.5) * 0.12;

  const nakBase = isMetadao ? 25 : isCommunity ? 15 : 5;
  const nakamoto = Math.max(1, Math.round(nakBase + (rand() - 0.5) * 10));

  const hhiBase = isMetadao ? 400 : isCommunity ? 600 : 1800;
  const hhi = Math.round(hhiBase + (rand() - 0.5) * 300);

  const palmaBase = isMetadao ? 8 : isCommunity ? 15 : 40;
  const palma = palmaBase + (rand() - 0.5) * 6;

  const entropyBase = isMetadao ? 7.5 : isCommunity ? 6.8 : 4.2;
  const entropy = entropyBase + (rand() - 0.5) * 1.5;

  const holdersBase = isMetadao ? 2500 : isCommunity ? 50000 : 8000;
  const holders = Math.round(holdersBase + rand() * holdersBase * 0.5);

  return {
    tokenId,
    timestamp: Date.now(),
    giniCoefficient: Math.max(0, Math.min(1, gini)),
    hhi,
    nakamotoCoefficient: nakamoto,
    palmaRatio: Math.max(1, palma),
    shannonEntropy: Math.max(0, entropy),
    top1Percent: isMetadao ? 0.25 + rand() * 0.1 : 0.55 + rand() * 0.15,
    top10Percent: isMetadao ? 0.55 + rand() * 0.1 : 0.82 + rand() * 0.08,
    medianHolding: isMetadao ? 150 + rand() * 100 : 50 + rand() * 50,
  };
}

export function generateHolderBuckets(tokenId: string): HolderBuckets {
  const rand = seededRandom(hashString(tokenId + "_buckets"));
  const token = ALL_TOKENS.find((t) => t.id === tokenId);
  const isMetadao = token?.category === "metadao";

  return {
    whale: Math.round(isMetadao ? 3 + rand() * 5 : 8 + rand() * 12),
    shark: Math.round(isMetadao ? 15 + rand() * 10 : 25 + rand() * 20),
    dolphin: Math.round(isMetadao ? 80 + rand() * 40 : 100 + rand() * 60),
    fish: Math.round(isMetadao ? 2000 + rand() * 1000 : 5000 + rand() * 3000),
  };
}

// ── Current Price ────────────────────────────────────────────────────────────

export function generateCurrentPrice(tokenId: string): {
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
} {
  const history = generatePriceHistory(tokenId, 2);
  const current = history[history.length - 1];
  const prev = history[history.length - 2];

  return {
    price: current.price,
    change24h: ((current.price - prev.price) / prev.price) * 100,
    volume24h: current.volume ?? 0,
    marketCap: current.marketCap ?? 0,
  };
}

// ── Lorenz Curve from mock balances ──────────────────────────────────────────

export function generateLorenzPoints(
  tokenId: string
): { x: number; y: number }[] {
  const balances = generateHolderBalances(tokenId, 200);
  const sorted = [...balances].sort((a, b) => a - b);
  const total = sorted.reduce((s, v) => s + v, 0);

  const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let cum = 0;
  const step = Math.max(1, Math.floor(sorted.length / 50));

  for (let i = 0; i < sorted.length; i += step) {
    for (let j = i; j < Math.min(i + step, sorted.length); j++) {
      cum += sorted[j];
    }
    points.push({
      x: Math.min(i + step, sorted.length) / sorted.length,
      y: total === 0 ? 0 : cum / total,
    });
  }

  if (points[points.length - 1].x < 1) {
    points.push({ x: 1, y: 1 });
  }

  return points;
}

// ── All Token Mock Summary ───────────────────────────────────────────────────

export interface TokenSummary {
  token: TokenMetadata;
  price: number;
  change24h: number;
  holders: number;
  gini: number;
  nakamoto: number;
  marketCap: number;
}

export function getAllTokenSummaries(): TokenSummary[] {
  return ALL_TOKENS.map((token) => {
    const priceData = generateCurrentPrice(token.id);
    const metrics = generateMetrics(token.id);
    const buckets = generateHolderBuckets(token.id);
    const totalHolders =
      buckets.whale + buckets.shark + buckets.dolphin + buckets.fish;

    return {
      token,
      price: priceData.price,
      change24h: priceData.change24h,
      holders: totalHolders,
      gini: metrics.giniCoefficient,
      nakamoto: metrics.nakamotoCoefficient,
      marketCap: priceData.marketCap,
    };
  });
}
