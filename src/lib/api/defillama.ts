import type { PricePoint } from "@/types";
import { RateLimiter, withRetry } from "./rate-limiter";

const LLAMA_API = "https://api.llama.fi";
const COINS_API = "https://coins.llama.fi";

export class DeFiLlamaClient {
  private limiter = new RateLimiter(60, 1); // ~60 req/min

  private async fetch<T>(url: string): Promise<T> {
    await this.limiter.acquire();

    return withRetry(async () => {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        const err = new Error(`DeFiLlama ${res.status}: ${res.statusText}`) as Error & { status: number };
        err.status = res.status;
        throw err;
      }
      return res.json() as Promise<T>;
    });
  }

  /** Get current price for a Solana token by mint address */
  async getTokenPrice(mintAddress: string): Promise<{ price: number; timestamp: number; confidence: number } | null> {
    const key = `solana:${mintAddress}`;
    const data = await this.fetch<{ coins: Record<string, { price: number; timestamp: number; confidence: number }> }>(
      `${COINS_API}/prices/current/${key}`
    );
    return data.coins[key] ?? null;
  }

  /** Batch price lookup for multiple tokens */
  async getBatchPrices(mintAddresses: string[]): Promise<Record<string, { price: number; timestamp: number }>> {
    const keys = mintAddresses.map((a) => `solana:${a}`).join(",");
    const data = await this.fetch<{ coins: Record<string, { price: number; timestamp: number }> }>(
      `${COINS_API}/prices/current/${keys}`
    );

    const result: Record<string, { price: number; timestamp: number }> = {};
    for (const [key, val] of Object.entries(data.coins)) {
      const addr = key.replace("solana:", "");
      result[addr] = val;
    }
    return result;
  }

  /** Historical price chart for a token */
  async getPriceHistory(mintAddress: string, start?: number, span?: number): Promise<PricePoint[]> {
    const key = `solana:${mintAddress}`;
    let url = `${COINS_API}/chart/${key}`;
    const params: string[] = [];
    if (start) params.push(`start=${start}`);
    if (span) params.push(`span=${span}`);
    if (params.length) url += `?${params.join("&")}`;

    const data = await this.fetch<{ coins: Record<string, { prices: Array<{ timestamp: number; price: number }> }> }>(url);
    const tokenData = data.coins[key];
    if (!tokenData) return [];

    return tokenData.prices.map((p) => ({
      timestamp: p.timestamp * 1000, // Convert to ms
      price: p.price,
    }));
  }

  /** Get protocol info (TVL, etc.) */
  async getProtocol(slug: string): Promise<{
    name: string;
    tvl: number;
    chainTvls: Record<string, number>;
    raises?: Array<{ amount: number; round: string; date: number }>;
  } | null> {
    try {
      return await this.fetch(`${LLAMA_API}/protocol/${slug}`);
    } catch {
      return null;
    }
  }

  /** List all protocols (use sparingly, large response) */
  async listProtocols(): Promise<Array<{ name: string; slug: string; tvl: number; chain: string }>> {
    return this.fetch(`${LLAMA_API}/protocols`);
  }

  // ========================================================================
  // Fees & Revenue
  // ========================================================================

  /** Get fees overview, optionally filtered by chain */
  async getFeesOverview(chain?: string): Promise<{
    totalDataChart: Array<[number, number]>;
    protocols: Array<{
      name: string;
      slug: string;
      total24h: number;
      total7d: number;
      total30d: number;
      change_1d: number;
    }>;
  }> {
    const url = chain
      ? `${LLAMA_API}/overview/fees?chain=${chain}`
      : `${LLAMA_API}/overview/fees`;
    return this.fetch(url);
  }

  /** Get protocol-level fees summary */
  async getProtocolFees(slug: string): Promise<{
    name: string;
    total24h: number;
    total7d: number;
    total30d: number;
    totalAllTime: number;
    totalDataChart: Array<[number, number]>;
  } | null> {
    try {
      return await this.fetch(`${LLAMA_API}/summary/fees/${slug}`);
    } catch {
      return null;
    }
  }

  /** Get protocol-level revenue summary (protocol revenue = fees - LP share) */
  async getProtocolRevenue(slug: string): Promise<{
    name: string;
    total24h: number;
    total7d: number;
    total30d: number;
    totalAllTime: number;
    totalDataChart: Array<[number, number]>;
  } | null> {
    try {
      return await this.fetch(`${LLAMA_API}/summary/revenue/${slug}`);
    } catch {
      return null;
    }
  }

  /** Get revenue overview for a chain */
  async getRevenueOverview(chain?: string): Promise<{
    totalDataChart: Array<[number, number]>;
    protocols: Array<{
      name: string;
      slug: string;
      total24h: number;
      total7d: number;
      total30d: number;
    }>;
  }> {
    const url = chain
      ? `${LLAMA_API}/overview/revenue?chain=${chain}`
      : `${LLAMA_API}/overview/revenue`;
    return this.fetch(url);
  }
}

let _defaultClient: DeFiLlamaClient | null = null;
export function getDefillamaClient(): DeFiLlamaClient {
  if (!_defaultClient) {
    _defaultClient = new DeFiLlamaClient();
  }
  return _defaultClient;
}
