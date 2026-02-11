import { priceCache, simplePriceCache } from "./cache";

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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson<T>(url: string, tries = 3, delayMs = 400): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    const start = Date.now();
    apiCallCount++;
    try {
      const res = await fetch(url, {
        // CoinGecko occasionally 429s without UA
        headers: { "User-Agent": "metadao-analytics/0.2" },
        // Edge runtime friendly
        cache: "no-store",
      } as RequestInit);
      lastApiLatencyMs = Date.now() - start;
      if (!res.ok) {
        apiErrorCount++;
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (e) {
      lastApiLatencyMs = Date.now() - start;
      apiErrorCount++;
      lastErr = e;
      if (i < tries - 1) await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr;
}

function parseMarketChartResponse(json: any): MarketPoint[] {
  const points: MarketPoint[] = (json?.prices || []).map((p: [number, number]) => ({
    t: p[0],
    price: Number(p[1] ?? 0),
  }));
  if (Array.isArray(json?.total_volumes)) {
    const volumes = json.total_volumes as [number, number][];
    for (let i = 0; i < Math.min(points.length, volumes.length); i++) {
      points[i].volume = Number(volumes[i][1] ?? 0);
    }
  }
  if (Array.isArray(json?.market_caps)) {
    const mcs = json.market_caps as [number, number][];
    for (let i = 0; i < Math.min(points.length, mcs.length); i++) {
      points[i].marketCap = Number(mcs[i][1] ?? 0);
    }
  }
  return points;
}

export async function fetchMarketChart(
  coinId: string,
  days: number | "max" = 90,
  vsCurrency = "usd",
): Promise<{ prices: MarketPoint[] } & Record<string, unknown>> {
  const cacheKey = `market:${coinId}:${days}:${vsCurrency}`;

  return priceCache.getOrSet(
    cacheKey,
    async () => {
      const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(
        coinId,
      )}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
      const json = await getJson<any>(url);
      const prices = parseMarketChartResponse(json);
      return { prices, raw: json };
    },
    TTL_MARKET_CHART
  ) as Promise<{ prices: MarketPoint[] } & Record<string, unknown>>;
}

/**
 * Fetch simple price data (current price, 24h change, market cap, volume).
 * Uses 1 minute cache TTL for more up-to-date price info.
 */
export async function fetchSimplePrice(
  coinId: string,
  vsCurrency = "usd",
): Promise<SimplePrice> {
  const cacheKey = `simple:${coinId}:${vsCurrency}`;

  return simplePriceCache.getOrSet(
    cacheKey,
    async () => {
      const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(
        coinId
      )}&vs_currencies=${vsCurrency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
      const json = await getJson<any>(url);
      const d = json?.[coinId];
      if (!d) throw new Error("Token not found");

      return {
        price: d[vsCurrency] ?? 0,
        change24h: d[`${vsCurrency}_24h_change`] ?? 0,
        marketCap: d[`${vsCurrency}_market_cap`] ?? 0,
        volume24h: d[`${vsCurrency}_24h_vol`] ?? 0,
      };
    },
    TTL_SIMPLE_PRICE
  ) as Promise<SimplePrice>;
}
