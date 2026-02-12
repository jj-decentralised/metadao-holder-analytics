import { ALL_TOKENS } from "@/data/tokens";
import type {
  PricePoint,
  DistributionMetrics,
  HolderBuckets,
  TokenMetadata,
} from "@/types";

// ── Types for new generators ─────────────────────────────────────────────────

export interface HolderTimeSeriesPoint {
  timestamp: number;
  totalHolders: number;
  gini: number;
  top10Pct: number;
  whaleCount: number;
  sharkCount: number;
  dolphinCount: number;
  fishCount: number;
}

export interface OHLCVPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingMetrics {
  volume24h: number;
  buyVolume24h: number;
  sellVolume24h: number;
  txnCount24h: number;
  liquidity: number;
  buyPressure: number;
}

export interface WhaleMovement {
  address: string;
  timestamp: number;
  type: "accumulate" | "distribute";
  amount: number;
  percentOfSupply: number;
}

export interface HolderCohortPoint {
  timestamp: number;
  whales: number;
  sharks: number;
  dolphins: number;
  fish: number;
}

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

// ── Helper: Get token category type ──────────────────────────────────────────

type CategoryType = "metadao" | "vc" | "community";

function getTokenCategoryType(tokenId: string): CategoryType {
  const token = ALL_TOKENS.find((t) => t.id === tokenId);
  const category = token?.category ?? "";

  // metadao-ico and futarchy-dao fall back to metadao behavior
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
  // vc-backed and any unknown categories default to vc behavior
  return "vc";
}

// ── Helper: Generate base58-like wallet address ──────────────────────────────

function generateWalletAddress(rand: () => number): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let address = "";
  for (let i = 0; i < 44; i++) {
    address += chars[Math.floor(rand() * chars.length)];
  }
  return address;
}

// ── Holder Time Series ───────────────────────────────────────────────────────

export function generateHolderTimeSeries(
  tokenId: string,
  days = 180
): HolderTimeSeriesPoint[] {
  const rand = seededRandom(hashString(tokenId + "_holder_ts"));
  const categoryType = getTokenCategoryType(tokenId);

  // Base values based on category
  const baseHolders =
    categoryType === "metadao"
      ? 800 + rand() * 400
      : categoryType === "community"
        ? 2000 + rand() * 1000
        : 3000 + rand() * 2000;

  // Monthly growth rates
  const monthlyGrowth =
    categoryType === "metadao"
      ? 0.03 + rand() * 0.05 // 3-8%
      : categoryType === "community"
        ? 0.1 + rand() * 0.1 // 10-20%
        : 0.01 + rand() * 0.02; // 1-3%

  const dailyGrowth = Math.pow(1 + monthlyGrowth, 1 / 30) - 1;

  // Starting Gini based on category
  let gini =
    categoryType === "metadao"
      ? 0.65 + rand() * 0.1
      : categoryType === "community"
        ? 0.7 + rand() * 0.1
        : 0.85 + rand() * 0.08;

  // Gini trend
  const giniTrend =
    categoryType === "metadao"
      ? -0.0005 // slowly improving
      : categoryType === "community"
        ? (rand() - 0.5) * 0.001 // fluctuates
        : 0.0002; // slowly worsening

  const points: HolderTimeSeriesPoint[] = [];
  const now = Date.now();
  let holders = baseHolders;

  // Starting cohort distribution
  let whaleRatio =
    categoryType === "metadao" ? 0.002 : categoryType === "vc" ? 0.004 : 0.001;
  let sharkRatio =
    categoryType === "metadao" ? 0.01 : categoryType === "vc" ? 0.015 : 0.008;
  let dolphinRatio =
    categoryType === "metadao" ? 0.04 : categoryType === "vc" ? 0.05 : 0.03;

  for (let i = days; i >= 0; i--) {
    const ts = now - i * 86400000;

    // Add noise but maintain trend
    const dailyNoise = (rand() - 0.5) * 0.01;
    holders *= 1 + dailyGrowth + dailyNoise;

    // Gini evolution
    gini += giniTrend + (rand() - 0.5) * 0.002;
    gini = Math.max(0.3, Math.min(0.95, gini));

    // Calculate top10Pct from gini (approximate relationship)
    const top10Pct = 0.3 + gini * 0.5 + (rand() - 0.5) * 0.05;

    // Cohort counts
    const whaleCount = Math.round(holders * whaleRatio * (0.9 + rand() * 0.2));
    const sharkCount = Math.round(holders * sharkRatio * (0.9 + rand() * 0.2));
    const dolphinCount = Math.round(
      holders * dolphinRatio * (0.9 + rand() * 0.2)
    );
    const fishCount = Math.round(
      holders - whaleCount - sharkCount - dolphinCount
    );

    points.push({
      timestamp: ts,
      totalHolders: Math.round(holders),
      gini,
      top10Pct: Math.max(0.3, Math.min(0.95, top10Pct)),
      whaleCount: Math.max(0, whaleCount),
      sharkCount: Math.max(0, sharkCount),
      dolphinCount: Math.max(0, dolphinCount),
      fishCount: Math.max(0, fishCount),
    });
  }

  return points;
}

// ── OHLCV Data ───────────────────────────────────────────────────────────────

export function generateOHLCV(tokenId: string, days = 90): OHLCVPoint[] {
  const rand = seededRandom(hashString(tokenId + "_ohlcv"));
  const categoryType = getTokenCategoryType(tokenId);
  const priceHistory = generatePriceHistory(tokenId, days);

  // Volume characteristics based on category
  const baseVolume =
    categoryType === "metadao"
      ? 50000 + rand() * 100000 // lower but steady
      : categoryType === "community"
        ? 200000 + rand() * 500000 // highly variable
        : 500000 + rand() * 1000000; // higher, institutional

  const volumeVolatility =
    categoryType === "metadao"
      ? 0.3
      : categoryType === "community"
        ? 0.8
        : 0.5;

  const points: OHLCVPoint[] = [];

  for (let i = 0; i < priceHistory.length; i++) {
    const dayPrice = priceHistory[i].price;

    // Intraday volatility
    const intradayVol =
      categoryType === "metadao"
        ? 0.02 + rand() * 0.03
        : categoryType === "community"
          ? 0.05 + rand() * 0.1
          : 0.03 + rand() * 0.05;

    // Generate OHLC with some randomness
    const openOffset = (rand() - 0.5) * intradayVol;
    const open = dayPrice * (1 + openOffset);

    const highExtra = rand() * intradayVol;
    const lowExtra = rand() * intradayVol;

    const high = Math.max(open, dayPrice) * (1 + highExtra);
    const low = Math.min(open, dayPrice) * (1 - lowExtra);
    const close = dayPrice;

    // Calculate price change magnitude for volume correlation
    const priceChange =
      i > 0 ? Math.abs(dayPrice - priceHistory[i - 1].price) / dayPrice : 0;

    // Volume correlates with price movement
    const volumeMultiplier = 1 + priceChange * 10 * (0.5 + rand());
    const dailyNoise = 1 + (rand() - 0.5) * volumeVolatility;

    // Community tokens get occasional volume spikes
    let volumeSpike = 1;
    if (categoryType === "community" && rand() < 0.05) {
      volumeSpike = 3 + rand() * 7; // 3x-10x spike
    }

    const volume =
      baseVolume * volumeMultiplier * dailyNoise * volumeSpike * dayPrice;

    points.push({
      timestamp: priceHistory[i].timestamp,
      open,
      high,
      low,
      close,
      volume: Math.round(volume),
    });
  }

  return points;
}

// ── Trading Metrics ──────────────────────────────────────────────────────────

export function generateTradingMetrics(tokenId: string): TradingMetrics {
  const rand = seededRandom(hashString(tokenId + "_trading"));
  const categoryType = getTokenCategoryType(tokenId);
  const priceData = generateCurrentPrice(tokenId);

  // Buy pressure ranges by category
  const buyPressure =
    categoryType === "metadao"
      ? 0.52 + rand() * 0.06 // 0.52-0.58 (slight accumulation)
      : categoryType === "community"
        ? 0.35 + rand() * 0.3 // 0.35-0.65 (volatile)
        : 0.45 + rand() * 0.05; // 0.45-0.50 (neutral to selling)

  // Volume based on price data with category multiplier
  const volumeMultiplier =
    categoryType === "metadao"
      ? 0.5 + rand() * 0.3
      : categoryType === "community"
        ? 0.8 + rand() * 1.5
        : 1 + rand() * 0.5;

  const volume24h = priceData.volume24h * volumeMultiplier;
  const buyVolume24h = volume24h * buyPressure;
  const sellVolume24h = volume24h * (1 - buyPressure);

  // Transaction count
  const baseTxn =
    categoryType === "metadao"
      ? 500 + rand() * 500
      : categoryType === "community"
        ? 2000 + rand() * 5000
        : 1000 + rand() * 2000;

  // Liquidity as multiple of 24h volume
  const liquidityMultiplier =
    categoryType === "metadao"
      ? 3 + rand() * 2
      : categoryType === "community"
        ? 1 + rand() * 2
        : 5 + rand() * 3;

  return {
    volume24h,
    buyVolume24h,
    sellVolume24h,
    txnCount24h: Math.round(baseTxn),
    liquidity: volume24h * liquidityMultiplier,
    buyPressure,
  };
}

// ── Whale Movements ──────────────────────────────────────────────────────────

export function generateWhaleMovements(
  tokenId: string,
  count = 20
): WhaleMovement[] {
  const rand = seededRandom(hashString(tokenId + "_whale_moves"));
  const categoryType = getTokenCategoryType(tokenId);

  // Accumulation probability by category
  const accumulateProbability =
    categoryType === "metadao"
      ? 0.65 // more accumulation
      : categoryType === "community"
        ? 0.5 // mixed
        : 0.35; // more distribution (VC selling)

  const movements: WhaleMovement[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rand() * 30);
    const hoursAgo = Math.floor(rand() * 24);
    const timestamp = now - daysAgo * 86400000 - hoursAgo * 3600000;

    const isAccumulation = rand() < accumulateProbability;

    // Amount varies by category
    const baseAmount =
      categoryType === "metadao"
        ? 10000 + rand() * 50000
        : categoryType === "community"
          ? 100000000 + rand() * 500000000 // meme tokens have huge supplies
          : 50000 + rand() * 200000;

    // Percent of supply
    const percentOfSupply =
      categoryType === "metadao"
        ? 0.1 + rand() * 0.5 // 0.1-0.6%
        : categoryType === "community"
          ? 0.01 + rand() * 0.1 // 0.01-0.11% (larger supply)
          : 0.2 + rand() * 0.8; // 0.2-1.0%

    movements.push({
      address: generateWalletAddress(rand),
      timestamp,
      type: isAccumulation ? "accumulate" : "distribute",
      amount: Math.round(baseAmount),
      percentOfSupply,
    });
  }

  // Sort by timestamp descending (most recent first)
  return movements.sort((a, b) => b.timestamp - a.timestamp);
}

// ── Holder Cohort Time Series ────────────────────────────────────────────────

export function generateHolderCohortTimeSeries(
  tokenId: string,
  days = 180
): HolderCohortPoint[] {
  const rand = seededRandom(hashString(tokenId + "_cohort_ts"));
  const categoryType = getTokenCategoryType(tokenId);

  // Starting values based on category
  let whales =
    categoryType === "metadao"
      ? 5 + Math.floor(rand() * 5)
      : categoryType === "community"
        ? 15 + Math.floor(rand() * 10) // starts higher (early speculators)
        : 20 + Math.floor(rand() * 15); // VC starts highest

  let sharks =
    categoryType === "metadao"
      ? 20 + Math.floor(rand() * 10)
      : categoryType === "community"
        ? 50 + Math.floor(rand() * 30)
        : 80 + Math.floor(rand() * 40);

  let dolphins =
    categoryType === "metadao"
      ? 80 + Math.floor(rand() * 40)
      : categoryType === "community"
        ? 200 + Math.floor(rand() * 100)
        : 300 + Math.floor(rand() * 150);

  let fish =
    categoryType === "metadao"
      ? 600 + Math.floor(rand() * 300)
      : categoryType === "community"
        ? 1500 + Math.floor(rand() * 500)
        : 2000 + Math.floor(rand() * 1000);

  const points: HolderCohortPoint[] = [];
  const now = Date.now();

  for (let i = days; i >= 0; i--) {
    const ts = now - i * 86400000;

    // Daily changes based on category
    if (categoryType === "metadao") {
      // MetaDAO: whales stay low, fish grow most
      whales += rand() < 0.1 ? (rand() < 0.6 ? 1 : -1) : 0;
      sharks += rand() < 0.2 ? Math.round((rand() - 0.4) * 2) : 0;
      dolphins += rand() < 0.3 ? Math.round((rand() - 0.3) * 3) : 0;
      fish += Math.round((rand() - 0.3) * 5);
    } else if (categoryType === "community") {
      // Community: whale count spikes then drops
      const dayProgress = (days - i) / days;
      if (dayProgress < 0.2) {
        // Early: whales accumulating
        whales += rand() < 0.3 ? Math.round(rand() * 2) : 0;
      } else {
        // Later: speculators leaving
        whales += rand() < 0.2 ? (rand() < 0.3 ? 1 : -1) : 0;
      }
      sharks += rand() < 0.25 ? Math.round((rand() - 0.4) * 3) : 0;
      dolphins += rand() < 0.4 ? Math.round((rand() - 0.3) * 5) : 0;
      fish += Math.round((rand() - 0.2) * 15);
    } else {
      // VC: whale count starts high, slowly decreases (unlocks)
      whales += rand() < 0.15 ? (rand() < 0.3 ? 1 : -1) : 0;
      sharks += rand() < 0.2 ? Math.round((rand() - 0.45) * 2) : 0;
      dolphins += rand() < 0.3 ? Math.round((rand() - 0.4) * 4) : 0;
      fish += Math.round((rand() - 0.35) * 8);
    }

    // Ensure non-negative
    whales = Math.max(1, whales);
    sharks = Math.max(0, sharks);
    dolphins = Math.max(0, dolphins);
    fish = Math.max(0, fish);

    points.push({
      timestamp: ts,
      whales,
      sharks,
      dolphins,
      fish,
    });
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
  buyPressure: number; // 0-100, percentage of buys vs sells
}

export function getAllTokenSummaries(): TokenSummary[] {
  return ALL_TOKENS.map((token) => {
    const priceData = generateCurrentPrice(token.id);
    const metrics = generateMetrics(token.id);
    const buckets = generateHolderBuckets(token.id);
    const tradingMetrics = generateTradingMetrics(token.id);
    const totalHolders =
      buckets.whale + buckets.shark + buckets.dolphin + buckets.fish;

    // Generate buy pressure based on token category (metadao tends to have higher buy pressure)
    const rand = seededRandom(hashString(token.id + "_pressure"));
    const isMetadao = token.category === "metadao";
    const isCommunity = token.category === "community";
    const basePressure = isMetadao ? 58 : isCommunity ? 50 : 45;
    const buyPressure = Math.max(20, Math.min(80, basePressure + (rand() - 0.5) * 25));

    return {
      token,
      price: priceData.price,
      change24h: priceData.change24h,
      holders: totalHolders,
      gini: metrics.giniCoefficient,
      nakamoto: metrics.nakamotoCoefficient,
      marketCap: priceData.marketCap,
      buyPressure,
    };
  });
}
