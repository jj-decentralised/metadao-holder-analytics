import { RateLimiter, withRetry } from "./rate-limiter";

const CODEX_URL = "https://graph.codex.io/graphql";

interface CodexTokenHolder {
  address: string;
  balance: string;
  percentOwned: number;
}

interface CodexTokenInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
}

export class CodexClient {
  private limiter = new RateLimiter(30, 0.5); // Conservative rate limit
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CODEX_API_KEY || "";
  }

  private async query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
    await this.limiter.acquire();

    return withRetry(async () => {
      const res = await fetch(CODEX_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.apiKey,
        },
        body: JSON.stringify({ query: gql, variables }),
      });

      if (!res.ok) {
        const err = new Error(`Codex ${res.status}: ${res.statusText}`) as Error & { status: number };
        err.status = res.status;
        throw err;
      }

      const json = await res.json() as { data: T; errors?: Array<{ message: string }> };
      if (json.errors?.length) {
        throw new Error(`Codex GraphQL: ${json.errors[0].message}`);
      }
      return json.data;
    });
  }

  /** Get token info including holder count */
  async getTokenInfo(address: string, networkId = 1399811149): Promise<CodexTokenInfo | null> {
    const data = await this.query<{ token: CodexTokenInfo }>(
      `query($address: String!, $networkId: Int!) {
        token(input: { address: $address, networkId: $networkId }) {
          address
          name
          symbol
          totalSupply
          holderCount
        }
      }`,
      { address, networkId }
    );
    return data.token ?? null;
  }

  /** Get top holders for a token */
  async getTopHolders(address: string, limit = 100, networkId = 1399811149): Promise<CodexTokenHolder[]> {
    const data = await this.query<{ tokenHolders: { items: CodexTokenHolder[] } }>(
      `query($address: String!, $networkId: Int!, $limit: Int) {
        tokenHolders(input: { tokenAddress: $address, networkId: $networkId, limit: $limit }) {
          items {
            address
            balance
            percentOwned
          }
        }
      }`,
      { address, networkId, limit }
    );
    return data.tokenHolders?.items ?? [];
  }

  /** Get holder count (simple) */
  async getHolderCount(address: string, networkId = 1399811149): Promise<number> {
    const info = await this.getTokenInfo(address, networkId);
    return info?.holderCount ?? 0;
  }

  /** Get token pairs/markets */
  async getTokenPairs(address: string, networkId = 1399811149): Promise<Array<{ pairAddress: string; token0: string; token1: string; exchange: string }>> {
    const data = await this.query<{ pairs: { items: Array<{ pairAddress: string; token0: string; token1: string; exchange: string }> } }>(
      `query($address: String!, $networkId: Int!) {
        pairs(input: { tokenAddress: $address, networkId: $networkId }) {
          items {
            pairAddress
            token0
            token1
            exchange
          }
        }
      }`,
      { address, networkId }
    );
    return data.pairs?.items ?? [];
  }
}

let _defaultClient: CodexClient | null = null;
export function getCodexClient(): CodexClient {
  if (!_defaultClient) {
    _defaultClient = new CodexClient();
  }
  return _defaultClient;
}
