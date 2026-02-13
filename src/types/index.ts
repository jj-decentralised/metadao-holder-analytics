// ── Token Types ──────────────────────────────────────────────────────────────

export type TokenCategory = "metadao" | "metadao-ico" | "futarchy-dao" | "vc-backed" | "community";
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
  futarchyUsage?: string;
  defillamaSlug?: string;
  tokenTerminalId?: string;
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

/** Codex getBars response bar */
export interface CodexBar {
  t: number; // Unix timestamp
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  c: string; // Close price
  v: string; // Volume
  buyVolume?: string;
  sellVolume?: string;
  buyers?: number;
  sellers?: number;
  transactions?: number;
  liquidity?: string;
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

// ── Trading Metrics ──────────────────────────────────────────────────────────

export interface TradingMetrics {
  volume24h: number;
  buyVolume24h: number;
  sellVolume24h: number;
  txnCount24h: number;
  liquidity: number;
  buyPressure: number; // buyVolume / totalVolume ratio
}

// ── Time Series Types ────────────────────────────────────────────────────────

export interface HolderTimeSeriesSnapshot {
  timestamp: number;
  totalHolders: number;
  gini: number;
  top10Pct: number;
  whaleCount: number;
}

export interface HolderTimeSeries {
  tokenId: string;
  snapshots: HolderTimeSeriesSnapshot[];
}

// ── Whale Movement Types ─────────────────────────────────────────────────────

export type WhaleMoveType = "accumulate" | "distribute";

export interface WhaleMoveEvent {
  address: string;
  tokenId: string;
  timestamp: number;
  type: WhaleMoveType;
  amount: number;
  percentOfSupply: number;
}

// ── Revenue Types ────────────────────────────────────────────────────────────

export interface RevenueDataPoint {
  timestamp: number;
  revenue: number;
  fees: number;
  protocolRevenue?: number;
}

export interface RevenueMetrics {
  tokenId: string;
  dailyRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
  dailyFees: number;
  revenueGrowth30d: number; // percentage
  revenuePerHolder?: number;
  timeSeries: RevenueDataPoint[];
}

// ── Holder Persona Types ─────────────────────────────────────────────────────

export type HolderPersona =
  | "diamond_hands"  // >365d hold, <10% balance change
  | "hodler"         // >180d hold, <20% balance change
  | "accumulator"    // increasing balance over time
  | "trader"         // <7d avg hold time
  | "whale_accumulator" // >1% supply + accumulating
  | "whale_distributor" // >1% supply + decreasing
  | "paper_hands"    // <30d hold time
  | "smart_money"    // positive PnL
  | "new_entrant"    // first seen <30d ago
  | "inactive";      // no activity >90d

export interface PersonaDistribution {
  tokenId: string;
  timestamp: number;
  personas: Record<HolderPersona, number>;
  totalClassified: number;
}

export interface HolderDurationStats {
  tokenId: string;
  avgDays: number;
  medianDays: number;
  p90Days: number;
  minDays: number;
  maxDays: number;
  /** Percentage of holders who held >180 days */
  longTermPct: number;
  /** Percentage of holders who held <7 days */
  shortTermPct: number;
}

// ── Econometric Types ────────────────────────────────────────────────────────

export interface RegressionCoefficient {
  variable: string;
  estimate: number;
  standardError: number;
  tStatistic: number;
  pValue: number;
}

export interface RegressionResult {
  dependent: string;
  coefficients: RegressionCoefficient[];
  rSquared: number;
  adjustedRSquared: number;
  fStatistic: number;
  fPValue: number;
  n: number;
  residuals: number[];
}

export interface StatisticalTest {
  testName: string;
  statistic: number;
  pValue: number;
  significant: boolean; // at α=0.05
  groups: string[];
  description: string;
}

export interface SurvivalPoint {
  time: number; // days
  survivalRate: number; // 0-1
  atRisk: number;
  events: number;
}

export interface SurvivalCurve {
  category: string;
  points: SurvivalPoint[];
  medianSurvival: number | null; // days, null if >50% still surviving
}

export interface MarkovTransitionMatrix {
  states: string[]; // ["fish", "dolphin", "shark", "whale"]
  matrix: number[][]; // transition probabilities
  steadyState: number[]; // long-run distribution
}

export interface EconometricSummary {
  regressions: RegressionResult[];
  tests: StatisticalTest[];
  survivalCurves: SurvivalCurve[];
  transitionMatrix: MarkovTransitionMatrix;
  bootstrapCIs: Array<{
    metric: string;
    category: string;
    mean: number;
    ci95Lower: number;
    ci95Upper: number;
  }>;
}
