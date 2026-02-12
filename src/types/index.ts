// ── Token Types ──────────────────────────────────────────────────────────────

export type TokenCategory = "metadao" | "vc-backed" | "community";
export type Chain = "solana";

export interface Token {
  id: string;
  name: string;
  symbol: string;
  mintAddress: string;
  chain: Chain;
  category: TokenCategory;
  coingeckoId?: string;
  logoUrl?: string;
}

export interface TokenMetadata extends Token {
  launchDate?: string;
  totalSupply?: number;
  circulatingSupply?: number;
  vcBackers?: string[];
  teamAllocationPct?: number;
  investorAllocationPct?: number;
  communityAllocationPct?: number;
  description?: string;
}

// ── Price Types ──────────────────────────────────────────────────────────────

export type PriceSource = "coingecko" | "defillama" | "codex";

export interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
  marketCap?: number;
}

export interface PriceHistory {
  tokenId: string;
  source: PriceSource;
  points: PricePoint[];
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Holder Types ─────────────────────────────────────────────────────────────

export type WalletCategory = "whale" | "shark" | "dolphin" | "fish";

export interface WalletBalance {
  address: string;
  balance: number;
  percentOfSupply: number;
  firstSeen?: number;
  category?: WalletCategory;
}

export interface HolderSnapshot {
  tokenId: string;
  timestamp: number;
  totalHolders: number;
  topHolders: WalletBalance[];
}

export interface HolderChange {
  tokenId: string;
  period: string;
  newHolders: number;
  lostHolders: number;
  netChange: number;
  percentChange: number;
}

export type HolderBehavior =
  | "diamond_hands"
  | "accumulator"
  | "distributor"
  | "flipper"
  | "new_entrant"
  | "exited";

// ── Metrics Types ────────────────────────────────────────────────────────────

export interface DistributionMetrics {
  tokenId: string;
  timestamp: number;
  giniCoefficient: number;
  hhi: number;
  nakamotoCoefficient: number;
  palmaRatio: number;
  shannonEntropy: number;
  top1Percent: number;
  top10Percent: number;
  medianHolding: number;
}

export interface BehaviorMetrics {
  tokenId: string;
  timestamp: number;
  diamondHands: number;
  accumulators: number;
  distributors: number;
  flippers: number;
  avgHoldTimeDays: number;
}

export interface ComparisonResult {
  metadaoToken: Token;
  vcToken: Token;
  metrics: Record<
    string,
    { metadao: number; vc: number; delta: number; label: string }
  >;
}

// ── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  source: PriceSource;
  fetchedAt: string;
  cached: boolean;
}

export interface TimeseriesData<T> {
  tokenId: string;
  start: number;
  end: number;
  interval: "hourly" | "daily" | "weekly";
  points: T[];
}

export interface HolderBuckets {
  whale: number;
  shark: number;
  dolphin: number;
  fish: number;
}

export interface DecentralizationScore {
  overall: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  components: {
    nakamoto: number;
    gini: number;
    entropy: number;
    hhi: number;
    holderGrowth: number;
    stability: number;
  };
}
