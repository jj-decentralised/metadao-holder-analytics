import type { PricePoint, OHLCV } from "@/types";
import { RateLimiter, withRetry } from "./rate-limiter";

const BASE_URL = "https://api.coingecko.com/api/v3";
const PRO_URL = "https://pro-api.coingecko.com/api/v3";

export class CoinGeckoClient {
  private limiter: RateLimiter;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey?: string) {
    // Free tier: ~30 req/min; Pro: ~500 req/min
    const isPro = !!apiKey;
    this.limiter = new RateLimiter(isPro ? 500 : 30, isPro ? 8.3 : 0.5);
    this.baseUrl = isPro ? PRO_URL : BASE_URL;
    this.headers = apiKey
      ? { "x-cg-pro-api-key": apiKey, Accept: "application/json" }
      : { Accept: "application/json" };
  }

  private async fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.limiter.acquire();

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    return withRetry(async () => {
      const res = await fetch(url.toString(), { headers: this.headers });
      if (!res.ok) {
        const err = new Error(`CoinGecko ${res.status}: ${res.statusText}`) as Error & { status: number };
        err.status = res.status;
        throw err;
      }
      return res.json() as Promise<T>;
    });
  }

  /** Get current price for a token */
  async getPrice(id: string): Promise<{ price: number; volume24h: number; marketCap: number; change24h: number }> {
    const data = await this.fetch<Record<string, { usd: number; usd_24h_vol: number; usd_market_cap: number; usd_24h_change: number }>>(
      "/simple/price",
      { ids: id, vs_currencies: "usd", include_24hr_vol: "true", include_market_cap: "true", include_24hr_change: "true" }
    );
    const d = data[id];
    return {
      price: d?.usd ?? 0,
      volume24h: d?.usd_24h_vol ?? 0,
      marketCap: d?.usd_market_cap ?? 0,
      change24h: d?.usd_24h_change ?? 0,
    };
  }

  /** Get batch prices for multiple tokens */
  async getBatchPrices(ids: string[]): Promise<Record<string, { price: number; volume24h: number; marketCap: number }>> {
    const data = await this.fetch<Record<string, { usd: number; usd_24h_vol: number; usd_market_cap: number }>>(
      "/simple/price",
      { ids: ids.join(","), vs_currencies: "usd", include_24hr_vol: "true", include_market_cap: "true" }
    );

    const result: Record<string, { price: number; volume24h: number; marketCap: number }> = {};
    for (const [id, d] of Object.entries(data)) {
      result[id] = { price: d.usd, volume24h: d.usd_24h_vol, marketCap: d.usd_market_cap };
    }
    return result;
  }

  /** Historical price data */
  async getPriceHistory(id: string, days: number | "max", interval?: "daily"): Promise<PricePoint[]> {
    const data = await this.fetch<{ prices: [number, number][]; total_volumes: [number, number][]; market_caps: [number, number][] }>(
      `/coins/${id}/market_chart`,
      { vs_currency: "usd", days: String(days), ...(interval ? { interval } : {}) }
    );

    return data.prices.map(([ts, price], i) => ({
      timestamp: ts,
      price,
      volume: data.total_volumes[i]?.[1],
      marketCap: data.market_caps[i]?.[1],
    }));
  }

  /** OHLCV candle data */
  async getOHLCV(id: string, days: number): Promise<OHLCV[]> {
    const data = await this.fetch<[number, number, number, number, number][]>(
      `/coins/${id}/ohlc`,
      { vs_currency: "usd", days: String(days) }
    );

    return data.map(([ts, open, high, low, close]) => ({
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume: 0, // OHLC endpoint doesn't include volume
    }));
  }

  /** Search for a token */
  async search(query: string): Promise<Array<{ id: string; name: string; symbol: string }>> {
    const data = await this.fetch<{ coins: Array<{ id: string; name: string; symbol: string }> }>(
      "/search",
      { query }
    );
    return data.coins;
  }
}

/** Singleton for the default client (uses env var for API key) */
let _defaultClient: CoinGeckoClient | null = null;
export function getCoingeckoClient(): CoinGeckoClient {
  if (!_defaultClient) {
    _defaultClient = new CoinGeckoClient(process.env.COINGECKO_API_KEY);
  }
  return _defaultClient;
}
