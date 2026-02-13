import { RateLimiter, withRetry } from "./rate-limiter";

export const CODEX_URL = "https://graph.codex.io/graphql";
export const SOLANA_NETWORK_ID = 1399811149;

// ============================================================================
// Types
// ============================================================================

export interface CodexTokenInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
  decimals: number;
  createdAt: number | null;
  creatorAddress: string | null;
}

export interface CodexTokenHolder {
  address: string;
  balance: string;
  percentOwned: number;
}

export interface CodexHoldersResponse {
  count: number;
  items: CodexTokenHolder[];
  cursor: string | null;
}

export interface CodexBar {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  t: number[];
  volume: number[];
  s: string;
}

export interface CodexTokenPrice {
  address: string;
  networkId: number;
  priceUsd: number;
  timestamp: number;
}

export interface CodexTokenEvent {
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  maker: string;
  priceUsd: number;
  labels: string[];
}

export interface CodexFilteredToken {
  address: string;
  networkId: number;
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
  liquidity: number;
  volume24: number;
  priceUsd: number;
  createdAt: number | null;
}

export interface CodexFilteredPair {
  pairAddress: string;
  networkId: number;
  token0: string;
  token1: string;
  exchange: string;
  liquidity: number;
  volume24: number;
  priceUsd: number;
}

export interface CodexDetailedPairStats {
  pairAddress: string;
  networkId: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  buys: number;
  sells: number;
  buyers: number;
  sellers: number;
  liquidity: number;
  priceChange: number;
}

export interface CodexPairWithMetadata {
  pairAddress: string;
  networkId: number;
  token0: string;
  token1: string;
  exchange: string;
  liquidity: number;
  volume24: number;
  fee: number | null;
}

export interface CodexSparkline {
  address: string;
  networkId: number;
  sparkline: number[];
}

export interface CodexWalletStats {
  walletAddress: string;
  networkId: number;
  totalTokens: number;
  totalValueUsd: number;
  pnlUsd: number;
  pnlPercent: number;
}

export interface TokenInput {
  address: string;
  networkId?: number;
}

export interface PriceInput {
  address: string;
  networkId?: number;
  timestamp?: number;
}

export type BarResolution = "1" | "5" | "15" | "30" | "60" | "240" | "720" | "1D" | "7D";
export type SymbolType = "POOL" | "TOKEN";

export interface TokenFilters {
  network?: number[];
  buyVolume24?: { gte?: number; lte?: number };
  sellVolume24?: { gte?: number; lte?: number };
  holders?: { gte?: number; lte?: number };
  liquidity?: { gte?: number; lte?: number };
  createdAt?: { gte?: number; lte?: number };
  volume24?: { gte?: number; lte?: number };
  priceUsd?: { gte?: number; lte?: number };
}

export interface PairFilters {
  tokenAddress?: string;
  network?: number[];
  volume24?: { gte?: number; lte?: number };
  liquidity?: { gte?: number; lte?: number };
  exchange?: string[];
}

export interface WalletFilters {
  tokenAddress: string;
  networkId?: number;
  balance?: { gte?: number; lte?: number };
  percentOwned?: { gte?: number; lte?: number };
}

export interface Ranking {
  attribute: string;
  direction: "ASC" | "DESC";
}

// ============================================================================
// Client
// ============================================================================

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

      const json = (await res.json()) as { data: T; errors?: Array<{ message: string }> };
      if (json.errors?.length) {
        throw new Error(`Codex GraphQL: ${json.errors[0].message}`);
      }
      return json.data;
    });
  }

  // ==========================================================================
  // Token Info
  // ==========================================================================

  /**
   * Get detailed token information including holder count, decimals, and creator.
   * @param address - Token contract address
   * @param networkId - Network ID (defaults to Solana)
   * @returns Token info or null if not found
   */
  async getTokenInfo(address: string, networkId = SOLANA_NETWORK_ID): Promise<CodexTokenInfo | null> {
    const data = await this.query<{ token: CodexTokenInfo | null }>(
      `query($address: String!, $networkId: Int!) {
        token(input: { address: $address, networkId: $networkId }) {
          address
          name
          symbol
          totalSupply
          holderCount
          decimals
          createdAt
          creatorAddress
        }
      }`,
      { address, networkId }
    );
    return data.token ?? null;
  }

  /**
   * Batch fetch multiple tokens (max 100).
   * @param tokens - Array of token inputs with address and optional networkId
   * @returns Array of token info (null for tokens not found)
   */
  async getTokensBatch(tokens: TokenInput[]): Promise<(CodexTokenInfo | null)[]> {
    const inputs = tokens.map((t) => ({
      address: t.address,
      networkId: t.networkId ?? SOLANA_NETWORK_ID,
    }));

    const data = await this.query<{ tokens: (CodexTokenInfo | null)[] }>(
      `query($inputs: [TokenInput!]!) {
        tokens(inputs: $inputs) {
          address
          name
          symbol
          totalSupply
          holderCount
          decimals
          createdAt
          creatorAddress
        }
      }`,
      { inputs }
    );
    return data.tokens ?? [];
  }

  // ==========================================================================
  // Holders
  // ==========================================================================

  /**
   * Get token holders with pagination support.
   * @param tokenAddress - Token contract address
   * @param networkId - Network ID (defaults to Solana)
   * @param limit - Max number of holders to return
   * @param cursor - Pagination cursor from previous response
   * @returns Holders response with count, items, and cursor
   */
  async getHolders(
    tokenAddress: string,
    networkId = SOLANA_NETWORK_ID,
    limit = 100,
    cursor?: string
  ): Promise<CodexHoldersResponse> {
    const data = await this.query<{ holders: CodexHoldersResponse }>(
      `query($tokenAddress: String!, $networkId: Int!, $limit: Int, $cursor: String) {
        holders(input: { tokenAddress: $tokenAddress, networkId: $networkId, limit: $limit, cursor: $cursor }) {
          count
          items {
            address
            balance
            percentOwned
          }
          cursor
        }
      }`,
      { tokenAddress, networkId, limit, cursor }
    );
    return data.holders ?? { count: 0, items: [], cursor: null };
  }

  /**
   * Get holder count for a token.
   * @param address - Token contract address
   * @param networkId - Network ID (defaults to Solana)
   * @returns Number of holders
   */
  async getHolderCount(address: string, networkId = SOLANA_NETWORK_ID): Promise<number> {
    const info = await this.getTokenInfo(address, networkId);
    return info?.holderCount ?? 0;
  }

  // ==========================================================================
  // Price Data
  // ==========================================================================

  /**
   * Get OHLCV bar data for charting.
   * @param symbol - Symbol in format "address:networkId"
   * @param from - Start timestamp (seconds)
   * @param to - End timestamp (seconds)
   * @param resolution - Bar resolution (1, 5, 15, 30, 60, 240, 720, 1D, 7D)
   * @param opts - Optional parameters (symbolType: POOL or TOKEN)
   * @returns OHLCV bar data
   */
  async getBars(
    symbol: string,
    from: number,
    to: number,
    resolution: BarResolution,
    opts?: { symbolType?: SymbolType }
  ): Promise<CodexBar> {
    const data = await this.query<{ getBars: CodexBar }>(
      `query($symbol: String!, $from: Int!, $to: Int!, $resolution: String!, $symbolType: SymbolType) {
        getBars(symbol: $symbol, from: $from, to: $to, resolution: $resolution, symbolType: $symbolType) {
          o
          h
          l
          c
          t
          volume
          s
        }
      }`,
      { symbol, from, to, resolution, symbolType: opts?.symbolType }
    );
    return data.getBars ?? { o: [], h: [], l: [], c: [], t: [], volume: [], s: "no_data" };
  }

  /**
   * Get current or historical token price.
   * @param address - Token contract address
   * @param networkId - Network ID (defaults to Solana)
   * @param timestamp - Optional timestamp for historical price
   * @returns Token price info
   */
  async getTokenPrice(
    address: string,
    networkId = SOLANA_NETWORK_ID,
    timestamp?: number
  ): Promise<CodexTokenPrice | null> {
    const inputs = [{ address, networkId, timestamp }];
    const data = await this.query<{ getTokenPrices: (CodexTokenPrice | null)[] }>(
      `query($inputs: [GetPriceInput!]!) {
        getTokenPrices(inputs: $inputs) {
          address
          networkId
          priceUsd
          timestamp
        }
      }`,
      { inputs }
    );
    return data.getTokenPrices?.[0] ?? null;
  }

  /**
   * Batch fetch token prices (current or historical).
   * @param inputs - Array of price inputs with address, networkId, and optional timestamp
   * @returns Array of token prices (null for tokens not found)
   */
  async getTokenPricesBatch(inputs: PriceInput[]): Promise<(CodexTokenPrice | null)[]> {
    const priceInputs = inputs.map((i) => ({
      address: i.address,
      networkId: i.networkId ?? SOLANA_NETWORK_ID,
      timestamp: i.timestamp,
    }));

    const data = await this.query<{ getTokenPrices: (CodexTokenPrice | null)[] }>(
      `query($inputs: [GetPriceInput!]!) {
        getTokenPrices(inputs: $inputs) {
          address
          networkId
          priceUsd
          timestamp
        }
      }`,
      { inputs: priceInputs }
    );
    return data.getTokenPrices ?? [];
  }

  /**
   * Get price sparklines for multiple tokens.
   * @param tokens - Array of token inputs
   * @returns Array of sparkline data
   */
  async getTokenSparklines(tokens: TokenInput[]): Promise<CodexSparkline[]> {
    const inputs = tokens.map((t) => ({
      address: t.address,
      networkId: t.networkId ?? SOLANA_NETWORK_ID,
    }));

    const data = await this.query<{ tokenSparklines: CodexSparkline[] }>(
      `query($inputs: [TokenInput!]!) {
        tokenSparklines(inputs: $inputs) {
          address
          networkId
          sparkline
        }
      }`,
      { inputs }
    );
    return data.tokenSparklines ?? [];
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Get token trading events (swaps, transfers, etc.).
   * @param address - Token contract address
   * @param networkId - Network ID (defaults to Solana)
   * @param from - Start timestamp (seconds)
   * @param to - End timestamp (seconds)
   * @param limit - Max number of events to return
   * @returns Array of token events
   */
  async getTokenEvents(
    address: string,
    networkId = SOLANA_NETWORK_ID,
    from?: number,
    to?: number,
    limit = 100
  ): Promise<CodexTokenEvent[]> {
    const data = await this.query<{ getTokenEvents: { items: CodexTokenEvent[] } }>(
      `query($address: String!, $networkId: Int!, $from: Int, $to: Int, $limit: Int) {
        getTokenEvents(input: { address: $address, networkId: $networkId, from: $from, to: $to, limit: $limit }) {
          items {
            timestamp
            blockNumber
            transactionHash
            maker
            priceUsd
            labels
          }
        }
      }`,
      { address, networkId, from, to, limit }
    );
    return data.getTokenEvents?.items ?? [];
  }

  /**
   * Get all token events for a specific wallet (maker).
   * Used for holder duration analysis — traces a wallet's buy/sell history.
   * @param address - Token contract address
   * @param maker - Wallet address to filter events for
   * @param networkId - Network ID (defaults to Solana)
   * @param from - Start timestamp (seconds)
   * @param to - End timestamp (seconds)
   * @param limit - Max number of events
   * @returns Array of events for the specified maker
   */
  async getTokenEventsForMaker(
    address: string,
    maker: string,
    networkId = SOLANA_NETWORK_ID,
    from?: number,
    to?: number,
    limit = 500
  ): Promise<CodexTokenEvent[]> {
    const data = await this.query<{ getTokenEvents: { items: CodexTokenEvent[] } }>(
      `query($address: String!, $networkId: Int!, $maker: String!, $from: Int, $to: Int, $limit: Int) {
        getTokenEvents(input: { address: $address, networkId: $networkId, maker: $maker, from: $from, to: $to, limit: $limit }) {
          items {
            timestamp
            blockNumber
            transactionHash
            maker
            priceUsd
            labels
          }
        }
      }`,
      { address, networkId, maker, from, to, limit }
    );
    return data.getTokenEvents?.items ?? [];
  }

  // ==========================================================================
  // Discovery / Filtering
  // ==========================================================================

  /**
   * Filter and discover tokens based on various criteria.
   * @param filters - Filter criteria (network, volume, holders, liquidity, etc.)
   * @param rankings - Sort order
   * @param limit - Max number of results
   * @returns Array of filtered tokens
   */
  async filterTokens(
    filters?: TokenFilters,
    rankings?: Ranking[],
    limit = 100
  ): Promise<CodexFilteredToken[]> {
    const data = await this.query<{ filterTokens: { results: CodexFilteredToken[] } }>(
      `query($filters: TokenFilters, $rankings: [TokenRanking!], $limit: Int) {
        filterTokens(filters: $filters, rankings: $rankings, limit: $limit) {
          results {
            address
            networkId
            name
            symbol
            totalSupply
            holderCount
            liquidity
            volume24
            priceUsd
            createdAt
          }
        }
      }`,
      { filters, rankings, limit }
    );
    return data.filterTokens?.results ?? [];
  }

  /**
   * Filter and discover trading pairs based on various criteria.
   * @param filters - Filter criteria (tokenAddress, network, volume, liquidity, exchange)
   * @param rankings - Sort order
   * @param limit - Max number of results
   * @returns Array of filtered pairs
   */
  async filterPairs(
    filters?: PairFilters,
    rankings?: Ranking[],
    limit = 100
  ): Promise<CodexFilteredPair[]> {
    const data = await this.query<{ filterPairs: { results: CodexFilteredPair[] } }>(
      `query($filters: PairFilters, $rankings: [PairRanking!], $limit: Int) {
        filterPairs(filters: $filters, rankings: $rankings, limit: $limit) {
          results {
            pairAddress
            networkId
            token0
            token1
            exchange
            liquidity
            volume24
            priceUsd
          }
        }
      }`,
      { filters, rankings, limit }
    );
    return data.filterPairs?.results ?? [];
  }

  /**
   * Filter wallets holding a specific token.
   * @param filters - Filter criteria (tokenAddress, balance, percentOwned)
   * @param rankings - Sort order
   * @returns Array of wallet addresses with balances
   */
  async filterTokenWallets(
    filters: WalletFilters,
    rankings?: Ranking[]
  ): Promise<CodexTokenHolder[]> {
    const input = {
      tokenAddress: filters.tokenAddress,
      networkId: filters.networkId ?? SOLANA_NETWORK_ID,
      balance: filters.balance,
      percentOwned: filters.percentOwned,
    };

    const data = await this.query<{ filterTokenWallets: { results: CodexTokenHolder[] } }>(
      `query($input: FilterTokenWalletsInput!, $rankings: [WalletRanking!]) {
        filterTokenWallets(input: $input, rankings: $rankings) {
          results {
            address
            balance
            percentOwned
          }
        }
      }`,
      { input, rankings }
    );
    return data.filterTokenWallets?.results ?? [];
  }

  // ==========================================================================
  // Pairs
  // ==========================================================================

  /**
   * Get detailed statistics for a trading pair.
   * @param pairAddress - Pair contract address
   * @param networkId - Network ID
   * @param duration - Time duration for stats (seconds)
   * @param bucketCount - Number of time buckets
   * @returns Detailed pair statistics
   */
  async getDetailedPairStats(
    pairAddress: string,
    networkId: number,
    duration?: number,
    bucketCount?: number
  ): Promise<CodexDetailedPairStats | null> {
    const data = await this.query<{ getDetailedPairStats: CodexDetailedPairStats | null }>(
      `query($pairAddress: String!, $networkId: Int!, $duration: Int, $bucketCount: Int) {
        getDetailedPairStats(pairAddress: $pairAddress, networkId: $networkId, duration: $duration, bucketCount: $bucketCount) {
          pairAddress
          networkId
          volume
          buyVolume
          sellVolume
          buys
          sells
          buyers
          sellers
          liquidity
          priceChange
        }
      }`,
      { pairAddress, networkId, duration, bucketCount }
    );
    return data.getDetailedPairStats ?? null;
  }

  /**
   * List all trading pairs for a token with metadata.
   * @param tokenAddress - Token contract address
   * @param networkId - Network ID (defaults to Solana)
   * @returns Array of pairs with metadata
   */
  async listPairsForToken(
    tokenAddress: string,
    networkId = SOLANA_NETWORK_ID
  ): Promise<CodexPairWithMetadata[]> {
    const data = await this.query<{ listPairsWithMetadataForToken: { results: CodexPairWithMetadata[] } }>(
      `query($tokenAddress: String!, $networkId: Int!) {
        listPairsWithMetadataForToken(tokenAddress: $tokenAddress, networkId: $networkId) {
          results {
            pairAddress
            networkId
            token0
            token1
            exchange
            liquidity
            volume24
            fee
          }
        }
      }`,
      { tokenAddress, networkId }
    );
    return data.listPairsWithMetadataForToken?.results ?? [];
  }

  // ==========================================================================
  // Wallet
  // ==========================================================================

  /**
   * Get detailed wallet statistics.
   * @param walletAddress - Wallet address
   * @param networkId - Network ID (defaults to Solana)
   * @returns Wallet statistics
   */
  async getWalletStats(
    walletAddress: string,
    networkId = SOLANA_NETWORK_ID
  ): Promise<CodexWalletStats | null> {
    const data = await this.query<{ detailedWalletStats: CodexWalletStats | null }>(
      `query($walletAddress: String!, $networkId: Int!) {
        detailedWalletStats(walletAddress: $walletAddress, networkId: $networkId) {
          walletAddress
          networkId
          totalTokens
          totalValueUsd
          pnlUsd
          pnlPercent
        }
      }`,
      { walletAddress, networkId }
    );
    return data.detailedWalletStats ?? null;
  }
}

// ============================================================================
// Default Client
// ============================================================================

let _defaultClient: CodexClient | null = null;

/**
 * Get the default Codex client instance.
 * @returns CodexClient singleton
 */
export function getCodexClient(): CodexClient {
  if (!_defaultClient) {
    _defaultClient = new CodexClient();
  }
  return _defaultClient;
}
