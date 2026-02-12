# Whale Behavior Detection Algorithms

Research document for accumulation/distribution detection and whale behavior analysis on Solana tokens.

## 1. Whale Threshold Definitions

### 1.1 The Challenge of Defining "Whale"

Whale definitions must account for:
- **Market cap variance**: $1M is massive for a $10M mcap token but insignificant for a $10B token
- **Liquidity depth**: Position size relative to daily volume matters for market impact
- **Token distribution**: A 0.5% holder in a concentrated token may have more influence than 2% in a distributed one

### 1.2 Absolute Thresholds (USD-Based)

| Tier | Threshold | Use Case |
|------|-----------|----------|
| Mega Whale | ≥$10M | Institutional-level, protocol-defining positions |
| Whale | ≥$1M | Major market movers |
| Large Holder | ≥$100K | Significant retail/small fund positions |
| Mid Holder | ≥$10K | Active traders/believers |
| Small Holder | <$10K | Retail participants |

**Pseudocode: Absolute Classification**
```typescript
function classifyByAbsoluteValue(
  balance: number,
  tokenPrice: number
): AbsoluteTier {
  const usdValue = balance * tokenPrice;
  
  if (usdValue >= 10_000_000) return "mega_whale";
  if (usdValue >= 1_000_000) return "whale";
  if (usdValue >= 100_000) return "large_holder";
  if (usdValue >= 10_000) return "mid_holder";
  return "small_holder";
}
```

### 1.3 Relative Thresholds (Supply-Based)

| Tier | % of Supply | Rationale |
|------|-------------|-----------|
| Whale | ≥1.0% | Can materially impact governance/price |
| Shark | ≥0.1% | Meaningful stake, visible accumulation |
| Dolphin | ≥0.01% | Active participant, not dust |
| Fish | <0.01% | Retail, minimal individual impact |

**Current Implementation** (src/lib/metrics/distribution.ts):
```typescript
// Existing holderBuckets function uses these thresholds
whale: pct >= 0.01      // 1%
shark: pct >= 0.001     // 0.1%
dolphin: pct >= 0.0001  // 0.01%
fish: pct < 0.0001      // <0.01%
```

### 1.4 Market Cap-Adjusted Thresholds

For small-cap tokens like META vs large-cap like JUP, thresholds should scale:

```typescript
interface DynamicWhaleThresholds {
  supplyPct: number;      // Base: 1%
  minUsdValue: number;    // Floor: $50K even if 1% is less
  maxUsdValue: number;    // Cap: $50M even if 1% is more
  volumeMultiple: number; // Min: 10x avg daily volume
}

function getDynamicThreshold(
  marketCap: number,
  avgDailyVolume: number
): DynamicWhaleThresholds {
  // Small-cap (<$50M): Lower absolute, higher relative
  if (marketCap < 50_000_000) {
    return {
      supplyPct: 0.005,        // 0.5% is whale for small caps
      minUsdValue: 25_000,     // Lower floor
      maxUsdValue: 500_000,    // Cap relative impact
      volumeMultiple: 5,       // More volume sensitive
    };
  }
  
  // Mid-cap ($50M - $500M): Balanced
  if (marketCap < 500_000_000) {
    return {
      supplyPct: 0.01,         // 1% standard
      minUsdValue: 100_000,
      maxUsdValue: 5_000_000,
      volumeMultiple: 10,
    };
  }
  
  // Large-cap (>$500M): Higher absolute, lower relative
  return {
    supplyPct: 0.005,          // 0.5% for large caps
    minUsdValue: 500_000,      // Higher floor
    maxUsdValue: 50_000_000,   // Allow larger positions
    volumeMultiple: 20,        // Less volume sensitive
  };
}
```

### 1.5 Token-Specific Recommendations

| Token | Category | Market Cap Range | Whale Threshold |
|-------|----------|------------------|-----------------|
| META | Small-cap MetaDAO | $5M-$50M | ≥0.5% OR ≥$25K |
| DEAN | Small-cap MetaDAO | $1M-$10M | ≥1.0% OR ≥$10K |
| JUP | Large-cap VC | $500M-$2B | ≥0.1% OR ≥$500K |
| JTO | Mid-cap VC | $200M-$800M | ≥0.25% OR ≥$200K |
| BONK | Meme/Community | Variable | ≥0.01% OR ≥$100K |

---

## 2. Detection Algorithms

### 2.1 Moving Average Crossover on Whale Holdings

Track whale holdings percentage over time and use MA crossovers to detect accumulation/distribution trends.

```typescript
interface WhaleHoldingsTimeseries {
  timestamp: number;
  totalWhaleBalance: number;     // Sum of all whale balances
  whaleSupplyPct: number;        // % of supply held by whales
  whaleCount: number;            // Number of whale wallets
  avgWhaleBalance: number;       // Average per whale
}

interface MACrossoverSignal {
  type: "accumulation" | "distribution" | "neutral";
  strength: number;  // 0-1
  fastMA: number;
  slowMA: number;
  timestamp: number;
}

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const result: number[] = [data[0]];
  
  for (let i = 1; i < data.length; i++) {
    result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
  }
  return result;
}

function detectWhaleMACrossover(
  timeseries: WhaleHoldingsTimeseries[],
  fastPeriod = 7,   // 7-day fast MA
  slowPeriod = 21   // 21-day slow MA
): MACrossoverSignal[] {
  const whaleSupplyPcts = timeseries.map(t => t.whaleSupplyPct);
  
  const fastMA = calculateEMA(whaleSupplyPcts, fastPeriod);
  const slowMA = calculateEMA(whaleSupplyPcts, slowPeriod);
  
  const signals: MACrossoverSignal[] = [];
  
  // Align arrays (slow MA starts later)
  const offset = slowPeriod - fastPeriod;
  
  for (let i = 1; i < slowMA.length; i++) {
    const fastIdx = i + offset;
    const prevFast = fastMA[fastIdx - 1];
    const currFast = fastMA[fastIdx];
    const prevSlow = slowMA[i - 1];
    const currSlow = slowMA[i];
    
    // Crossover detection
    const wasBelowSlow = prevFast < prevSlow;
    const isAboveSlow = currFast > currSlow;
    
    // Strength = distance between MAs as % of slow MA
    const strength = Math.abs(currFast - currSlow) / currSlow;
    
    if (wasBelowSlow && isAboveSlow) {
      signals.push({
        type: "accumulation",
        strength: Math.min(strength * 10, 1), // Normalize
        fastMA: currFast,
        slowMA: currSlow,
        timestamp: timeseries[fastIdx].timestamp,
      });
    } else if (!wasBelowSlow && !isAboveSlow && prevFast > prevSlow) {
      signals.push({
        type: "distribution",
        strength: Math.min(strength * 10, 1),
        fastMA: currFast,
        slowMA: currSlow,
        timestamp: timeseries[fastIdx].timestamp,
      });
    }
  }
  
  return signals;
}
```

### 2.2 Volume-Weighted Accumulation/Distribution (VWAD)

Adapts the classic A/D indicator using on-chain transfer data.

```typescript
interface TransferEvent {
  timestamp: number;
  from: string;
  to: string;
  amount: number;
  txHash: string;
}

interface VWADPoint {
  timestamp: number;
  value: number;           // Cumulative VWAD
  deltaFlow: number;       // Net flow for period
  buyVolume: number;       // Volume into whale wallets
  sellVolume: number;      // Volume out of whale wallets
}

function calculateVWAD(
  transfers: TransferEvent[],
  whaleAddresses: Set<string>,
  priceData: Map<number, number>,  // timestamp -> price
  periodMs = 86400000  // 1 day
): VWADPoint[] {
  // Group transfers by period
  const periods = new Map<number, TransferEvent[]>();
  
  for (const t of transfers) {
    const periodStart = Math.floor(t.timestamp / periodMs) * periodMs;
    if (!periods.has(periodStart)) {
      periods.set(periodStart, []);
    }
    periods.get(periodStart)!.push(t);
  }
  
  const sortedPeriods = [...periods.keys()].sort((a, b) => a - b);
  let cumulativeVWAD = 0;
  const result: VWADPoint[] = [];
  
  for (const periodStart of sortedPeriods) {
    const periodTransfers = periods.get(periodStart)!;
    const price = priceData.get(periodStart) ?? 1;
    
    let buyVolume = 0;   // Into whale wallets
    let sellVolume = 0;  // Out of whale wallets
    
    for (const t of periodTransfers) {
      const isFromWhale = whaleAddresses.has(t.from);
      const isToWhale = whaleAddresses.has(t.to);
      const volumeUsd = t.amount * price;
      
      if (!isFromWhale && isToWhale) {
        // Accumulation: non-whale -> whale
        buyVolume += volumeUsd;
      } else if (isFromWhale && !isToWhale) {
        // Distribution: whale -> non-whale
        sellVolume += volumeUsd;
      }
      // whale -> whale transfers are neutral (rebalancing)
    }
    
    const totalVolume = buyVolume + sellVolume;
    const deltaFlow = buyVolume - sellVolume;
    
    // Money Flow Multiplier: ranges from -1 to +1
    const mfMultiplier = totalVolume > 0 
      ? deltaFlow / totalVolume 
      : 0;
    
    // VWAD = cumulative (MF Multiplier * Volume)
    cumulativeVWAD += mfMultiplier * totalVolume;
    
    result.push({
      timestamp: periodStart,
      value: cumulativeVWAD,
      deltaFlow,
      buyVolume,
      sellVolume,
    });
  }
  
  return result;
}

// Divergence detection: price up + VWAD down = distribution
function detectVWADDivergence(
  vwad: VWADPoint[],
  priceData: { timestamp: number; price: number }[],
  lookbackPeriods = 14
): { type: "bearish_divergence" | "bullish_divergence"; strength: number } | null {
  if (vwad.length < lookbackPeriods) return null;
  
  const recentVWAD = vwad.slice(-lookbackPeriods);
  const recentPrice = priceData.slice(-lookbackPeriods);
  
  const vwadChange = (recentVWAD[recentVWAD.length - 1].value - recentVWAD[0].value) / 
                     Math.abs(recentVWAD[0].value || 1);
  const priceChange = (recentPrice[recentPrice.length - 1].price - recentPrice[0].price) / 
                      recentPrice[0].price;
  
  // Bearish: price up, VWAD down (whales distributing into strength)
  if (priceChange > 0.1 && vwadChange < -0.1) {
    return {
      type: "bearish_divergence",
      strength: Math.min(Math.abs(priceChange - vwadChange), 1),
    };
  }
  
  // Bullish: price down, VWAD up (whales accumulating weakness)
  if (priceChange < -0.1 && vwadChange > 0.1) {
    return {
      type: "bullish_divergence",
      strength: Math.min(Math.abs(priceChange - vwadChange), 1),
    };
  }
  
  return null;
}
```

### 2.3 On-Balance Volume (OBV) Adapted for Holder Data

Traditional OBV uses price; we adapt it for holder count and balance changes.

```typescript
interface HolderOBVPoint {
  timestamp: number;
  obv: number;                    // Cumulative OBV
  holderDelta: number;            // Change in holder count
  balanceWeightedDelta: number;   // Balance-weighted change
}

function calculateHolderOBV(
  snapshots: Array<{
    timestamp: number;
    totalHolders: number;
    totalBalance: number;      // Total supply held (excluding burn/treasury)
    avgBalance: number;
  }>
): HolderOBVPoint[] {
  if (snapshots.length < 2) return [];
  
  let obv = 0;
  const result: HolderOBVPoint[] = [];
  
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    
    const holderDelta = curr.totalHolders - prev.totalHolders;
    const avgBalanceChange = curr.avgBalance - prev.avgBalance;
    
    // Weighted volume: holder change * avg balance change direction
    // If holders increasing AND avg balance increasing = strong accumulation
    // If holders increasing BUT avg balance decreasing = dilution (distribution at top)
    
    const balanceDirection = avgBalanceChange > 0 ? 1 : -1;
    const holderDirection = holderDelta > 0 ? 1 : -1;
    
    // Volume proxy: absolute holder change * avg balance
    const volume = Math.abs(holderDelta) * curr.avgBalance;
    
    // OBV direction: positive if both directions align (accumulation)
    // negative if directions diverge (distribution)
    const direction = balanceDirection * holderDirection;
    
    obv += direction * volume;
    
    result.push({
      timestamp: curr.timestamp,
      obv,
      holderDelta,
      balanceWeightedDelta: holderDelta * avgBalanceChange,
    });
  }
  
  return result;
}

// Whale-specific OBV: track only whale wallet changes
function calculateWhaleOBV(
  whaleSnapshots: Array<{
    timestamp: number;
    whaleCount: number;
    totalWhaleBalance: number;
  }>
): HolderOBVPoint[] {
  if (whaleSnapshots.length < 2) return [];
  
  let obv = 0;
  const result: HolderOBVPoint[] = [];
  
  for (let i = 1; i < whaleSnapshots.length; i++) {
    const prev = whaleSnapshots[i - 1];
    const curr = whaleSnapshots[i];
    
    const whaleCountDelta = curr.whaleCount - prev.whaleCount;
    const balanceDelta = curr.totalWhaleBalance - prev.totalWhaleBalance;
    
    // Positive: more whales OR same whales accumulating
    // Negative: fewer whales OR same whales distributing
    
    // Use balance change as primary signal, count as confirmation
    const primarySignal = balanceDelta > 0 ? 1 : -1;
    const volume = Math.abs(balanceDelta);
    
    // Boost signal if count confirms direction
    const confirmationMultiplier = 
      (balanceDelta > 0 && whaleCountDelta > 0) ||
      (balanceDelta < 0 && whaleCountDelta < 0)
        ? 1.5
        : 1.0;
    
    obv += primarySignal * volume * confirmationMultiplier;
    
    result.push({
      timestamp: curr.timestamp,
      obv,
      holderDelta: whaleCountDelta,
      balanceWeightedDelta: balanceDelta,
    });
  }
  
  return result;
}
```

### 2.4 Smart Money Flow Index (SMFI)

Composite indicator combining multiple signals.

```typescript
interface SmartMoneyFlowIndex {
  timestamp: number;
  smfi: number;           // -100 to +100
  components: {
    whaleAccumulation: number;  // -1 to +1
    volumeTrend: number;        // -1 to +1
    holderQuality: number;      // -1 to +1
    concentrationChange: number; // -1 to +1
  };
  signal: "strong_accumulation" | "accumulation" | "neutral" | "distribution" | "strong_distribution";
}

function calculateSMFI(
  whaleHoldings: WhaleHoldingsTimeseries[],
  transfers: TransferEvent[],
  holderSnapshots: Array<{ timestamp: number; gini: number; totalHolders: number }>,
  whaleAddresses: Set<string>,
  lookback = 14
): SmartMoneyFlowIndex {
  const recent = whaleHoldings.slice(-lookback);
  
  // 1. Whale Accumulation Score
  const whaleBalanceChange = recent[recent.length - 1].whaleSupplyPct - recent[0].whaleSupplyPct;
  const whaleAccumulation = Math.max(-1, Math.min(1, whaleBalanceChange * 20)); // Scale ±5% to ±1
  
  // 2. Volume Trend Score (whale buy vs sell volume)
  const recentTransfers = transfers.filter(t => 
    t.timestamp >= recent[0].timestamp && 
    t.timestamp <= recent[recent.length - 1].timestamp
  );
  
  let buyVol = 0, sellVol = 0;
  for (const t of recentTransfers) {
    if (whaleAddresses.has(t.to) && !whaleAddresses.has(t.from)) buyVol += t.amount;
    if (whaleAddresses.has(t.from) && !whaleAddresses.has(t.to)) sellVol += t.amount;
  }
  const totalVol = buyVol + sellVol;
  const volumeTrend = totalVol > 0 ? (buyVol - sellVol) / totalVol : 0;
  
  // 3. Holder Quality Score (new holders' avg balance vs existing)
  // Approximated by: if avg balance increasing while holders increase = quality inflow
  const holderChange = recent[recent.length - 1].whaleCount - recent[0].whaleCount;
  const avgBalanceChange = recent[recent.length - 1].avgWhaleBalance - recent[0].avgWhaleBalance;
  const holderQuality = holderChange > 0 && avgBalanceChange > 0 ? 1 :
                        holderChange > 0 && avgBalanceChange < 0 ? -0.5 :
                        holderChange < 0 && avgBalanceChange > 0 ? 0.5 :
                        holderChange < 0 && avgBalanceChange < 0 ? -1 : 0;
  
  // 4. Concentration Change (Gini trend)
  const recentGini = holderSnapshots.slice(-lookback);
  const giniChange = recentGini.length >= 2 
    ? recentGini[recentGini.length - 1].gini - recentGini[0].gini
    : 0;
  // Increasing Gini = more concentrated = whale accumulation
  const concentrationChange = Math.max(-1, Math.min(1, giniChange * 10));
  
  // Composite SMFI: weighted average scaled to -100 to +100
  const weights = {
    whaleAccumulation: 0.35,
    volumeTrend: 0.30,
    holderQuality: 0.20,
    concentrationChange: 0.15,
  };
  
  const smfi = (
    whaleAccumulation * weights.whaleAccumulation +
    volumeTrend * weights.volumeTrend +
    holderQuality * weights.holderQuality +
    concentrationChange * weights.concentrationChange
  ) * 100;
  
  // Signal classification
  const signal: SmartMoneyFlowIndex["signal"] = 
    smfi > 50 ? "strong_accumulation" :
    smfi > 20 ? "accumulation" :
    smfi < -50 ? "strong_distribution" :
    smfi < -20 ? "distribution" :
    "neutral";
  
  return {
    timestamp: recent[recent.length - 1].timestamp,
    smfi,
    components: {
      whaleAccumulation,
      volumeTrend,
      holderQuality,
      concentrationChange,
    },
    signal,
  };
}
```

---

## 3. Cross-Token Analysis

### 3.1 Whale Overlap Analysis

Identify wallets that hold multiple tokens to understand smart money positioning.

```typescript
interface WalletPortfolio {
  address: string;
  holdings: Map<string, {  // tokenId -> holding
    balance: number;
    usdValue: number;
    percentOfSupply: number;
    isWhale: boolean;
  }>;
  totalUsdValue: number;
  whaleInTokens: string[];  // Token IDs where this wallet is a whale
}

interface OverlapAnalysis {
  tokenPair: [string, string];
  sharedWhales: number;
  sharedWhaleAddresses: string[];
  correlationStrength: number;  // 0-1
  netFlowDirection: "token1_to_token2" | "token2_to_token1" | "neutral";
}

async function analyzeWhaleOverlap(
  tokens: Array<{ id: string; address: string }>,
  codexClient: CodexClient
): Promise<OverlapAnalysis[]> {
  // Fetch top holders for each token
  const holdersByToken = new Map<string, Set<string>>();
  const whalesByToken = new Map<string, Map<string, number>>();  // token -> (address -> balance)
  
  for (const token of tokens) {
    const holders = await codexClient.getTopHolders(token.address, 500);
    const whaleAddresses = new Map<string, number>();
    
    for (const h of holders) {
      if (h.percentOwned >= 0.5) {  // 0.5% threshold for cross-token whale
        whaleAddresses.set(h.address, h.percentOwned);
      }
    }
    
    holdersByToken.set(token.id, new Set(holders.map(h => h.address)));
    whalesByToken.set(token.id, whaleAddresses);
  }
  
  // Calculate pairwise overlaps
  const results: OverlapAnalysis[] = [];
  const tokenIds = tokens.map(t => t.id);
  
  for (let i = 0; i < tokenIds.length; i++) {
    for (let j = i + 1; j < tokenIds.length; j++) {
      const token1 = tokenIds[i];
      const token2 = tokenIds[j];
      
      const whales1 = whalesByToken.get(token1)!;
      const whales2 = whalesByToken.get(token2)!;
      
      const sharedWhaleAddresses: string[] = [];
      
      for (const addr of whales1.keys()) {
        if (whales2.has(addr)) {
          sharedWhaleAddresses.push(addr);
        }
      }
      
      // Correlation strength: Jaccard index of whale sets
      const union = new Set([...whales1.keys(), ...whales2.keys()]);
      const correlationStrength = union.size > 0 
        ? sharedWhaleAddresses.length / union.size 
        : 0;
      
      results.push({
        tokenPair: [token1, token2],
        sharedWhales: sharedWhaleAddresses.length,
        sharedWhaleAddresses,
        correlationStrength,
        netFlowDirection: "neutral",  // Would need transfer data to determine
      });
    }
  }
  
  return results.sort((a, b) => b.correlationStrength - a.correlationStrength);
}
```

### 3.2 Wallet Clustering

Identify potentially related wallets based on behavioral patterns.

```typescript
interface WalletCluster {
  clusterId: string;
  wallets: string[];
  totalBalance: number;
  effectiveSupplyPct: number;  // Combined supply control
  clusterType: "coordinated_trading" | "same_entity" | "copy_trading" | "unknown";
  confidence: number;  // 0-1
  evidence: ClusterEvidence[];
}

interface ClusterEvidence {
  type: "timing" | "amount" | "funding" | "behavioral";
  description: string;
  strength: number;
}

function clusterWalletsByBehavior(
  transfers: TransferEvent[],
  holderSnapshots: Map<string, Array<{ timestamp: number; balance: number }>>,
  timeWindowMs = 300000  // 5 minutes
): WalletCluster[] {
  const clusters: WalletCluster[] = [];
  const processed = new Set<string>();
  
  // Build timing correlation matrix
  const timingCorrelations = new Map<string, Map<string, number>>();
  
  // Group transfers by time windows
  const timeWindows = new Map<number, TransferEvent[]>();
  for (const t of transfers) {
    const window = Math.floor(t.timestamp / timeWindowMs);
    if (!timeWindows.has(window)) {
      timeWindows.set(window, []);
    }
    timeWindows.get(window)!.push(t);
  }
  
  // Find wallets that transact in same windows repeatedly
  const coOccurrences = new Map<string, Map<string, number>>();
  
  for (const windowTransfers of timeWindows.values()) {
    const walletsInWindow = new Set<string>();
    
    for (const t of windowTransfers) {
      walletsInWindow.add(t.from);
      walletsInWindow.add(t.to);
    }
    
    // Record co-occurrences
    const walletArray = [...walletsInWindow];
    for (let i = 0; i < walletArray.length; i++) {
      for (let j = i + 1; j < walletArray.length; j++) {
        const w1 = walletArray[i];
        const w2 = walletArray[j];
        const key = [w1, w2].sort().join("-");
        
        if (!coOccurrences.has(w1)) coOccurrences.set(w1, new Map());
        if (!coOccurrences.has(w2)) coOccurrences.set(w2, new Map());
        
        coOccurrences.get(w1)!.set(w2, (coOccurrences.get(w1)!.get(w2) || 0) + 1);
        coOccurrences.get(w2)!.set(w1, (coOccurrences.get(w2)!.get(w1) || 0) + 1);
      }
    }
  }
  
  // Identify clusters based on high co-occurrence
  const minCoOccurrences = 3;  // At least 3 shared time windows
  
  for (const [wallet, related] of coOccurrences) {
    if (processed.has(wallet)) continue;
    
    const clusterWallets = [wallet];
    processed.add(wallet);
    
    for (const [relatedWallet, count] of related) {
      if (count >= minCoOccurrences && !processed.has(relatedWallet)) {
        clusterWallets.push(relatedWallet);
        processed.add(relatedWallet);
      }
    }
    
    if (clusterWallets.length >= 2) {
      // Calculate cluster metrics
      let totalBalance = 0;
      for (const w of clusterWallets) {
        const snapshots = holderSnapshots.get(w);
        if (snapshots && snapshots.length > 0) {
          totalBalance += snapshots[snapshots.length - 1].balance;
        }
      }
      
      // Determine cluster type based on evidence
      const evidence: ClusterEvidence[] = [{
        type: "timing",
        description: `${clusterWallets.length} wallets transacted in same 5-min windows ≥${minCoOccurrences} times`,
        strength: Math.min(1, clusterWallets.length / 10),
      }];
      
      clusters.push({
        clusterId: `cluster_${clusters.length + 1}`,
        wallets: clusterWallets,
        totalBalance,
        effectiveSupplyPct: 0,  // Would need total supply to calculate
        clusterType: clusterWallets.length > 5 ? "coordinated_trading" : "same_entity",
        confidence: 0.6 + (Math.min(clusterWallets.length, 10) / 10) * 0.3,
        evidence,
      });
    }
  }
  
  return clusters;
}

// Funding source analysis
function findCommonFundingSources(
  wallets: string[],
  transfers: TransferEvent[],
  maxHops = 3
): Map<string, string[]> {  // funding source -> funded wallets
  const fundingSources = new Map<string, Set<string>>();
  
  // Build incoming transfer graph for target wallets
  const incomingTransfers = new Map<string, TransferEvent[]>();
  
  for (const t of transfers) {
    if (wallets.includes(t.to)) {
      if (!incomingTransfers.has(t.to)) {
        incomingTransfers.set(t.to, []);
      }
      incomingTransfers.get(t.to)!.push(t);
    }
  }
  
  // Trace back funding sources
  for (const wallet of wallets) {
    const visited = new Set<string>();
    const queue: Array<{ addr: string; hops: number }> = [{ addr: wallet, hops: 0 }];
    
    while (queue.length > 0) {
      const { addr, hops } = queue.shift()!;
      if (hops > maxHops || visited.has(addr)) continue;
      visited.add(addr);
      
      const incoming = incomingTransfers.get(addr) || [];
      for (const t of incoming) {
        // Record this funding source
        if (!fundingSources.has(t.from)) {
          fundingSources.set(t.from, new Set());
        }
        fundingSources.get(t.from)!.add(wallet);
        
        // Continue tracing if not at max depth
        if (hops + 1 <= maxHops) {
          queue.push({ addr: t.from, hops: hops + 1 });
        }
      }
    }
  }
  
  // Filter to sources that funded multiple wallets
  const commonSources = new Map<string, string[]>();
  for (const [source, funded] of fundingSources) {
    if (funded.size >= 2) {
      commonSources.set(source, [...funded]);
    }
  }
  
  return commonSources;
}
```

### 3.3 Codex API Queries for Cross-Token Analysis

```typescript
// Using Codex's filterTokenWallets to find whale overlap
const FILTER_TOKEN_WALLETS_QUERY = `
  query FilterTokenWallets($input: FilterTokenWalletsInput!) {
    filterTokenWallets(input: $input) {
      items {
        address
        tokens {
          tokenAddress
          balance
          percentOwned
        }
      }
      pageInfo {
        hasNextPage
        cursor
      }
    }
  }
`;

// Get all token balances for a specific wallet
const WALLET_BALANCES_QUERY = `
  query GetWalletBalances($address: String!, $networkId: Int!) {
    walletBalances(input: { address: $address, networkId: $networkId }) {
      items {
        tokenAddress
        tokenSymbol
        balance
        percentOwned
        valueUsd
      }
    }
  }
`;

async function getWhalePortfolios(
  codexClient: CodexClient,
  targetTokens: string[],
  minHoldingPct = 0.5
): Promise<WalletPortfolio[]> {
  // This would need to be implemented based on actual Codex API capabilities
  // Pseudocode for the approach:
  
  const portfolios: WalletPortfolio[] = [];
  
  for (const tokenAddress of targetTokens) {
    const holders = await codexClient.getTopHolders(tokenAddress, 200);
    
    for (const holder of holders) {
      if (holder.percentOwned >= minHoldingPct) {
        // Fetch this wallet's full portfolio
        // const balances = await codexClient.query(WALLET_BALANCES_QUERY, ...)
        
        // Build portfolio object
        // portfolios.push(...)
      }
    }
  }
  
  return portfolios;
}
```

---

## 4. Behavioral Classification Improvements

### 4.1 Current Implementation Analysis

Current behavior.ts classifications:

| Behavior | Current Logic | Limitations |
|----------|--------------|-------------|
| diamond_hands | ≥180 days, <10% change | Doesn't account for market conditions |
| accumulator | >20% balance increase | No time weighting, ignores price action |
| distributor | >20% balance decrease | Same limitations |
| flipper | <7 days holding | Too simplistic, misses nuanced trading |
| new_entrant | Not in first snapshot | No quality differentiation |
| exited | Not in last snapshot | Doesn't track where they went |

### 4.2 Enhanced Classification Algorithm

```typescript
type EnhancedBehavior = 
  | "diamond_hands_accumulator"    // Long-term, still buying
  | "diamond_hands_holder"         // Long-term, steady
  | "strategic_accumulator"        // Methodical buying pattern
  | "dip_buyer"                    // Buys on price drops
  | "momentum_chaser"              // Buys on price rises
  | "profit_taker"                 // Sells portions on rallies
  | "panic_seller"                 // Sells on drops
  | "swing_trader"                 // Regular in/out pattern
  | "flipper"                      // Very short holds
  | "new_whale"                    // Recently crossed whale threshold
  | "graduated_out"                // Fell below whale threshold
  | "exited";                      // Fully exited

interface EnhancedBehaviorParams {
  // Snapshot data
  balanceHistory: Array<{ timestamp: number; balance: number }>;
  // Price context
  priceHistory: Array<{ timestamp: number; price: number }>;
  // Transfer granularity (if available)
  transfers?: TransferEvent[];
  // Current thresholds
  whaleThreshold: number;
}

function classifyEnhancedBehavior(
  params: EnhancedBehaviorParams
): { behavior: EnhancedBehavior; confidence: number; reasoning: string } {
  const { balanceHistory, priceHistory, transfers, whaleThreshold } = params;
  
  if (balanceHistory.length < 2) {
    return { behavior: "new_whale", confidence: 0.5, reasoning: "Insufficient history" };
  }
  
  const first = balanceHistory[0];
  const last = balanceHistory[balanceHistory.length - 1];
  const holdingDays = (last.timestamp - first.timestamp) / 86400000;
  
  // Calculate key metrics
  const balanceChange = (last.balance - first.balance) / first.balance;
  const isWhaleNow = last.balance >= whaleThreshold;
  const wasWhale = first.balance >= whaleThreshold;
  
  // Price correlation
  const priceAtStart = findClosestPrice(priceHistory, first.timestamp);
  const priceAtEnd = findClosestPrice(priceHistory, last.timestamp);
  const priceChange = (priceAtEnd - priceAtStart) / priceAtStart;
  
  // Volatility of holdings (did they trade frequently?)
  const balanceVolatility = calculateVolatility(balanceHistory.map(b => b.balance));
  
  // Check for dip buying pattern
  const dipBuyingScore = calculateDipBuyingScore(balanceHistory, priceHistory);
  
  // Check for profit taking pattern
  const profitTakingScore = calculateProfitTakingScore(balanceHistory, priceHistory);
  
  // Classification logic
  if (!wasWhale && !isWhaleNow) {
    return { behavior: "exited", confidence: 0.9, reasoning: "Never or no longer whale" };
  }
  
  if (wasWhale && !isWhaleNow) {
    if (last.balance === 0) {
      return { behavior: "exited", confidence: 0.95, reasoning: "Fully exited position" };
    }
    return { 
      behavior: "graduated_out", 
      confidence: 0.85, 
      reasoning: `Balance fell ${(balanceChange * 100).toFixed(1)}% below whale threshold` 
    };
  }
  
  if (!wasWhale && isWhaleNow) {
    return { 
      behavior: "new_whale", 
      confidence: 0.9, 
      reasoning: `Accumulated to whale status over ${holdingDays.toFixed(0)} days` 
    };
  }
  
  // Was and is whale - classify behavior
  if (holdingDays < 7) {
    return { 
      behavior: "flipper", 
      confidence: 0.8, 
      reasoning: `Short holding period: ${holdingDays.toFixed(1)} days` 
    };
  }
  
  if (balanceVolatility > 0.5 && holdingDays < 30) {
    return { 
      behavior: "swing_trader", 
      confidence: 0.75, 
      reasoning: `High balance volatility (${(balanceVolatility * 100).toFixed(0)}%) over ${holdingDays.toFixed(0)} days` 
    };
  }
  
  if (dipBuyingScore > 0.6) {
    return { 
      behavior: "dip_buyer", 
      confidence: dipBuyingScore, 
      reasoning: "Consistently increased position during price drops" 
    };
  }
  
  if (profitTakingScore > 0.6) {
    return { 
      behavior: "profit_taker", 
      confidence: profitTakingScore, 
      reasoning: "Consistently reduced position during price rallies" 
    };
  }
  
  if (holdingDays >= 180) {
    if (balanceChange > 0.1) {
      return { 
        behavior: "diamond_hands_accumulator", 
        confidence: 0.85, 
        reasoning: `Long-term holder (${holdingDays.toFixed(0)} days) still accumulating (+${(balanceChange * 100).toFixed(0)}%)` 
      };
    }
    if (Math.abs(balanceChange) < 0.1) {
      return { 
        behavior: "diamond_hands_holder", 
        confidence: 0.9, 
        reasoning: `Steady long-term holder for ${holdingDays.toFixed(0)} days` 
      };
    }
  }
  
  if (balanceChange > 0.2) {
    return { 
      behavior: "strategic_accumulator", 
      confidence: 0.7, 
      reasoning: `Accumulated ${(balanceChange * 100).toFixed(0)}% over ${holdingDays.toFixed(0)} days` 
    };
  }
  
  // Default for distributors
  if (balanceChange < -0.2 && priceChange < -0.1) {
    return { 
      behavior: "panic_seller", 
      confidence: 0.6, 
      reasoning: "Sold during market decline" 
    };
  }
  
  return { 
    behavior: "profit_taker", 
    confidence: 0.6, 
    reasoning: `Reduced position by ${(Math.abs(balanceChange) * 100).toFixed(0)}%` 
  };
}

// Helper functions
function findClosestPrice(priceHistory: Array<{ timestamp: number; price: number }>, timestamp: number): number {
  let closest = priceHistory[0];
  let minDiff = Math.abs(priceHistory[0].timestamp - timestamp);
  
  for (const p of priceHistory) {
    const diff = Math.abs(p.timestamp - timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = p;
    }
  }
  
  return closest.price;
}

function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  
  return Math.sqrt(variance) / mean;  // Coefficient of variation
}

function calculateDipBuyingScore(
  balanceHistory: Array<{ timestamp: number; balance: number }>,
  priceHistory: Array<{ timestamp: number; price: number }>
): number {
  let dipBuys = 0;
  let totalBuys = 0;
  
  for (let i = 1; i < balanceHistory.length; i++) {
    const balanceDelta = balanceHistory[i].balance - balanceHistory[i - 1].balance;
    
    if (balanceDelta > 0) {
      totalBuys++;
      
      // Check if price was declining
      const priceAtBuy = findClosestPrice(priceHistory, balanceHistory[i].timestamp);
      const priceBefore = findClosestPrice(priceHistory, balanceHistory[i - 1].timestamp);
      
      if (priceAtBuy < priceBefore * 0.95) {  // Price down >5%
        dipBuys++;
      }
    }
  }
  
  return totalBuys > 0 ? dipBuys / totalBuys : 0;
}

function calculateProfitTakingScore(
  balanceHistory: Array<{ timestamp: number; balance: number }>,
  priceHistory: Array<{ timestamp: number; price: number }>
): number {
  let profitTakes = 0;
  let totalSells = 0;
  
  for (let i = 1; i < balanceHistory.length; i++) {
    const balanceDelta = balanceHistory[i].balance - balanceHistory[i - 1].balance;
    
    if (balanceDelta < 0) {
      totalSells++;
      
      // Check if price was rising
      const priceAtSell = findClosestPrice(priceHistory, balanceHistory[i].timestamp);
      const priceBefore = findClosestPrice(priceHistory, balanceHistory[i - 1].timestamp);
      
      if (priceAtSell > priceBefore * 1.1) {  // Price up >10%
        profitTakes++;
      }
    }
  }
  
  return totalSells > 0 ? profitTakes / totalSells : 0;
}
```

### 4.3 Codex Data Integration

```typescript
// getTokenEvents - useful for tracking specific token transfers
const GET_TOKEN_EVENTS_QUERY = `
  query GetTokenEvents($input: TokenEventsInput!) {
    getTokenEvents(input: $input) {
      items {
        eventType
        timestamp
        maker
        amount
        amountUsd
        transactionHash
      }
      pageInfo {
        hasNextPage
        cursor
      }
    }
  }
`;

// getTokenEventsForMaker - track a specific wallet's activity
const GET_MAKER_EVENTS_QUERY = `
  query GetMakerEvents($input: TokenEventsForMakerInput!) {
    getTokenEventsForMaker(input: $input) {
      items {
        tokenAddress
        eventType  # buy, sell, transfer_in, transfer_out
        timestamp
        amount
        amountUsd
        priceAtEvent
        transactionHash
      }
    }
  }
`;

interface EnrichedWalletActivity {
  address: string;
  events: Array<{
    timestamp: number;
    type: "buy" | "sell" | "transfer_in" | "transfer_out";
    amount: number;
    priceAtEvent: number;
    usdValue: number;
  }>;
  summary: {
    totalBuys: number;
    totalSells: number;
    avgBuyPrice: number;
    avgSellPrice: number;
    realizedPnl: number;
    unrealizedPnl: number;
    costBasis: number;
  };
}

async function enrichWalletActivity(
  codexClient: CodexClient,
  walletAddress: string,
  tokenAddress: string,
  currentPrice: number
): Promise<EnrichedWalletActivity> {
  // Fetch events using getTokenEventsForMaker
  // Note: This is pseudocode - actual implementation depends on Codex API
  
  const events = await codexClient.query(GET_MAKER_EVENTS_QUERY, {
    input: {
      maker: walletAddress,
      tokenAddress: tokenAddress,
      networkId: 1399811149,  // Solana
    }
  });
  
  // Calculate summary metrics
  let totalBought = 0;
  let totalSold = 0;
  let totalBuyValue = 0;
  let totalSellValue = 0;
  let currentBalance = 0;
  
  for (const event of events.items) {
    if (event.eventType === "buy" || event.eventType === "transfer_in") {
      totalBought += event.amount;
      totalBuyValue += event.amountUsd;
      currentBalance += event.amount;
    } else if (event.eventType === "sell" || event.eventType === "transfer_out") {
      totalSold += event.amount;
      totalSellValue += event.amountUsd;
      currentBalance -= event.amount;
    }
  }
  
  const avgBuyPrice = totalBought > 0 ? totalBuyValue / totalBought : 0;
  const avgSellPrice = totalSold > 0 ? totalSellValue / totalSold : 0;
  const realizedPnl = totalSellValue - (totalSold * avgBuyPrice);
  const unrealizedPnl = currentBalance * (currentPrice - avgBuyPrice);
  
  return {
    address: walletAddress,
    events: events.items,
    summary: {
      totalBuys: totalBought,
      totalSells: totalSold,
      avgBuyPrice,
      avgSellPrice,
      realizedPnl,
      unrealizedPnl,
      costBasis: totalBuyValue - totalSellValue,
    },
  };
}
```

---

## 5. Implementation Recommendations

### 5.1 Data Collection Strategy

1. **Daily Snapshots**: Store top 500 holders daily for historical analysis
2. **Event Streaming**: Subscribe to real-time transfer events for active alerting
3. **Price Correlation**: Always store price at snapshot time for behavior analysis

### 5.2 Alert System Triggers

| Event | Threshold | Priority |
|-------|-----------|----------|
| Whale accumulation spike | >5% supply acquired in 24h | High |
| Multiple whales selling | >3 whales sell >10% in same day | High |
| New whale entry | First-time >1% holder | Medium |
| Whale exit | >1% holder goes to 0 | Medium |
| Concentration increase | Gini increases >0.05 in week | Low |
| SMFI divergence | SMFI < -50 while price stable | High |

### 5.3 Recommended Codex Query Patterns

```typescript
// Efficient batch querying for multiple tokens
async function batchFetchWhaleData(
  codexClient: CodexClient,
  tokenAddresses: string[]
): Promise<Map<string, WhaleData>> {
  // Use Promise.all with rate limiting
  const results = new Map<string, WhaleData>();
  
  // Process in batches of 5 to respect rate limits
  const batchSize = 5;
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (addr) => {
        const [info, holders] = await Promise.all([
          codexClient.getTokenInfo(addr),
          codexClient.getTopHolders(addr, 200),
        ]);
        return { addr, info, holders };
      })
    );
    
    for (const { addr, info, holders } of batchResults) {
      results.set(addr, processWhaleData(info, holders));
    }
    
    // Brief delay between batches
    await new Promise(r => setTimeout(r, 200));
  }
  
  return results;
}
```

### 5.4 Storage Schema Recommendations

```sql
-- Whale snapshots table
CREATE TABLE whale_snapshots (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  whale_count INTEGER,
  total_whale_balance NUMERIC(30, 10),
  whale_supply_pct NUMERIC(10, 6),
  gini NUMERIC(10, 6),
  price_usd NUMERIC(20, 10),
  UNIQUE(token_address, timestamp)
);

-- Individual whale positions
CREATE TABLE whale_positions (
  id SERIAL PRIMARY KEY,
  snapshot_id INTEGER REFERENCES whale_snapshots(id),
  wallet_address VARCHAR(64) NOT NULL,
  balance NUMERIC(30, 10),
  percent_of_supply NUMERIC(10, 6),
  behavior_classification VARCHAR(50),
  cluster_id VARCHAR(50)
);

-- Whale clusters
CREATE TABLE whale_clusters (
  cluster_id VARCHAR(50) PRIMARY KEY,
  wallet_addresses TEXT[], -- Array of addresses
  cluster_type VARCHAR(50),
  confidence NUMERIC(5, 3),
  total_effective_supply_pct NUMERIC(10, 6),
  first_detected TIMESTAMP,
  last_updated TIMESTAMP
);
```

---

## 6. Summary

This document provides algorithms for:

1. **Dynamic whale thresholds** that adapt to token market cap and liquidity
2. **Moving average crossovers** on whale holdings for trend detection
3. **Volume-weighted accumulation/distribution** using on-chain transfers
4. **Holder-adapted OBV** for tracking smart money flow
5. **Smart Money Flow Index** composite indicator
6. **Cross-token whale overlap analysis** for portfolio insights
7. **Wallet clustering** to identify coordinated actors
8. **Enhanced behavioral classification** with price correlation

Key improvements over current implementation:
- Price-aware behavior classification
- Multi-factor composite indicators
- Cluster detection for true supply concentration
- Dynamic thresholds for different token profiles
- Divergence detection for early warning signals
