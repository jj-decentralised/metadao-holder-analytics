/**
 * Unified Token Data Service
 *
 * Tries real API calls first (Codex, CoinGecko, DeFiLlama),
 * falls back to mock data if API key missing or call fails.
 */

import { ALL_TOKENS } from "@/data/tokens";
import type {
  PricePoint,
  DistributionMetrics,
  HolderBuckets,
  WalletBalance,
  PriceSource,
} from "@/types";
import { getCodexClient, SOLANA_NETWORK_ID } from "@/lib/api/codex";
import { getCoingeckoClient } from "@/lib/api/coingecko";
import { getDefillamaClient } from "@/lib/api/defillama";
import { cache, TTL } from "./cache";
import * as mock from "@/lib/mock-data";
import { ALLOW_MOCKS } from "@/lib/config";

// ============================================================================
// Types
// ============================================================================

export interface TokenPriceData {
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export interface TokenMetricsData extends DistributionMetrics {
  holderCount: number;
  holderBuckets: HolderBuckets;
}

export interface TokenHoldersData {
  count: number;
  holders: WalletBalance[];
  cursor: string | null;
}

export interface TokenRevenueData {
  tvl: number;
  fees24h?: number;
  revenue24h?: number;
  chainTvls?: Record<string, number>;
}

export interface DataResult<T> {
  data: T;
  source: PriceSource | "mock";
  cached: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function getTokenById(tokenId: string) {
  return ALL_TOKENS.find((t) => t.id === tokenId);
}

function hasCodexKey(): boolean {
  return !!process.env.CODEX_API_KEY;
}

function hasCoingeckoKey(): boolean {
  // CoinGecko works without a key (free tier), but with lower rate limits
  return true;
}

/**
 * Compute Gini coefficient from sorted balances (descending).
 */
function computeGini(balances: number[]): number {
  if (balances.length === 0) return 0;

  const n = balances.length;
  const sorted = [...balances].sort((a, b) => a - b);
  const total = sorted.reduce((sum, v) => sum + v, 0);

  if (total === 0) return 0;

  let cumulativeSum = 0;
  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    cumulativeSum += sorted[i];
    weightedSum += (i + 1) * sorted[i];
  }

  const gini = (2 * weightedSum) / (n * total) - (n + 1) / n;
  return Math.max(0, Math.min(1, gini));
}

/**
 * Compute Herfindahl-Hirschman Index from balances.
 */
function computeHHI(balances: number[]): number {
  const total = balances.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  let hhi = 0;
  for (const b of balances) {
    const share = b / total;
    hhi += share * share * 10000; // Scale to 0-10000
  }
  return Math.round(hhi);
}

/**
 * Compute Nakamoto coefficient (minimum holders controlling 51%).
 */
function computeNakamoto(balances: number[]): number {
  const total = balances.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  const sorted = [...balances].sort((a, b) => b - a);
  const threshold = total * 0.51;

  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i];
    if (cumulative >= threshold) {
      return i + 1;
    }
  }
  return sorted.length;
}

/**
 * Compute Shannon entropy from balances.
 */
function computeEntropy(balances: number[]): number {
  const total = balances.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  let entropy = 0;
  for (const b of balances) {
    if (b > 0) {
      const p = b / total;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

/**
 * Compute Palma ratio (top 10% / bottom 40%).
 */
function computePalma(balances: number[]): number {
  const sorted = [...balances].sort((a, b) => b - a);
  const n = sorted.length;

  const top10Idx = Math.ceil(n * 0.1);
  const bottom40Idx = Math.floor(n * 0.6);

  const top10Sum = sorted.slice(0, top10Idx).reduce((s, v) => s + v, 0);
  const bottom40Sum = sorted.slice(bottom40Idx).reduce((s, v) => s + v, 0);

  if (bottom40Sum === 0) return 100;
  return top10Sum / bottom40Sum;
}

/**
 * Categorize holder by balance percentage.
 */
function categorizeHolder(
  percentOfSupply: number
): "whale" | "shark" | "dolphin" | "fish" {
  if (percentOfSupply >= 1) return "whale";
  if (percentOfSupply >= 0.1) return "shark";
  if (percentOfSupply >= 0.01) return "dolphin";
  return "fish";
}

// ============================================================================
// Token Price
// ============================================================================

/**
 * Get current token price with 24h change, volume, and market cap.
 * Tries CoinGecko first, then DeFiLlama, then falls back to mock.
 */
export async function getTokenPrice(
  tokenId: string
): Promise<DataResult<TokenPriceData>> {
  const cacheKey = `price:${tokenId}`;
  const cached = cache.get<DataResult<TokenPriceData>>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const token = getTokenById(tokenId);
  if (!token) {
    const mockData = mock.generateCurrentPrice(tokenId);
    return {
      data: mockData,
      source: "mock",
      cached: false,
    };
  }

  // Try CoinGecko first (if coingeckoId available)
  if (token.coingeckoId && hasCoingeckoKey()) {
    try {
      const client = getCoingeckoClient();
      const data = await client.getPrice(token.coingeckoId);

      if (data.price > 0) {
        const result: DataResult<TokenPriceData> = {
          data: {
            price: data.price,
            change24h: data.change24h,
            volume24h: data.volume24h,
            marketCap: data.marketCap,
          },
          source: "coingecko",
          cached: false,
        };
        cache.set(cacheKey, result, TTL.PRICE);
        return result;
      }
    } catch (err) {
      console.warn(`CoinGecko price fetch failed for ${tokenId}:`, err);
    }
  }

  // Try DeFiLlama as fallback
  try {
    const client = getDefillamaClient();
    const data = await client.getTokenPrice(token.mintAddress);

    if (data && data.price > 0) {
      // DeFiLlama doesn't provide volume/marketCap/change directly
      // We'll need to estimate or get from mock
      const mockData = mock.generateCurrentPrice(tokenId);
      const result: DataResult<TokenPriceData> = {
        data: {
          price: data.price,
          change24h: mockData.change24h, // Use mock for change
          volume24h: mockData.volume24h, // Use mock for volume
          marketCap: mockData.marketCap, // Use mock for marketCap
        },
        source: "defillama",
        cached: false,
      };
      cache.set(cacheKey, result, TTL.PRICE);
      return result;
    }
  } catch (err) {
    console.warn(`DeFiLlama price fetch failed for ${tokenId}:`, err);
  }

  // Fall back to mock
  if (!ALLOW_MOCKS) {
    throw new Error("MOCKS_DISABLED");
  }
  const mockData = mock.generateCurrentPrice(tokenId);
  return {
    data: mockData,
    source: "mock",
    cached: false,
  };
}

// ============================================================================
// Price History
// ============================================================================

/**
 * Get historical price data for a token.
 * Tries CoinGecko first, then DeFiLlama, then falls back to mock.
 */
export async function getPriceHistory(
  tokenId: string,
  days: number = 90
): Promise<DataResult<PricePoint[]>> {
  const cacheKey = `priceHistory:${tokenId}:${days}`;
  const cached = cache.get<DataResult<PricePoint[]>>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const token = getTokenById(tokenId);
  if (!token) {
    const mockData = mock.generatePriceHistory(tokenId, days);
    return {
      data: mockData,
      source: "mock",
      cached: false,
    };
  }

  // Try CoinGecko first
  if (token.coingeckoId && hasCoingeckoKey()) {
    try {
      const client = getCoingeckoClient();
      const data = await client.getPriceHistory(token.coingeckoId, days);

      if (data.length > 0) {
        const result: DataResult<PricePoint[]> = {
          data,
          source: "coingecko",
          cached: false,
        };
        cache.set(cacheKey, result, TTL.PRICE_HISTORY);
        return result;
      }
    } catch (err) {
      console.warn(`CoinGecko price history failed for ${tokenId}:`, err);
    }
  }

  // Try DeFiLlama as fallback
  try {
    const client = getDefillamaClient();
    const now = Math.floor(Date.now() / 1000);
    const start = now - days * 86400;
    const data = await client.getPriceHistory(token.mintAddress, start, days);

    if (data.length > 0) {
      const result: DataResult<PricePoint[]> = {
        data,
        source: "defillama",
        cached: false,
      };
      cache.set(cacheKey, result, TTL.PRICE_HISTORY);
      return result;
    }
  } catch (err) {
    console.warn(`DeFiLlama price history failed for ${tokenId}:`, err);
  }

  // Fall back to mock
  if (!ALLOW_MOCKS) {
    throw new Error("MOCKS_DISABLED");
  }
  const mockData = mock.generatePriceHistory(tokenId, days);
  return {
    data: mockData,
    source: "mock",
    cached: false,
  };
}

// ============================================================================
// Token Holders
// ============================================================================

/**
 * Get token holders with pagination.
 * Tries Codex first, then falls back to mock.
 */
export async function getTokenHolders(
  tokenId: string,
  limit: number = 100,
  cursor?: string
): Promise<DataResult<TokenHoldersData>> {
  const cacheKey = `holders:${tokenId}:${limit}:${cursor || "start"}`;
  const cached = cache.get<DataResult<TokenHoldersData>>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const token = getTokenById(tokenId);
  if (!token) {
    if (!ALLOW_MOCKS) {
      throw new Error("MOCKS_DISABLED");
    }
    // Generate mock holders
    const balances = mock.generateHolderBalances(tokenId, limit);
    const total = balances.reduce((s, v) => s + v, 0);
    const holders = balances.map((balance, idx) => ({
      address: `mock${idx.toString().padStart(8, "0")}`,
      balance,
      percentOfSupply: (balance / total) * 100,
      category: categorizeHolder((balance / total) * 100),
    }));

    return {
      data: { count: limit, holders, cursor: null },
      source: "mock",
      cached: false,
    };
  }

  // Try Codex first
  if (hasCodexKey()) {
    try {
      const client = getCodexClient();
      const data = await client.getHolders(
        token.mintAddress,
        SOLANA_NETWORK_ID,
        limit,
        cursor
      );

      if (data.items.length > 0) {
        const holders: WalletBalance[] = data.items.map((h) => ({
          address: h.address,
          balance: parseFloat(h.balance),
          percentOfSupply: h.percentOwned,
          category: categorizeHolder(h.percentOwned),
        }));

        const result: DataResult<TokenHoldersData> = {
          data: {
            count: data.count,
            holders,
            cursor: data.cursor,
          },
          source: "codex",
          cached: false,
        };
        cache.set(cacheKey, result, TTL.HOLDERS);
        return result;
      }
    } catch (err) {
      console.warn(`Codex holders fetch failed for ${tokenId}:`, err);
    }
  }

  // Fall back to mock
  if (!ALLOW_MOCKS) {
    throw new Error("MOCKS_DISABLED");
  }
  const balances = mock.generateHolderBalances(tokenId, limit);
  const total = balances.reduce((s, v) => s + v, 0);
  const holders = balances.map((balance, idx) => ({
    address: `mock${idx.toString().padStart(8, "0")}`,
    balance,
    percentOfSupply: (balance / total) * 100,
    category: categorizeHolder((balance / total) * 100),
  }));

  return {
    data: { count: limit, holders, cursor: null },
    source: "mock",
    cached: false,
  };
}

// ============================================================================
// Token Metrics
// ============================================================================

/**
 * Get token distribution metrics.
 * Tries Codex for real holder data, then computes metrics. Falls back to mock.
 */
export async function getTokenMetrics(
  tokenId: string
): Promise<DataResult<TokenMetricsData>> {
  const cacheKey = `metrics:${tokenId}`;
  const cached = cache.get<DataResult<TokenMetricsData>>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const token = getTokenById(tokenId);
  if (!token) {
    if (!ALLOW_MOCKS) {
      throw new Error("MOCKS_DISABLED");
    }
    const metrics = mock.generateMetrics(tokenId);
    const buckets = mock.generateHolderBuckets(tokenId);
    const holderCount =
      buckets.whale + buckets.shark + buckets.dolphin + buckets.fish;
    return {
      data: { ...metrics, holderCount, holderBuckets: buckets },
      source: "mock",
      cached: false,
    };
  }

  // Try Codex first
  if (hasCodexKey()) {
    try {
      const client = getCodexClient();

      // Get token info for holder count
      const tokenInfo = await client.getTokenInfo(
        token.mintAddress,
        SOLANA_NETWORK_ID
      );

      // Get top holders for distribution metrics
      const holdersData = await client.getHolders(
        token.mintAddress,
        SOLANA_NETWORK_ID,
        200 // Get more holders for better metrics
      );

      if (tokenInfo && holdersData.items.length > 0) {
        const balances = holdersData.items.map((h) => parseFloat(h.balance));
        const percentages = holdersData.items.map((h) => h.percentOwned);
        const total = balances.reduce((s, v) => s + v, 0);

        // Compute metrics from real data
        const giniCoefficient = computeGini(balances);
        const hhi = computeHHI(balances);
        const nakamotoCoefficient = computeNakamoto(balances);
        const shannonEntropy = computeEntropy(balances);
        const palmaRatio = computePalma(balances);

        // Top percentages
        const top1Count = Math.ceil(holdersData.items.length * 0.01) || 1;
        const top10Count = Math.ceil(holdersData.items.length * 0.1);
        const top1Sum = balances.slice(0, top1Count).reduce((s, v) => s + v, 0);
        const top10Sum = balances
          .slice(0, top10Count)
          .reduce((s, v) => s + v, 0);
        const top1Percent = total > 0 ? top1Sum / total : 0;
        const top10Percent = total > 0 ? top10Sum / total : 0;

        // Median holding
        const sortedBalances = [...balances].sort((a, b) => a - b);
        const medianHolding =
          sortedBalances[Math.floor(sortedBalances.length / 2)] || 0;

        // Count buckets
        const buckets: HolderBuckets = { whale: 0, shark: 0, dolphin: 0, fish: 0 };
        for (const pct of percentages) {
          const category = categorizeHolder(pct);
          buckets[category]++;
        }

        // Extrapolate fish count based on total holder count
        const measuredCount = holdersData.items.length;
        if (tokenInfo.holderCount > measuredCount) {
          buckets.fish += tokenInfo.holderCount - measuredCount;
        }

        const result: DataResult<TokenMetricsData> = {
          data: {
            tokenId,
            timestamp: Date.now(),
            giniCoefficient,
            hhi,
            nakamotoCoefficient,
            palmaRatio,
            shannonEntropy,
            top1Percent,
            top10Percent,
            medianHolding,
            holderCount: tokenInfo.holderCount,
            holderBuckets: buckets,
          },
          source: "codex",
          cached: false,
        };
        cache.set(cacheKey, result, TTL.METRICS);
        return result;
      }
    } catch (err) {
      console.warn(`Codex metrics fetch failed for ${tokenId}:`, err);
    }
  }

  // Fall back to mock
  if (!ALLOW_MOCKS) {
    throw new Error("MOCKS_DISABLED");
  }
  const metrics = mock.generateMetrics(tokenId);
  const buckets = mock.generateHolderBuckets(tokenId);
  const holderCount =
    buckets.whale + buckets.shark + buckets.dolphin + buckets.fish;

  return {
    data: { ...metrics, holderCount, holderBuckets: buckets },
    source: "mock",
    cached: false,
  };
}

// ============================================================================
// Token Revenue (DeFiLlama Protocol Data)
// ============================================================================

/**
 * Get token/protocol revenue data from DeFiLlama.
 * Falls back to null data if not found.
 */
export async function getTokenRevenue(
  tokenId: string
): Promise<DataResult<TokenRevenueData | null>> {
  const cacheKey = `revenue:${tokenId}`;
  const cached = cache.get<DataResult<TokenRevenueData | null>>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const token = getTokenById(tokenId);
  if (!token) {
    return {
      data: null,
      source: "mock",
      cached: false,
    };
  }

  // Map token IDs to DeFiLlama slugs
  const defillamaSlugs: Record<string, string> = {
    jito: "jito",
    jup: "jupiter",
    ray: "raydium",
    orca: "orca",
    drift: "drift",
    mnde: "marinade-finance",
    kmno: "kamino",
    slnd: "solend",
    render: "render-network",
    hnt: "helium",
  };

  const slug = defillamaSlugs[tokenId];
  if (!slug) {
    return {
      data: null,
      source: "mock",
      cached: false,
    };
  }

  try {
    const client = getDefillamaClient();
    const protocol = await client.getProtocol(slug);

    if (protocol) {
      const result: DataResult<TokenRevenueData> = {
        data: {
          tvl: protocol.tvl,
          chainTvls: protocol.chainTvls,
        },
        source: "defillama",
        cached: false,
      };
      cache.set(cacheKey, result, TTL.PROTOCOL);
      return result;
    }
  } catch (err) {
    console.warn(`DeFiLlama protocol fetch failed for ${tokenId}:`, err);
  }

  return {
    data: null,
    source: "mock",
    cached: false,
  };
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get prices for multiple tokens at once.
 * More efficient than calling getTokenPrice individually.
 */
export async function getBatchPrices(
  tokenIds: string[]
): Promise<Record<string, DataResult<TokenPriceData>>> {
  const results: Record<string, DataResult<TokenPriceData>> = {};

  // Check cache first
  const uncachedIds: string[] = [];
  for (const id of tokenIds) {
    const cacheKey = `price:${id}`;
    const cached = cache.get<DataResult<TokenPriceData>>(cacheKey);
    if (cached) {
      results[id] = { ...cached, cached: true };
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length === 0) {
    return results;
  }

  // Group tokens by coingeckoId availability
  const coingeckoTokens: { id: string; coingeckoId: string }[] = [];
  const defillamaTokens: { id: string; mintAddress: string }[] = [];
  const mockTokens: string[] = [];

  for (const id of uncachedIds) {
    const token = getTokenById(id);
    if (token?.coingeckoId) {
      coingeckoTokens.push({ id, coingeckoId: token.coingeckoId });
    } else if (token) {
      defillamaTokens.push({ id, mintAddress: token.mintAddress });
    } else {
      mockTokens.push(id);
    }
  }

  // Batch fetch from CoinGecko
  if (coingeckoTokens.length > 0 && hasCoingeckoKey()) {
    try {
      const client = getCoingeckoClient();
      const coingeckoIds = coingeckoTokens.map((t) => t.coingeckoId);
      const data = await client.getBatchPrices(coingeckoIds);

      for (const t of coingeckoTokens) {
        const priceData = data[t.coingeckoId];
        if (priceData) {
          const result: DataResult<TokenPriceData> = {
            data: {
              price: priceData.price,
              change24h: 0, // Not available in batch endpoint
              volume24h: priceData.volume24h,
              marketCap: priceData.marketCap,
            },
            source: "coingecko",
            cached: false,
          };
          cache.set(`price:${t.id}`, result, TTL.PRICE);
          results[t.id] = result;
        } else {
          // Move to DeFiLlama fallback
          const token = getTokenById(t.id);
          if (token) {
            defillamaTokens.push({ id: t.id, mintAddress: token.mintAddress });
          } else {
            mockTokens.push(t.id);
          }
        }
      }
    } catch (err) {
      console.warn("CoinGecko batch price fetch failed:", err);
      // Move all to fallback
      for (const t of coingeckoTokens) {
        const token = getTokenById(t.id);
        if (token) {
          defillamaTokens.push({ id: t.id, mintAddress: token.mintAddress });
        } else {
          mockTokens.push(t.id);
        }
      }
    }
  }

  // Batch fetch from DeFiLlama
  if (defillamaTokens.length > 0) {
    try {
      const client = getDefillamaClient();
      const mintAddresses = defillamaTokens.map((t) => t.mintAddress);
      const data = await client.getBatchPrices(mintAddresses);

      for (const t of defillamaTokens) {
        if (results[t.id]) continue; // Already fetched

        const priceData = data[t.mintAddress];
        if (priceData) {
          const mockData = mock.generateCurrentPrice(t.id);
          const result: DataResult<TokenPriceData> = {
            data: {
              price: priceData.price,
              change24h: mockData.change24h,
              volume24h: mockData.volume24h,
              marketCap: mockData.marketCap,
            },
            source: "defillama",
            cached: false,
          };
          cache.set(`price:${t.id}`, result, TTL.PRICE);
          results[t.id] = result;
        } else {
          mockTokens.push(t.id);
        }
      }
    } catch (err) {
      console.warn("DeFiLlama batch price fetch failed:", err);
      for (const t of defillamaTokens) {
        if (!results[t.id]) {
          mockTokens.push(t.id);
        }
      }
    }
  }

  // Fill in mock data for remaining
  for (const id of mockTokens) {
    if (results[id]) continue;
    const mockData = mock.generateCurrentPrice(id);
    results[id] = {
      data: mockData,
      source: "mock",
      cached: false,
    };
  }

  return results;
}

// ============================================================================
// Aggregated Token Summary (matches mock-data.ts signature)
// ============================================================================

export interface TokenSummary {
  token: (typeof ALL_TOKENS)[number];
  price: number;
  change24h: number;
  holders: number;
  gini: number;
  nakamoto: number;
  marketCap: number;
  buyPressure: number;
  source: PriceSource | "mock";
}

/**
 * Get summary data for all tokens.
 * Uses batch operations for efficiency, falls back to mock for missing data.
 */
export async function getAllTokenSummaries(): Promise<TokenSummary[]> {
  const cacheKey = "allTokenSummaries";
  const cached = cache.get<TokenSummary[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Get batch prices first
  const tokenIds = ALL_TOKENS.map((t) => t.id);

  // If mocks are disabled, return an empty set to avoid synthetic content in UI
  if (!ALLOW_MOCKS) {
    return [];
  }

  const priceResults = await getBatchPrices(tokenIds);

  const summaries: TokenSummary[] = [];

  for (const token of ALL_TOKENS) {
    const priceResult = priceResults[token.id];
    const metricsResult = await getTokenMetrics(token.id);

    // Use mock trading metrics for buyPressure
    const tradingMetrics = mock.generateTradingMetrics(token.id);

    summaries.push({
      token,
      price: priceResult?.data.price ?? 0,
      change24h: priceResult?.data.change24h ?? 0,
      holders: metricsResult.data.holderCount,
      gini: metricsResult.data.giniCoefficient,
      nakamoto: metricsResult.data.nakamotoCoefficient,
      marketCap: priceResult?.data.marketCap ?? 0,
      buyPressure: tradingMetrics.buyPressure * 100,
      source: priceResult?.source ?? "mock",
    });
  }

  cache.set(cacheKey, summaries, TTL.PRICE);
  return summaries;
}

// ============================================================================
// Re-exports for compatibility with mock-data.ts
// ============================================================================

// Export mock functions for components that need them directly
export {
  generatePriceHistory,
  generateHolderBalances,
  generateMetrics,
  generateHolderBuckets,
  generateCurrentPrice,
  generateLorenzPoints,
  generateHolderTimeSeries,
  generateOHLCV,
  generateTradingMetrics,
  generateWhaleMovements,
  generateHolderCohortTimeSeries,
  getCategoryAverages,
} from "@/lib/mock-data";
