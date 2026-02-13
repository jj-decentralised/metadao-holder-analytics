import { RateLimiter, withRetry } from "./rate-limiter";

const TT_API = "https://api.tokenterminal.com/v2";

// ============================================================================
// Types
// ============================================================================

export interface TTMetricPoint {
  timestamp: string;
  revenue: number;
  fees: number;
  active_users?: number;
  tvl?: number;
  price?: number;
  market_cap?: number;
  token_trading_volume?: number;
}

export interface TTProtocol {
  protocol_id: string;
  name: string;
  category: string;
  chains: string[];
  revenue_30d?: number;
  fees_30d?: number;
  tvl?: number;
}

export interface TTProtocolMetrics {
  protocol_id: string;
  name: string;
  revenue_24h: number;
  revenue_7d: number;
  revenue_30d: number;
  fees_24h: number;
  fees_7d: number;
  fees_30d: number;
  tvl: number;
  active_users_24h: number;
  market_cap: number;
}

// ============================================================================
// Client
// ============================================================================

export class TokenTerminalClient {
  private limiter = new RateLimiter(10, 0.2); // Conservative: 10 tokens, 0.2/s refill
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TOKENTERMINAL_API_KEY || "";
  }

  private async fetch<T>(path: string): Promise<T> {
    await this.limiter.acquire();

    return withRetry(async () => {
      const res = await fetch(`${TT_API}${path}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!res.ok) {
        const err = new Error(`TokenTerminal ${res.status}: ${res.statusText}`) as Error & { status: number };
        err.status = res.status;
        throw err;
      }

      return res.json() as Promise<T>;
    });
  }

  /**
   * Get protocol metrics summary (revenue, fees, TVL, etc.).
   */
  async getProtocolMetrics(protocolId: string): Promise<TTProtocolMetrics | null> {
    try {
      const data = await this.fetch<{ data: TTProtocolMetrics }>(
        `/protocols/${protocolId}`
      );
      return data.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get time series data for a protocol metric.
   * @param protocolId - TokenTerminal protocol ID
   * @param metric - Metric name: "revenue", "fees", "active_users", "tvl"
   * @param granularity - "daily" | "weekly" | "monthly"
   */
  async getProtocolTimeSeries(
    protocolId: string,
    metric: "revenue" | "fees" | "active_users" | "tvl" = "revenue",
    granularity: "daily" | "weekly" | "monthly" = "daily"
  ): Promise<TTMetricPoint[]> {
    try {
      const data = await this.fetch<{ data: TTMetricPoint[] }>(
        `/protocols/${protocolId}/metric/${metric}?granularity=${granularity}`
      );
      return data.data ?? [];
    } catch {
      return [];
    }
  }

  /**
   * List all available protocols.
   */
  async listProtocols(): Promise<TTProtocol[]> {
    try {
      const data = await this.fetch<{ data: TTProtocol[] }>("/protocols");
      return data.data ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Get protocols filtered by chain.
   */
  async getProtocolsByChain(chain: string): Promise<TTProtocol[]> {
    const all = await this.listProtocols();
    return all.filter((p) =>
      p.chains?.some((c) => c.toLowerCase() === chain.toLowerCase())
    );
  }
}

// ============================================================================
// Default Client
// ============================================================================

let _defaultClient: TokenTerminalClient | null = null;

export function getTokenTerminalClient(): TokenTerminalClient {
  if (!_defaultClient) {
    _defaultClient = new TokenTerminalClient();
  }
  return _defaultClient;
}
