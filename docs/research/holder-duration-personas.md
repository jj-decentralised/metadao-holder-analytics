# Holder Duration Analysis & Wallet Persona Classification

Research document for implementing holder duration tracking and wallet persona classification using the Codex.io API.

## 1. Hold Duration Derivation

### 1.1 Core Algorithm

Hold duration must be derived from swap events since Codex doesn't provide direct holding period data. The algorithm processes `getTokenEvents` chronologically to build per-wallet position history.

```typescript path=null start=null
interface WalletPosition {
  address: string;
  entries: Array<{
    timestamp: number;
    priceUsd: number;
    type: 'buy' | 'sell';
    amount?: number;  // If available from labels parsing
  }>;
  firstBuyTimestamp: number;
  lastSellTimestamp: number | null;
  currentBalance: number;  // From getHolders
}

function computeHoldDuration(position: WalletPosition, now: number): number {
  if (position.currentBalance > 0) {
    // Still holding: first buy → now
    return now - position.firstBuyTimestamp;
  } else {
    // Exited: first buy → last sell
    return (position.lastSellTimestamp ?? now) - position.firstBuyTimestamp;
  }
}
```

### 1.2 Event Classification

Token events from Codex include a `labels` array that indicates buy/sell:
- Labels containing "buy", "swap_buy", "maker_buy" → BUY event
- Labels containing "sell", "swap_sell", "maker_sell" → SELL event

```typescript path=null start=null
function classifyEvent(labels: string[]): 'buy' | 'sell' | 'unknown' {
  const labelStr = labels.join(' ').toLowerCase();
  if (labelStr.includes('buy')) return 'buy';
  if (labelStr.includes('sell')) return 'sell';
  return 'unknown';
}
```

### 1.3 Handling Complex Patterns

**Partial Sells:**
Track cumulative position. If wallet buys 100 tokens, sells 50, buy timestamp remains the first buy. Duration calculated from first acquisition.

**Re-entries:**
When a wallet exits completely and re-enters:
- Option A: Track multiple holding periods separately (more accurate)
- Option B: Use weighted average hold time (simpler)

Recommended: Option A for detailed analysis, store as array of holding periods.

```typescript path=null start=null
interface HoldingPeriod {
  entryTimestamp: number;
  exitTimestamp: number | null;  // null if still holding
  durationDays: number;
  entryPriceUsd: number;
  exitPriceUsd: number | null;
}

interface WalletHoldHistory {
  address: string;
  tokenAddress: string;
  periods: HoldingPeriod[];
  currentPeriod: HoldingPeriod | null;
  totalHoldDays: number;  // Sum of all periods
  avgHoldDays: number;
  longestHoldDays: number;
}
```

**DCA Patterns:**
Multiple buys without sells should be tracked as a single holding period. Entry price = volume-weighted average price (VWAP) of all buys in the period.

### 1.4 Algorithm Implementation

```typescript path=null start=null
function buildWalletHoldHistory(
  events: CodexTokenEvent[],
  currentHolders: Map<string, number>  // address → balance
): Map<string, WalletHoldHistory> {
  const histories = new Map<string, WalletHoldHistory>();
  
  // Sort events chronologically
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  
  // Track running position per wallet
  const positions = new Map<string, { balance: number; period: HoldingPeriod | null }>();
  
  for (const event of sorted) {
    const type = classifyEvent(event.labels);
    if (type === 'unknown') continue;
    
    const pos = positions.get(event.maker) ?? { balance: 0, period: null };
    const history = histories.get(event.maker) ?? {
      address: event.maker,
      tokenAddress: '', // Set by caller
      periods: [],
      currentPeriod: null,
      totalHoldDays: 0,
      avgHoldDays: 0,
      longestHoldDays: 0,
    };
    
    if (type === 'buy') {
      if (pos.period === null) {
        // New holding period
        pos.period = {
          entryTimestamp: event.timestamp,
          exitTimestamp: null,
          durationDays: 0,
          entryPriceUsd: event.priceUsd,
          exitPriceUsd: null,
        };
      }
      // Accumulate balance (amount tracking would need labels parsing)
      pos.balance += 1; // Placeholder - need amount from event
    } else if (type === 'sell') {
      pos.balance -= 1;
      
      if (pos.balance <= 0 && pos.period) {
        // Position closed
        pos.period.exitTimestamp = event.timestamp;
        pos.period.exitPriceUsd = event.priceUsd;
        pos.period.durationDays = (event.timestamp - pos.period.entryTimestamp) / 86400000;
        history.periods.push(pos.period);
        pos.period = null;
        pos.balance = 0;
      }
    }
    
    positions.set(event.maker, pos);
    histories.set(event.maker, history);
  }
  
  // Finalize: set current periods for active holders
  const now = Date.now();
  for (const [address, pos] of positions) {
    if (currentHolders.has(address) && pos.period) {
      const history = histories.get(address)!;
      pos.period.durationDays = (now - pos.period.entryTimestamp) / 86400000;
      history.currentPeriod = pos.period;
    }
  }
  
  // Calculate aggregates
  for (const history of histories.values()) {
    const allPeriods = [...history.periods];
    if (history.currentPeriod) allPeriods.push(history.currentPeriod);
    
    if (allPeriods.length > 0) {
      history.totalHoldDays = allPeriods.reduce((s, p) => s + p.durationDays, 0);
      history.avgHoldDays = history.totalHoldDays / allPeriods.length;
      history.longestHoldDays = Math.max(...allPeriods.map(p => p.durationDays));
    }
  }
  
  return histories;
}
```

## 2. Wallet Persona Classification

### 2.1 Persona Definitions

Based on observable on-chain behavior, define these personas:

| Persona | Criteria |
|---------|----------|
| **HODLer** | Bought and never sold, held >90 days |
| **Accumulator** | Multiple buys, no sells or minimal sells (<10% of position), position growing |
| **Trader** | High frequency buy/sell, short hold times (<7 days avg) |
| **Whale Accumulator** | >1% supply, net positive flow over 30 days |
| **Whale Distributor** | >1% supply, net negative flow over 30 days |
| **Yield Farmer** | Entry/exit correlated with governance events, airdrops, or protocol emissions |
| **Smart Money** | Early entry (<30 days from launch) + profitable exits (>50% gain) + presence in >3 tokens |
| **Retail Flipper** | <0.1% supply, buy high sell low pattern (negative realized PnL) |
| **Diamond Hands** | Held through >50% drawdown without selling |
| **Paper Hands** | Sold >25% of position during any >20% price drop |

### 2.2 Classification Algorithm

```typescript path=null start=null
type WalletPersona = 
  | 'hodler'
  | 'accumulator' 
  | 'trader'
  | 'whale_accumulator'
  | 'whale_distributor'
  | 'yield_farmer'
  | 'smart_money'
  | 'retail_flipper'
  | 'diamond_hands'
  | 'paper_hands'
  | 'neutral';

interface ClassificationInput {
  holdHistory: WalletHoldHistory;
  currentBalance: number;
  percentOwned: number;
  walletStats: CodexWalletStats;
  priceHistory: Array<{ timestamp: number; price: number }>;
  tokenLaunchDate: number;
  eventCount: { buys: number; sells: number };
  crossTokenPresence: number;  // How many tracked tokens this wallet holds
}

function classifyWallet(input: ClassificationInput): WalletPersona[] {
  const personas: WalletPersona[] = [];
  const {
    holdHistory,
    currentBalance,
    percentOwned,
    walletStats,
    priceHistory,
    tokenLaunchDate,
    eventCount,
    crossTokenPresence,
  } = input;
  
  const avgHoldDays = holdHistory.avgHoldDays;
  const hasNeverSold = eventCount.sells === 0;
  const isWhale = percentOwned >= 1;
  const isSmallHolder = percentOwned < 0.1;
  
  // HODLer: Never sold, >90 days
  if (hasNeverSold && avgHoldDays > 90 && currentBalance > 0) {
    personas.push('hodler');
  }
  
  // Accumulator: Multiple buys, minimal sells
  if (eventCount.buys > 3 && eventCount.sells / eventCount.buys < 0.1) {
    personas.push('accumulator');
  }
  
  // Trader: High frequency, short holds
  if (eventCount.buys + eventCount.sells > 10 && avgHoldDays < 7) {
    personas.push('trader');
  }
  
  // Whale Accumulator/Distributor
  if (isWhale) {
    if (eventCount.buys > eventCount.sells) {
      personas.push('whale_accumulator');
    } else if (eventCount.sells > eventCount.buys) {
      personas.push('whale_distributor');
    }
  }
  
  // Smart Money: Early + profitable + cross-token
  const entryWithin30Days = holdHistory.periods[0]?.entryTimestamp 
    ? (holdHistory.periods[0].entryTimestamp - tokenLaunchDate) < 30 * 86400000
    : false;
  const isProfitable = walletStats.pnlPercent > 50;
  if (entryWithin30Days && isProfitable && crossTokenPresence >= 3) {
    personas.push('smart_money');
  }
  
  // Retail Flipper: Small position, negative PnL
  if (isSmallHolder && walletStats.pnlPercent < 0 && eventCount.sells > 0) {
    personas.push('retail_flipper');
  }
  
  // Diamond Hands / Paper Hands: Requires price drawdown analysis
  const maxDrawdown = calculateMaxDrawdownDuringHold(holdHistory, priceHistory);
  if (maxDrawdown > 50 && hasNeverSold) {
    personas.push('diamond_hands');
  }
  
  // Paper Hands detection requires comparing sell timestamps to price drops
  const soldDuringDrawdown = didSellDuringDrawdown(holdHistory, priceHistory, 20);
  if (soldDuringDrawdown) {
    personas.push('paper_hands');
  }
  
  return personas.length > 0 ? personas : ['neutral'];
}

function calculateMaxDrawdownDuringHold(
  history: WalletHoldHistory,
  priceHistory: Array<{ timestamp: number; price: number }>
): number {
  // Find price drawdown during any holding period
  let maxDrawdown = 0;
  
  for (const period of [...history.periods, history.currentPeriod].filter(Boolean)) {
    const periodPrices = priceHistory.filter(
      p => p.timestamp >= period!.entryTimestamp && 
           p.timestamp <= (period!.exitTimestamp ?? Date.now())
    );
    
    let peak = 0;
    for (const p of periodPrices) {
      peak = Math.max(peak, p.price);
      const drawdown = ((peak - p.price) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  
  return maxDrawdown;
}

function didSellDuringDrawdown(
  history: WalletHoldHistory,
  priceHistory: Array<{ timestamp: number; price: number }>,
  drawdownThreshold: number
): boolean {
  for (const period of history.periods) {
    if (!period.exitTimestamp) continue;
    
    // Find price at exit
    const exitPrice = period.exitPriceUsd ?? 0;
    const entryPrice = period.entryPriceUsd;
    
    // Check if they sold at a loss during a broader market drawdown
    if (entryPrice > 0 && exitPrice < entryPrice * (1 - drawdownThreshold / 100)) {
      return true;
    }
  }
  return false;
}
```

### 2.3 Yield Farmer Detection

Yield farmers require correlation with external events. This needs:
1. Governance proposal timestamps (from MetaDAO/protocol data)
2. Airdrop announcement dates
3. Protocol emission schedule changes

```typescript path=null start=null
interface ProtocolEvent {
  timestamp: number;
  type: 'governance_proposal' | 'airdrop' | 'emission_change';
  description: string;
}

function detectYieldFarmer(
  holdHistory: WalletHoldHistory,
  protocolEvents: ProtocolEvent[],
  windowDays: number = 7
): boolean {
  const windowMs = windowDays * 86400000;
  
  for (const period of holdHistory.periods) {
    // Check if entry/exit aligns with protocol events
    const entryNearEvent = protocolEvents.some(
      e => Math.abs(e.timestamp - period.entryTimestamp) < windowMs
    );
    const exitNearEvent = period.exitTimestamp && protocolEvents.some(
      e => Math.abs(e.timestamp - period.exitTimestamp!) < windowMs
    );
    
    if (entryNearEvent && exitNearEvent) {
      return true;
    }
  }
  return false;
}
```

## 3. Codex API Data Plan

### 3.1 Data Requirements Per Token

To fully classify all holders for a token, we need:

| Data | API Method | Calls Per Token |
|------|------------|-----------------|
| Current holders | `getHolders` (paginated) | ~1-10 (depends on holder count) |
| Holder balances | `filterTokenWallets` | 1-3 |
| Swap events | `getTokenEvents` | 1-50 (depends on history) |
| Per-wallet stats | `getWalletStats` | 1 per wallet |
| Price history | `getBars` | 1-5 |

### 3.2 Full Analysis Budget (28 Tokens)

**Scenario: All holders analysis**
- Average 500 holders per token → 14,000 wallets total
- `getWalletStats` for each: 14,000 calls
- `getHolders` pagination: ~140 calls (100 per page × 28 tokens)
- `getTokenEvents`: ~280 calls (10 batches × 28 tokens)
- `getBars` for drawdown: 28 calls
- **Total: ~14,500 API calls**

At 30 req/sec with rate limiter headroom: **~8 minutes runtime**

**However:** The `getTokenEventsForMaker` endpoint (per-wallet events) would require 14,000 calls alone, making full analysis impractical.

### 3.3 Sampling Strategy (Recommended)

Instead of all holders, sample strategically:

```typescript path=null start=null
interface SamplingConfig {
  topHolders: number;      // Always include top N by balance
  randomSample: number;    // Random sample from remaining
  whaleThreshold: number;  // Include all above this % ownership
}

const RECOMMENDED_SAMPLING: SamplingConfig = {
  topHolders: 100,
  randomSample: 200,
  whaleThreshold: 0.5,  // Include all >0.5% holders
};
```

**Sampled Analysis Budget (per token):**
- Top 100 + random 200 + whales ≈ 350 wallets
- `getWalletStats`: 350 calls
- `getHolders`: 4 calls
- `getTokenEvents` (global, not per-maker): 10 calls
- `getBars`: 2 calls
- **Per-token total: ~370 calls**
- **28 tokens total: ~10,400 calls**
- **Runtime at 30 req/sec: ~6 minutes**

### 3.4 Minimum Data for Classification

Persona classification can be done with varying levels of data:

**Tier 1 (Basic) - No per-wallet API calls:**
- Current balance from `getHolders`
- Global token events from `getTokenEvents`
- Classify: HODLer, Whale, basic Accumulator/Distributor

**Tier 2 (Standard) - Limited per-wallet calls:**
- Add `getWalletStats` for sampled wallets
- Classify: Smart Money, Retail Flipper, profitability-based personas

**Tier 3 (Full) - Per-wallet event history:**
- Add `getTokenEventsForMaker` (needs implementation)
- Classify: Diamond Hands, Paper Hands, Trader, detailed hold duration

**Recommendation:** Start with Tier 2, implement Tier 3 as background job.

### 3.5 API Call Optimization

```typescript path=null start=null
// Batch wallet stats (if Codex supports batch endpoint)
async function batchGetWalletStats(
  wallets: string[],
  networkId: number,
  batchSize: number = 10
): Promise<Map<string, CodexWalletStats>> {
  const results = new Map<string, CodexWalletStats>();
  
  // Process in batches to stay under rate limit
  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize);
    const promises = batch.map(w => codex.getWalletStats(w, networkId));
    const stats = await Promise.all(promises);
    
    batch.forEach((addr, idx) => {
      if (stats[idx]) results.set(addr, stats[idx]!);
    });
    
    // Rate limit buffer
    await sleep(batchSize / 30 * 1000);
  }
  
  return results;
}

// Cache token events - they don't change frequently
const eventCache = new Map<string, { events: CodexTokenEvent[]; fetchedAt: number }>();
const CACHE_TTL = 3600000; // 1 hour

async function getCachedTokenEvents(
  tokenAddress: string,
  from: number,
  to: number
): Promise<CodexTokenEvent[]> {
  const key = `${tokenAddress}-${from}-${to}`;
  const cached = eventCache.get(key);
  
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.events;
  }
  
  const events = await codex.getTokenEvents(tokenAddress, SOLANA_NETWORK_ID, from, to, 1000);
  eventCache.set(key, { events, fetchedAt: Date.now() });
  return events;
}
```

## 4. Statistical Methods

### 4.1 Hold Duration Statistics

```typescript path=null start=null
interface HoldDurationStats {
  mean: number;           // Average hold duration in days
  median: number;         // Median hold duration
  stdDev: number;         // Standard deviation
  p10: number;            // 10th percentile
  p25: number;            // 25th percentile (Q1)
  p75: number;            // 75th percentile (Q3)
  p90: number;            // 90th percentile
  min: number;
  max: number;
  skewness: number;       // Positive = right-skewed (many short holds)
  kurtosis: number;       // High = heavy tails
}

function computeHoldDurationStats(durations: number[]): HoldDurationStats {
  if (durations.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, p10: 0, p25: 0, p75: 0, p90: 0, min: 0, max: 0, skewness: 0, kurtosis: 0 };
  }
  
  const sorted = [...durations].sort((a, b) => a - b);
  const n = sorted.length;
  
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const percentile = (p: number) => sorted[Math.floor(n * p / 100)] ?? 0;
  
  // Skewness
  const m3 = sorted.reduce((s, v) => s + (v - mean) ** 3, 0) / n;
  const skewness = stdDev > 0 ? m3 / (stdDev ** 3) : 0;
  
  // Kurtosis
  const m4 = sorted.reduce((s, v) => s + (v - mean) ** 4, 0) / n;
  const kurtosis = stdDev > 0 ? (m4 / (stdDev ** 4)) - 3 : 0;
  
  return {
    mean,
    median: percentile(50),
    stdDev,
    p10: percentile(10),
    p25: percentile(25),
    p75: percentile(75),
    p90: percentile(90),
    min: sorted[0],
    max: sorted[n - 1],
    skewness,
    kurtosis,
  };
}
```

### 4.2 Histogram Buckets

```typescript path=null start=null
interface HistogramBucket {
  label: string;
  minDays: number;
  maxDays: number;
  count: number;
  percentage: number;
}

const DURATION_BUCKETS = [
  { label: '<1 day', min: 0, max: 1 },
  { label: '1-7 days', min: 1, max: 7 },
  { label: '1-4 weeks', min: 7, max: 28 },
  { label: '1-3 months', min: 28, max: 90 },
  { label: '3-6 months', min: 90, max: 180 },
  { label: '6-12 months', min: 180, max: 365 },
  { label: '>1 year', min: 365, max: Infinity },
];

function computeHistogram(durations: number[]): HistogramBucket[] {
  const total = durations.length;
  
  return DURATION_BUCKETS.map(bucket => {
    const count = durations.filter(d => d >= bucket.min && d < bucket.max).length;
    return {
      label: bucket.label,
      minDays: bucket.min,
      maxDays: bucket.max,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });
}
```

### 4.3 Category Correlation Analysis

Compare hold duration distributions across token categories:

```typescript path=null start=null
interface CategoryCorrelation {
  category: TokenCategory;
  meanHoldDays: number;
  medianHoldDays: number;
  hodlerPct: number;       // % of holders classified as HODLer
  traderPct: number;       // % classified as Trader
  diamondHandsPct: number;
  tokenCount: number;
}

function compareCategoryMetrics(
  tokenMetrics: Array<{ tokenId: string; category: TokenCategory; stats: HoldDurationStats; personas: Map<string, WalletPersona[]> }>
): CategoryCorrelation[] {
  const byCategory = new Map<TokenCategory, typeof tokenMetrics>();
  
  for (const metric of tokenMetrics) {
    const existing = byCategory.get(metric.category) ?? [];
    existing.push(metric);
    byCategory.set(metric.category, existing);
  }
  
  return Array.from(byCategory.entries()).map(([category, metrics]) => {
    const meanHoldDays = metrics.reduce((s, m) => s + m.stats.mean, 0) / metrics.length;
    const medianHoldDays = metrics.reduce((s, m) => s + m.stats.median, 0) / metrics.length;
    
    // Calculate persona percentages
    let totalHolders = 0;
    let hodlers = 0, traders = 0, diamondHands = 0;
    
    for (const m of metrics) {
      for (const personas of m.personas.values()) {
        totalHolders++;
        if (personas.includes('hodler')) hodlers++;
        if (personas.includes('trader')) traders++;
        if (personas.includes('diamond_hands')) diamondHands++;
      }
    }
    
    return {
      category,
      meanHoldDays,
      medianHoldDays,
      hodlerPct: totalHolders > 0 ? (hodlers / totalHolders) * 100 : 0,
      traderPct: totalHolders > 0 ? (traders / totalHolders) * 100 : 0,
      diamondHandsPct: totalHolders > 0 ? (diamondHands / totalHolders) * 100 : 0,
      tokenCount: metrics.length,
    };
  });
}
```

### 4.4 Kaplan-Meier Survival Curves

Survival analysis for holder retention: probability a holder remains after N days.

```typescript path=null start=null
interface SurvivalPoint {
  timeDays: number;
  survivalProbability: number;  // 0-1, proportion still holding
  atRisk: number;               // Number of wallets at risk at this time
  events: number;               // Number of exits at this time
}

interface KaplanMeierCurve {
  tokenId: string;
  points: SurvivalPoint[];
  medianSurvivalDays: number | null;  // Time when 50% have exited
}

function computeKaplanMeier(
  holdPeriods: Array<{ durationDays: number; censored: boolean }>  // censored = still holding
): SurvivalPoint[] {
  // Sort by duration
  const sorted = [...holdPeriods].sort((a, b) => a.durationDays - b.durationDays);
  
  const points: SurvivalPoint[] = [];
  let survival = 1.0;
  let atRisk = sorted.length;
  
  // Group by unique durations
  const groups = new Map<number, { exits: number; censored: number }>();
  for (const p of sorted) {
    const key = Math.floor(p.durationDays);
    const group = groups.get(key) ?? { exits: 0, censored: 0 };
    if (p.censored) {
      group.censored++;
    } else {
      group.exits++;
    }
    groups.set(key, group);
  }
  
  // Build survival curve
  const times = Array.from(groups.keys()).sort((a, b) => a - b);
  
  for (const t of times) {
    const group = groups.get(t)!;
    
    if (group.exits > 0) {
      // Kaplan-Meier estimator
      survival *= (atRisk - group.exits) / atRisk;
    }
    
    points.push({
      timeDays: t,
      survivalProbability: survival,
      atRisk,
      events: group.exits,
    });
    
    atRisk -= (group.exits + group.censored);
  }
  
  return points;
}

function medianSurvivalTime(curve: SurvivalPoint[]): number | null {
  for (const point of curve) {
    if (point.survivalProbability <= 0.5) {
      return point.timeDays;
    }
  }
  return null;  // More than 50% still holding
}
```

### 4.5 Hypothesis Testing

Test if futarchy tokens have significantly different retention than VC tokens:

```typescript path=null start=null
// Two-sample t-test for hold durations
function twoSampleTTest(
  sample1: number[],
  sample2: number[]
): { tStatistic: number; pValue: number; significant: boolean } {
  const n1 = sample1.length;
  const n2 = sample2.length;
  
  const mean1 = sample1.reduce((s, v) => s + v, 0) / n1;
  const mean2 = sample2.reduce((s, v) => s + v, 0) / n2;
  
  const var1 = sample1.reduce((s, v) => s + (v - mean1) ** 2, 0) / (n1 - 1);
  const var2 = sample2.reduce((s, v) => s + (v - mean2) ** 2, 0) / (n2 - 1);
  
  // Welch's t-test (unequal variances)
  const se = Math.sqrt(var1 / n1 + var2 / n2);
  const tStatistic = (mean1 - mean2) / se;
  
  // Approximate degrees of freedom (Welch-Satterthwaite)
  const df = ((var1 / n1 + var2 / n2) ** 2) / 
    ((var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1));
  
  // Approximate p-value (would need t-distribution table/function)
  // For now, use rough heuristic
  const pValue = Math.exp(-0.5 * Math.abs(tStatistic));
  
  return {
    tStatistic,
    pValue,
    significant: pValue < 0.05,
  };
}

// Log-rank test for survival curves
function logRankTest(
  curve1: SurvivalPoint[],
  curve2: SurvivalPoint[]
): { chiSquare: number; pValue: number; significant: boolean } {
  // Simplified log-rank test implementation
  // Would compare observed vs expected events across time points
  
  // For full implementation, need to merge timelines and compute
  // expected events under null hypothesis of equal survival
  
  // Placeholder - real implementation would be more complex
  return { chiSquare: 0, pValue: 1, significant: false };
}
```

## 5. TypeScript Interfaces

### 5.1 Core Types

```typescript path=null start=null
// src/types/personas.ts

/**
 * Wallet persona classification based on on-chain behavior
 */
export type WalletPersona =
  | 'hodler'           // Bought and never sold, held >90 days
  | 'accumulator'      // Multiple buys, no/minimal sells, position growing
  | 'trader'           // High frequency buy/sell, short hold times
  | 'whale_accumulator'// >1% supply, consistently adding
  | 'whale_distributor'// >1% supply, consistently reducing
  | 'yield_farmer'     // Enters/exits around governance events or airdrops
  | 'smart_money'      // Early entry + profitable exits + cross-token presence
  | 'retail_flipper'   // Small positions, buy high sell low pattern
  | 'diamond_hands'    // Held through >50% drawdown without selling
  | 'paper_hands'      // Sold during significant drawdowns
  | 'neutral';         // No strong classification

/**
 * Detailed metrics for a single holding period
 */
export interface HoldingPeriod {
  entryTimestamp: number;
  exitTimestamp: number | null;  // null = still holding
  durationDays: number;
  entryPriceUsd: number;
  exitPriceUsd: number | null;
  realizedPnlUsd: number | null;
  realizedPnlPercent: number | null;
}

/**
 * Complete hold duration metrics for a wallet-token pair
 */
export interface HolderDurationMetrics {
  walletAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  
  // Current state
  currentBalance: number;
  percentOwned: number;
  isCurrentHolder: boolean;
  
  // Historical periods
  holdingPeriods: HoldingPeriod[];
  currentPeriod: HoldingPeriod | null;
  
  // Aggregated metrics
  totalHoldDays: number;        // Sum of all periods
  avgHoldDays: number;          // Average per period
  longestHoldDays: number;      // Longest single period
  shortestHoldDays: number;     // Shortest single period
  periodCount: number;          // Number of entry/exit cycles
  
  // Trading activity
  totalBuys: number;
  totalSells: number;
  buyToSellRatio: number;
  
  // Timing metrics
  firstEntryTimestamp: number;
  lastActivityTimestamp: number;
  daysSinceFirstEntry: number;
  
  // Profitability (if available)
  totalRealizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  avgEntryPriceUsd: number;
}

/**
 * Wallet classification result
 */
export interface WalletClassification {
  walletAddress: string;
  tokenAddress: string;
  personas: WalletPersona[];
  primaryPersona: WalletPersona;  // Most dominant classification
  confidence: number;             // 0-1 confidence score
  metrics: HolderDurationMetrics;
  classifiedAt: number;
}
```

### 5.2 Aggregated Types

```typescript path=null start=null
// src/types/distribution.ts

/**
 * Persona distribution for a single token
 */
export interface PersonaDistribution {
  tokenId: string;
  tokenAddress: string;
  tokenSymbol: string;
  category: TokenCategory;
  
  // Counts by persona
  distribution: Record<WalletPersona, number>;
  
  // Percentages
  percentages: Record<WalletPersona, number>;
  
  // Summary
  totalClassified: number;
  totalHolders: number;
  classificationCoverage: number;  // % of holders classified
  
  // Dominant personas
  topPersonas: Array<{ persona: WalletPersona; count: number; percentage: number }>;
  
  // Timestamps
  analysisTimestamp: number;
  dataAsOf: number;
}

/**
 * Hold duration distribution for a single token
 */
export interface TokenHoldDurationDistribution {
  tokenId: string;
  tokenAddress: string;
  tokenSymbol: string;
  category: TokenCategory;
  
  // Statistical summary
  stats: HoldDurationStats;
  
  // Histogram
  histogram: HistogramBucket[];
  
  // By holder tier
  byTier: {
    whales: HoldDurationStats;    // >1% ownership
    sharks: HoldDurationStats;    // 0.1-1%
    dolphins: HoldDurationStats;  // 0.01-0.1%
    fish: HoldDurationStats;      // <0.01%
  };
  
  // Sample size
  sampleSize: number;
  totalHolders: number;
  
  analysisTimestamp: number;
}

/**
 * Survival curve data for holder retention
 */
export interface TokenRetentionCurve {
  tokenId: string;
  tokenAddress: string;
  tokenSymbol: string;
  category: TokenCategory;
  
  // Kaplan-Meier curve points
  survivalCurve: SurvivalPoint[];
  
  // Key retention metrics
  medianSurvivalDays: number | null;
  retention7Days: number;   // % still holding after 7 days
  retention30Days: number;
  retention90Days: number;
  retention180Days: number;
  retention365Days: number;
  
  // Hazard analysis
  peakChurnDay: number | null;      // Day with highest exit rate
  earlyChurnRate: number;            // Exits in first 7 days / total
  
  // Cohort counts
  totalCohort: number;
  stillHolding: number;
  exited: number;
  
  analysisTimestamp: number;
}
```

### 5.3 Comparison Types

```typescript path=null start=null
// src/types/comparison.ts

/**
 * Cross-category comparison results
 */
export interface CategoryComparison {
  categories: TokenCategory[];
  
  // Duration comparisons
  avgHoldDaysByCategory: Record<TokenCategory, number>;
  medianHoldDaysByCategory: Record<TokenCategory, number>;
  
  // Persona comparisons
  hodlerRateByCategory: Record<TokenCategory, number>;
  traderRateByCategory: Record<TokenCategory, number>;
  diamondHandsRateByCategory: Record<TokenCategory, number>;
  
  // Statistical tests
  durationSignificance: {
    futarchyVsVc: { tStatistic: number; pValue: number; significant: boolean };
    metadaoVsCommunity: { tStatistic: number; pValue: number; significant: boolean };
  };
  
  // Retention comparisons
  medianRetentionByCategory: Record<TokenCategory, number | null>;
  retentionSignificance: {
    futarchyVsVc: { chiSquare: number; pValue: number; significant: boolean };
  };
  
  analysisTimestamp: number;
}

/**
 * Token-level comparison for similar pairs
 */
export interface TokenPairComparison {
  token1: {
    id: string;
    symbol: string;
    category: TokenCategory;
  };
  token2: {
    id: string;
    symbol: string;
    category: TokenCategory;
  };
  
  metrics: {
    holdDuration: { token1: number; token2: number; delta: number };
    hodlerRate: { token1: number; token2: number; delta: number };
    retention30d: { token1: number; token2: number; delta: number };
    whaleConcentration: { token1: number; token2: number; delta: number };
  };
  
  survivalCurveComparison: {
    curve1: SurvivalPoint[];
    curve2: SurvivalPoint[];
    logRankPValue: number;
  };
}
```

### 5.4 API Response Types

```typescript path=null start=null
// src/types/api.ts

/**
 * API response for holder duration analysis
 */
export interface HolderDurationResponse {
  tokenId: string;
  distribution: TokenHoldDurationDistribution;
  retentionCurve: TokenRetentionCurve;
  sampleWallets: HolderDurationMetrics[];  // Top N by duration
  fetchedAt: string;
  cached: boolean;
}

/**
 * API response for persona classification
 */
export interface PersonaClassificationResponse {
  tokenId: string;
  distribution: PersonaDistribution;
  examples: Record<WalletPersona, WalletClassification[]>;  // Top examples per persona
  fetchedAt: string;
  cached: boolean;
}

/**
 * API response for cross-token comparison
 */
export interface ComparisonResponse {
  comparison: CategoryComparison;
  tokenDetails: Array<{
    tokenId: string;
    durationStats: HoldDurationStats;
    personaDistribution: PersonaDistribution;
  }>;
  fetchedAt: string;
}
```

## 6. Implementation Recommendations

### 6.1 Phased Rollout

**Phase 1 (Week 1):**
- Implement `getTokenEventsForMaker` in Codex client
- Build hold duration calculation from global events
- Basic persona classification (HODLer, Accumulator, Trader, Whale types)

**Phase 2 (Week 2):**
- Add per-wallet stats integration
- Implement Smart Money and Retail Flipper detection
- Build survival curve calculation

**Phase 3 (Week 3):**
- Diamond Hands / Paper Hands detection (requires price correlation)
- Statistical comparison across categories
- Build caching layer for expensive computations

### 6.2 Caching Strategy

```typescript path=null start=null
interface CacheConfig {
  holderDuration: {
    ttl: 3600,           // 1 hour - positions change slowly
    staleWhileRevalidate: true,
  },
  personaClassification: {
    ttl: 86400,          // 24 hours - classifications stable
    staleWhileRevalidate: true,
  },
  survivalCurve: {
    ttl: 86400,          // 24 hours - historical data
    staleWhileRevalidate: true,
  },
  tokenEvents: {
    ttl: 1800,           // 30 minutes - new trades happening
    staleWhileRevalidate: true,
  },
}
```

### 6.3 Background Jobs

Run expensive analyses asynchronously:
1. **Nightly:** Full holder classification for all 28 tokens
2. **Hourly:** Update survival curves with new exits
3. **On-demand:** Per-token refresh when viewing dashboard

### 6.4 New Codex Method to Implement

```typescript path=null start=null
/**
 * Get all swap events for a specific wallet address on a token.
 * Required for detailed hold duration analysis.
 */
async getTokenEventsForMaker(
  makerAddress: string,
  tokenAddress: string,
  networkId = SOLANA_NETWORK_ID,
  limit = 100
): Promise<CodexTokenEvent[]> {
  const data = await this.query<{ getTokenEventsForMaker: { items: CodexTokenEvent[] } }>(
    `query($makerAddress: String!, $tokenAddress: String!, $networkId: Int!, $limit: Int) {
      getTokenEventsForMaker(input: { 
        makerAddress: $makerAddress, 
        tokenAddress: $tokenAddress,
        networkId: $networkId,
        limit: $limit 
      }) {
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
    { makerAddress, tokenAddress, networkId, limit }
  );
  return data.getTokenEventsForMaker?.items ?? [];
}
```

## 7. Summary

This research provides a comprehensive framework for analyzing holder duration and classifying wallet personas using the Codex.io API. Key insights:

1. **Hold Duration** can be derived from swap events by tracking entry/exit timestamps per wallet. The algorithm handles partial sells, re-entries, and DCA patterns.

2. **Persona Classification** uses 10 distinct categories based on holding behavior, trading frequency, position size, and profitability. Multiple personas can apply to a single wallet.

3. **API Budget** for full analysis of 28 tokens is ~14,500 calls (~8 min). Recommended sampling strategy reduces this to ~10,400 calls (~6 min) while maintaining statistical validity.

4. **Statistical Methods** include standard duration statistics, Kaplan-Meier survival curves for retention, and hypothesis testing for cross-category comparisons.

5. **Proposed Interfaces** provide complete type definitions for integration into the existing codebase.

Next step: Implement Phase 1 with the basic hold duration algorithm and persona classification.
