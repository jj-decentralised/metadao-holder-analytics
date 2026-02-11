import { priceCache, simplePriceCache } from "./cache";
import { withRetry, isHttpRetryable } from "./retry";
import {
  validateCoinGeckoMarketChart,
  ValidationError,
} from "./validation";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// TTL constants (in milliseconds)
export const TTL_MARKET_CHART = 5 * 60 * 1000; // 5 minutes
export const TTL_SIMPLE_PRICE = 60 * 1000; // 1 minute

export type MarketPoint = {
  t: number; // ms epoch
  price: number;
  volume?: number;
  marketCap?: number;
};

export interface SimplePrice {
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

// Track API latency for health endpoint
let lastApiLatencyMs = 0;
let apiCallCount = 0;
let apiErrorCount = 0;

export function getApiMetrics() {
  return {
    lastLatencyMs: lastApiLatencyMs,
    totalCalls: apiCallCount,
    totalErrors: apiErrorCount,
    errorRate: apiCallCount > 0 ? apiErrorCount / apiCallCount : 0,
  };
}

export interface FetchError extends Error {
  status?: number;
  retryable: boolean;
}

/**
 * Create a typed fetch error
 */
function createFetchError(message: string, status?: number): FetchError {
  const error = new Error(message) as FetchError;
  error.status = status;
  error.retryable = status ? status >= 500 || status === 429 : true;
  return error;
}

/**
 * Check if CoinGecko error is retryable (rate limit or server error)
 */
function isCoinGeckoRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const fetchErr = error as FetchError;
    if (typeof fetchErr.retryable === "boolean") {
      return fetchErr.retryable;
    }
  }
  return isHttpRetryable(error);
}

/**
 * Fetch JSON with retry and optional validation.
 * Uses exponential backoff with jitter.
 */
async function getJson<T>(url: string): Promise<T> {
  return withRetry(
    async () => {
      const start = Date.now();
      apiCallCount++;

      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "metadao-analytics/0.2" },
          cache: "no-store",
        } as RequestInit);

        lastApiLatencyMs = Date.now() - start;

        if (!res.ok) {
          apiErrorCount++;
          throw createFetchError(`HTTP ${res.status}`, res.status);
        }

        return (await res.json()) as T;
      } catch (error) {
        lastApiLatencyMs = Date.now() - start;
        if (!(error instanceof Error && "status" in error)) {
          apiErrorCount++;
        }
        throw error;
      }
    },
    {
      maxAttempts: 3,
      initialDelayMs: 500,
      maxDelayMs: 8000,
      isRetryable: isCoinGeckoRetryable,
      onRetry: (err, attempt, delay) => {
        console.warn(`[CoinGecko] Retry attempt ${attempt} after ${delay}ms:`, err);
      },
    }
  );
}

/**
 * Parse and validate market chart response.
 * Validates structure and transforms to MarketPoint array.
 */
function parseMarketChartResponse(json: unknown): MarketPoint[] {
  // Validate the response structure
  const validation = validateCoinGeckoMarketChart(json);
  if (!validation.valid) {
    throw new ValidationError(validation.errors, "CoinGeckoMarketChart");
  }

  const data = validation.data;
  const points: MarketPoint[] = data.prices.map(([timestamp, price]) => ({
    t: timestamp,
    price: Number(price),
  }));

  // Merge volumes if available
  if (data.total_volumes) {
    for (let i = 0; i < Math.min(points.length, data.total_volumes.length); i++) {
      points[i].volume = Number(data.total_volumes[i][1]);
    }
  }

  // Merge market caps if available
  if (data.market_caps) {
    for (let i = 0; i < Math.min(points.length, data.market_caps.length); i++) {
      points[i].marketCap = Number(data.market_caps[i][1]);
    }
  }

  return points;
}

/**
 * Fetch market chart data with validation, retry, and caching.
 * Returns typed price data with optional volume and market cap.
 */
export async function fetchMarketChart(
  coinId: string,
  days: number | "max" = 90,
  vsCurrency = "usd"
): Promise<{ prices: MarketPoint[] } & Record<string, unknown>> {
  const cacheKey = `market:${coinId}:${days}:${vsCurrency}`;

  return priceCache.getOrSet(
    cacheKey,
    async () => {
      const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(
        coinId
      )}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
      const json = await getJson<unknown>(url);
      const prices = parseMarketChartResponse(json);
      return { prices, raw: json };
    },
    TTL_MARKET_CHART
  ) as Promise<{ prices: MarketPoint[] } & Record<string, unknown>>;
}

/**
 * Fetch simple price data (current price, 24h change, market cap, volume).
 * Uses 1 minute cache TTL for more up-to-date price info.
 * Validates response shape and throws ValidationError on invalid data.
 */
export async function fetchSimplePrice(
  coinId: string,
  vsCurrency = "usd"
): Promise<SimplePrice> {
  const cacheKey = `simple:${coinId}:${vsCurrency}`;

  return simplePriceCache.getOrSet(
    cacheKey,
    async () => {
      const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(
        coinId
      )}&vs_currencies=${vsCurrency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
      const json = await getJson<Record<string, Record<string, number>>>(url);

      // Validate coin exists in response
      const d = json?.[coinId];
      if (!d || typeof d !== "object") {
        throw new ValidationError(
          [`Token '${coinId}' not found or invalid in response`],
          "CoinGeckoSimplePrice"
        );
      }

      // Validate required fields are numbers (with fallbacks)
      const price = d[vsCurrency];
      if (typeof price !== "number" || !Number.isFinite(price)) {
        throw new ValidationError(
          [`Invalid price value for ${coinId}: ${price}`],
          "CoinGeckoSimplePrice"
        );
      }

      return {
        price,
        change24h: Number(d[`${vsCurrency}_24h_change`]) || 0,
        marketCap: Number(d[`${vsCurrency}_market_cap`]) || 0,
        volume24h: Number(d[`${vsCurrency}_24h_vol`]) || 0,
      };
    },
    TTL_SIMPLE_PRICE
  ) as Promise<SimplePrice>;
}

/**
 * Test CoinGecko API connectivity and rate limit status.
 * Returns diagnostic info for health checks.
 */
export async function testConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const res = await fetch(`${COINGECKO_BASE}/ping`, {
      headers: { "User-Agent": "metadao-analytics/0.2" },
      cache: "no-store",
    } as RequestInit);

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        error: `HTTP ${res.status}`,
      };
    }

    return { ok: true, latencyMs };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
