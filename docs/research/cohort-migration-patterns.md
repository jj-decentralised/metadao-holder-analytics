# Holder Cohort Analysis & Migration Patterns

Research document for analyzing holder behavior, cohort transitions, and migration patterns across 88 Solana tokens using Codex API data.

## Overview

This analysis uses two primary Codex API endpoints:
- **`getTokenEvents`**: Returns `{ timestamp, maker, priceUsd, labels }` for each trade event
- **`getHolders`**: Returns `{ address, balance, percentOwned }` for current holder snapshots

Combined with `getBars` for price data, we can build sophisticated holder behavior analytics.

---

## 1. Cohort Migration Analysis (Tier Transitions)

### Objective
Track how holders move between size tiers over time and build transition probability matrices.

### Tier Definitions
```typescript
// Based on percentOwned from getHolders
const TIERS = {
  fish:    { min: 0,     max: 0.01 },    // < 0.01% of supply
  dolphin: { min: 0.01,  max: 0.1 },     // 0.01% - 0.1%
  shark:   { min: 0.1,   max: 1.0 },     // 0.1% - 1%
  whale:   { min: 1.0,   max: 100 },     // > 1%
};
```

### Data Pipeline

#### Step 1: Build Historical Position Timeline
```typescript
interface WalletPosition {
  address: string;
  tokenId: string;
  timestamp: number;
  balance: number;
  percentOwned: number;
  tier: WalletCategory;
}

async function buildPositionTimeline(
  tokenAddress: string,
  fromTimestamp: number,
  toTimestamp: number
): Promise<WalletPosition[]> {
  // 1. Get all events in time range
  const events = await codex.getTokenEvents(
    tokenAddress,
    SOLANA_NETWORK_ID,
    fromTimestamp,
    toTimestamp,
    10000  // Max limit for comprehensive history
  );
  
  // 2. Group events by maker (wallet)
  const walletEvents = groupBy(events, 'maker');
  
  // 3. For each wallet, reconstruct position changes
  // Events with labels=['buy'] increase position
  // Events with labels=['sell'] decrease position
  
  // 4. Assign tier at each position snapshot
  return positions.map(pos => ({
    ...pos,
    tier: classifyTier(pos.percentOwned)
  }));
}
```

#### Step 2: Calculate Transition Matrix
```typescript
interface TransitionMatrix {
  tokenId: string;
  period: { from: number; to: number };
  transitions: {
    [fromTier: string]: {
      [toTier: string]: number;  // Count of transitions
    };
  };
  probabilities: {
    [fromTier: string]: {
      [toTier: string]: number;  // P(fromTier → toTier)
    };
  };
}

function calculateTransitionMatrix(
  startSnapshot: Map<string, WalletCategory>,
  endSnapshot: Map<string, WalletCategory>
): TransitionMatrix {
  const transitions = {
    fish: { fish: 0, dolphin: 0, shark: 0, whale: 0, exited: 0 },
    dolphin: { fish: 0, dolphin: 0, shark: 0, whale: 0, exited: 0 },
    shark: { fish: 0, dolphin: 0, shark: 0, whale: 0, exited: 0 },
    whale: { fish: 0, dolphin: 0, shark: 0, whale: 0, exited: 0 },
    new: { fish: 0, dolphin: 0, shark: 0, whale: 0 },
  };
  
  // Count transitions
  for (const [addr, startTier] of startSnapshot) {
    const endTier = endSnapshot.get(addr) ?? 'exited';
    transitions[startTier][endTier]++;
  }
  
  // New entrants
  for (const [addr, endTier] of endSnapshot) {
    if (!startSnapshot.has(addr)) {
      transitions.new[endTier]++;
    }
  }
  
  // Convert to probabilities (row-stochastic)
  return normalizeToRowProbabilities(transitions);
}
```

### Key Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **Graduation Rate** | P(fish→dolphin) + P(dolphin→shark) + P(shark→whale) | Holders moving up tiers |
| **Degradation Rate** | P(whale→shark) + P(shark→dolphin) + P(dolphin→fish) | Holders moving down tiers |
| **Tier Stickiness** | P(tier→tier) diagonal values | How stable each tier is |
| **Churn Rate** | P(tier→exited) for all tiers | Exit probability by tier |

### Cross-Category Comparison

Key hypothesis: **MetaDAO governance participants graduate tiers faster than VC-token holders.**

```typescript
async function compareMigrationRates(): Promise<CategoryComparison> {
  const categories = ['metadao', 'futarchy-dao', 'vc-backed', 'community'];
  const results: Record<string, TransitionMatrix[]> = {};
  
  for (const category of categories) {
    const tokens = ALL_TOKENS.filter(t => t.category === category);
    results[category] = await Promise.all(
      tokens.map(t => calculateTransitionMatrix(t.mintAddress, period))
    );
  }
  
  // Aggregate and compare graduation rates across categories
  return aggregateByCategory(results);
}
```

---

## 2. Holder Cohort Retention (By Entry Date)

### Objective
Build SaaS-style retention curves: What % of holders who entered in Month X are still holding after 30/60/90/180/365 days?

### Data Pipeline

#### Step 1: Identify Entry Dates from Events
```typescript
interface HolderEntry {
  address: string;
  tokenId: string;
  firstBuyTimestamp: number;
  firstBuyPriceUsd: number;
  cohortMonth: string;  // e.g., "2024-01"
}

async function identifyEntryDates(
  tokenAddress: string
): Promise<Map<string, HolderEntry>> {
  // Get full event history (paginate if needed)
  const events = await codex.getTokenEvents(
    tokenAddress,
    SOLANA_NETWORK_ID,
    undefined,  // from beginning
    undefined,  // to now
    10000
  );
  
  // Find first buy event for each maker
  const firstBuys = new Map<string, HolderEntry>();
  
  for (const event of events.sort((a, b) => a.timestamp - b.timestamp)) {
    if (event.labels.includes('buy') && !firstBuys.has(event.maker)) {
      firstBuys.set(event.maker, {
        address: event.maker,
        tokenId: tokenAddress,
        firstBuyTimestamp: event.timestamp,
        firstBuyPriceUsd: event.priceUsd,
        cohortMonth: formatMonth(event.timestamp),
      });
    }
  }
  
  return firstBuys;
}
```

#### Step 2: Calculate Retention at Checkpoints
```typescript
interface RetentionData {
  cohortMonth: string;
  totalEntrants: number;
  retention: {
    day30: number;   // % still holding after 30 days
    day60: number;
    day90: number;
    day180: number;
    day365: number;
  };
}

async function calculateCohortRetention(
  tokenAddress: string,
  cohortMonth: string,
  cohortEntries: HolderEntry[]
): Promise<RetentionData> {
  const cohortStart = getMonthStart(cohortMonth);
  const cohortAddresses = new Set(cohortEntries.map(e => e.address));
  
  // Get current holders
  const currentHolders = await codex.getHolders(tokenAddress);
  const currentAddresses = new Set(currentHolders.items.map(h => h.address));
  
  // For historical retention, need to check events
  // Holder is "retained" if they haven't sold 100% of position
  const checkpoints = [30, 60, 90, 180, 365];
  const retention: Record<string, number> = {};
  
  for (const days of checkpoints) {
    const checkDate = cohortStart + (days * 86400 * 1000);
    if (checkDate > Date.now()) {
      retention[`day${days}`] = null;  // Future checkpoint
      continue;
    }
    
    // Count how many cohort members still held at checkpoint
    const stillHolding = await countHoldersAtTimestamp(
      tokenAddress,
      cohortAddresses,
      checkDate
    );
    
    retention[`day${days}`] = stillHolding / cohortEntries.length;
  }
  
  return { cohortMonth, totalEntrants: cohortEntries.length, retention };
}
```

### Retention Matrix Visualization
```
Cohort     | D30   | D60   | D90   | D180  | D365
-----------|-------|-------|-------|-------|------
2024-01    | 78%   | 65%   | 52%   | 38%   | 24%
2024-02    | 82%   | 71%   | 58%   | 42%   | --
2024-03    | 75%   | 62%   | 48%   | --    | --
...
```

### Feasibility Analysis

**Can we compute this from getTokenEvents?**
- ✅ **Entry dates**: First buy event per wallet identifies entry
- ⚠️ **Retention check**: Need to track sells. If wallet sold 100%, they exited
- ⚠️ **Current status**: `getHolders` gives current snapshot, but not historical
- 💡 **Workaround**: Reconstruct position history from events, marking "exited" when cumulative sells >= cumulative buys

**Limitations:**
- Event pagination may be needed for high-volume tokens
- Historical holder snapshots not directly available (must reconstruct)
- Dust positions may create noise (use minimum balance threshold)

---

## 3. Wallet Overlap Analysis

### Objective
Identify wallets holding multiple tokens across our 88-token dataset and analyze portfolio compositions by holder type.

### Data Pipeline

#### Step 1: Build Cross-Token Holder Map
```typescript
interface WalletHoldings {
  address: string;
  holdings: Array<{
    tokenId: string;
    category: TokenCategory;
    balance: string;
    percentOwned: number;
  }>;
  portfolioComposition: {
    metadao: number;
    futarchyDao: number;
    vcBacked: number;
    community: number;
  };
}

async function buildWalletOverlapMap(): Promise<Map<string, WalletHoldings>> {
  const walletMap = new Map<string, WalletHoldings>();
  
  for (const token of ALL_TOKENS) {
    // Get top holders for each token (paginate for full list)
    let cursor: string | null = null;
    do {
      const response = await codex.getHolders(
        token.mintAddress,
        SOLANA_NETWORK_ID,
        100,
        cursor
      );
      
      for (const holder of response.items) {
        const existing = walletMap.get(holder.address) ?? {
          address: holder.address,
          holdings: [],
          portfolioComposition: { metadao: 0, futarchyDao: 0, vcBacked: 0, community: 0 },
        };
        
        existing.holdings.push({
          tokenId: token.id,
          category: token.category,
          balance: holder.balance,
          percentOwned: holder.percentOwned,
        });
        
        walletMap.set(holder.address, existing);
      }
      
      cursor = response.cursor;
    } while (cursor);
  }
  
  // Calculate portfolio compositions
  for (const wallet of walletMap.values()) {
    wallet.portfolioComposition = calculateComposition(wallet.holdings);
  }
  
  return walletMap;
}
```

#### Step 2: Analyze Overlap Patterns
```typescript
interface OverlapAnalysis {
  // Wallets holding tokens from multiple categories
  crossCategoryHolders: {
    metadaoAndVc: string[];
    metadaoAndCommunity: string[];
    futarchyOnly: string[];
    vcOnly: string[];
  };
  
  // Overlap statistics
  stats: {
    avgTokensPerWallet: number;
    avgCategoriesPerWallet: number;
    mostCommonPairs: Array<{ tokenA: string; tokenB: string; overlapCount: number }>;
  };
  
  // Futarchy participant analysis
  futarchyParticipants: {
    totalWallets: number;
    alsoHoldVc: number;
    alsoHoldCommunity: number;
    pureMetadao: number;
  };
}

function analyzeOverlap(walletMap: Map<string, WalletHoldings>): OverlapAnalysis {
  // Find wallets holding MetaDAO ecosystem tokens
  const metadaoHolders = [...walletMap.values()].filter(w =>
    w.holdings.some(h => h.category === 'metadao' || h.category === 'metadao-ico')
  );
  
  // Analyze their other holdings
  const futarchyAnalysis = {
    totalWallets: metadaoHolders.length,
    alsoHoldVc: metadaoHolders.filter(w => 
      w.holdings.some(h => h.category === 'vc-backed')
    ).length,
    alsoHoldCommunity: metadaoHolders.filter(w =>
      w.holdings.some(h => h.category === 'community')
    ).length,
    pureMetadao: metadaoHolders.filter(w =>
      w.holdings.every(h => h.category === 'metadao' || h.category === 'metadao-ico')
    ).length,
  };
  
  return { futarchyParticipants: futarchyAnalysis, ... };
}
```

### Key Questions to Answer
1. **Are MetaDAO holders also holding VC tokens?** What's the overlap %?
2. **Do futarchy participants have different portfolio compositions?** More diversified? More concentrated?
3. **Cross-pollination**: Which token pairs have the highest holder overlap?
4. **Category affinity**: Do holders of one category tend to hold others in the same category?

---

## 4. Entry/Exit Pattern Analysis

### Objective
Analyze when holders enter and exit relative to price movements.

### Data Pipeline

#### Step 1: Map Events to Price Quartiles
```typescript
interface EntryExitTiming {
  tokenId: string;
  entries: {
    inTopQuartile: number;      // Entered during top 25% of prices
    inBottomQuartile: number;   // Entered during bottom 25%
    inMiddle: number;
  };
  exits: {
    atLocalHigh: number;        // Sold within 5% of local ATH
    atLocalLow: number;         // Sold within 5% of local low
    duringDrawdown: number;     // Sold when price 20%+ below recent high
  };
}

async function analyzeEntryExitTiming(
  tokenAddress: string,
  timeRange: { from: number; to: number }
): Promise<EntryExitTiming> {
  // 1. Get price bars for the period
  const bars = await codex.getBars(
    `${tokenAddress}:${SOLANA_NETWORK_ID}`,
    timeRange.from,
    timeRange.to,
    '1D'
  );
  
  // Calculate price quartiles
  const prices = bars.c;
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const q25 = sortedPrices[Math.floor(prices.length * 0.25)];
  const q75 = sortedPrices[Math.floor(prices.length * 0.75)];
  
  // 2. Get events
  const events = await codex.getTokenEvents(
    tokenAddress,
    SOLANA_NETWORK_ID,
    timeRange.from,
    timeRange.to
  );
  
  // 3. Classify each event by price context
  const analysis = { entries: { ... }, exits: { ... } };
  
  for (const event of events) {
    const priceAtTime = getPriceAtTimestamp(bars, event.timestamp);
    const quartile = classifyQuartile(priceAtTime, q25, q75);
    
    if (event.labels.includes('buy')) {
      analysis.entries[quartile]++;
    } else if (event.labels.includes('sell')) {
      const context = getExitContext(bars, event.timestamp, priceAtTime);
      analysis.exits[context]++;
    }
  }
  
  return analysis;
}
```

#### Step 2: Price Context Classification
```typescript
function getExitContext(
  bars: CodexBar,
  timestamp: number,
  currentPrice: number
): 'atLocalHigh' | 'atLocalLow' | 'duringDrawdown' | 'neutral' {
  // Find recent high/low (30-day lookback)
  const lookbackDays = 30;
  const recentBars = getBarsInRange(bars, timestamp - 30 * 86400, timestamp);
  
  const recentHigh = Math.max(...recentBars.h);
  const recentLow = Math.min(...recentBars.l);
  
  const pctFromHigh = (recentHigh - currentPrice) / recentHigh;
  const pctFromLow = (currentPrice - recentLow) / recentLow;
  
  if (pctFromHigh < 0.05) return 'atLocalHigh';
  if (pctFromLow < 0.05) return 'atLocalLow';
  if (pctFromHigh > 0.20) return 'duringDrawdown';
  return 'neutral';
}
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| **Smart Entry Ratio** | % of entries in bottom price quartile |
| **FOMO Entry Ratio** | % of entries in top price quartile |
| **ATH Exit Rate** | % of exits near all-time highs |
| **Capitulation Rate** | % of exits during >20% drawdowns |

### Cross-Category Comparison
- **Hypothesis**: Community token holders exhibit more FOMO behavior
- **Hypothesis**: MetaDAO holders may show more rational entry timing due to futarchy exposure

---

## 5. Accumulation/Distribution Phase Detection

### Objective
Detect market phases using holder flow data (Wyckoff-style analysis).

### Data Pipeline

#### Step 1: Calculate Net Holder Flow
```typescript
interface HolderFlowPeriod {
  timestamp: number;
  newHolders: number;
  exitedHolders: number;
  netFlow: number;
  phase: 'accumulation' | 'distribution' | 'neutral';
}

async function detectPhases(
  tokenAddress: string,
  periodDays: number = 7
): Promise<HolderFlowPeriod[]> {
  const events = await codex.getTokenEvents(tokenAddress);
  
  // Group events by period
  const periods = groupByPeriod(events, periodDays);
  
  return periods.map(period => {
    // Track unique makers
    const buyers = new Set(period.filter(e => e.labels.includes('buy')).map(e => e.maker));
    const sellers = new Set(period.filter(e => e.labels.includes('sell')).map(e => e.maker));
    
    // New holders = bought but weren't in previous period
    // Exited = sold entire position (need position tracking)
    
    const netFlow = buyers.size - sellers.size;
    const phase = netFlow > threshold ? 'accumulation' 
                : netFlow < -threshold ? 'distribution' 
                : 'neutral';
    
    return { ...period, netFlow, phase };
  });
}
```

#### Step 2: Correlate with Price Action
```typescript
interface PhaseAnalysis {
  tokenId: string;
  phases: Array<{
    type: 'accumulation' | 'distribution';
    startTimestamp: number;
    endTimestamp: number;
    priceAtStart: number;
    priceAtEnd: number;
    priceChangeAfter30d: number;  // Predictive value
  }>;
  
  // Wyckoff-style metrics
  accumulationLeadsToPump: number;  // % of accumulation phases followed by >20% pump
  distributionLeadsToDump: number;  // % of distribution phases followed by >20% dump
}
```

### Phase Definitions

| Phase | Condition | Interpretation |
|-------|-----------|----------------|
| **Accumulation** | Net new holders > 2x exits for 2+ periods | Smart money buying |
| **Distribution** | Net exits > 2x new holders for 2+ periods | Smart money selling |
| **Markup** | Accumulation + price rising >10% | Bull phase confirmed |
| **Markdown** | Distribution + price falling >10% | Bear phase confirmed |

---

## 6. First-Mover Advantage Analysis

### Objective
Analyze whether early holders (first 10% by time) outperform later entrants.

### Data Pipeline

#### Step 1: Identify Early Holders
```typescript
interface FirstMoverAnalysis {
  tokenId: string;
  tokenAge: number;  // Days since first event
  
  earlyHolders: {
    count: number;
    stillHolding: number;
    stillHoldingPct: number;
    avgEntryPrice: number;
    currentValue: number;  // If still holding at current price
    realizedPnl: number;   // For those who sold
  };
  
  laterEntrants: {
    count: number;
    stillHolding: number;
    avgEntryPrice: number;
    currentValue: number;
  };
  
  firstMoverAdvantage: {
    entryPriceAdvantage: number;  // % difference in avg entry price
    retentionAdvantage: number;   // Difference in retention rates
    pnlAdvantage: number;         // Difference in P/L
  };
}

async function analyzeFirstMovers(tokenAddress: string): Promise<FirstMoverAnalysis> {
  const events = await codex.getTokenEvents(tokenAddress);
  const sortedByTime = events.sort((a, b) => a.timestamp - b.timestamp);
  
  // Find first 10% of buyers by time
  const buyers = sortedByTime.filter(e => e.labels.includes('buy'));
  const earlyThreshold = buyers.length * 0.1;
  
  const earlyBuyers = new Map<string, { timestamp: number; priceUsd: number }>();
  for (let i = 0; i < earlyThreshold; i++) {
    if (!earlyBuyers.has(buyers[i].maker)) {
      earlyBuyers.set(buyers[i].maker, {
        timestamp: buyers[i].timestamp,
        priceUsd: buyers[i].priceUsd,
      });
    }
  }
  
  // Check current holder status
  const currentHolders = await codex.getHolders(tokenAddress);
  const currentSet = new Set(currentHolders.items.map(h => h.address));
  
  const earlyStillHolding = [...earlyBuyers.keys()].filter(a => currentSet.has(a));
  
  // Calculate metrics
  return {
    earlyHolders: {
      count: earlyBuyers.size,
      stillHolding: earlyStillHolding.length,
      stillHoldingPct: earlyStillHolding.length / earlyBuyers.size,
      avgEntryPrice: mean([...earlyBuyers.values()].map(v => v.priceUsd)),
    },
    // ... compare with later entrants
  };
}
```

### Key Questions
1. **Do early holders still hold?** Higher retention = stronger conviction
2. **P/L advantage**: How much better off are early holders?
3. **Governance correlation**: Do MetaDAO early holders retain longer?

---

## 7. Whale Tracking & Coordination Analysis

### Objective
Detect potential whale coordination by analyzing timing patterns of large transactions.

### Data Pipeline

#### Step 1: Identify Whale Wallets
```typescript
async function identifyWhales(tokenAddress: string): Promise<string[]> {
  const holders = await codex.getHolders(tokenAddress);
  
  // Whales = top holders with >1% of supply
  return holders.items
    .filter(h => h.percentOwned >= 1.0)
    .map(h => h.address);
}
```

#### Step 2: Analyze Whale Event Clustering
```typescript
interface WhaleCoordinationAnalysis {
  tokenId: string;
  whaleAddresses: string[];
  
  coordinationEvents: Array<{
    timestamp: number;
    window: number;  // Time window in seconds
    whalesActing: string[];
    direction: 'buy' | 'sell' | 'mixed';
    totalVolume: number;
    priceImpact: number;
  }>;
  
  metrics: {
    avgWhalesPerCluster: number;
    clusterFrequency: number;  // Per month
    preMovementAccumulation: number;  // % of pumps preceded by whale buys
  };
}

async function analyzeWhaleCoordination(
  tokenAddress: string,
  whaleAddresses: string[]
): Promise<WhaleCoordinationAnalysis> {
  // Get events for whale wallets
  const events = await codex.getTokenEvents(tokenAddress);
  const whaleSet = new Set(whaleAddresses);
  const whaleEvents = events.filter(e => whaleSet.has(e.maker));
  
  // Find clusters (multiple whales acting within time window)
  const windowSeconds = 3600;  // 1 hour
  const clusters = findEventClusters(whaleEvents, windowSeconds);
  
  // Filter to clusters with 2+ whales
  const coordinationEvents = clusters.filter(c => 
    new Set(c.events.map(e => e.maker)).size >= 2
  );
  
  return { coordinationEvents, ... };
}
```

#### Step 3: Pre-Movement Detection
```typescript
interface PreMovementSignal {
  timestamp: number;
  whaleActivity: 'accumulating' | 'distributing';
  priceChangeNext7d: number;
  priceChangeNext30d: number;
  signalStrength: number;  // Based on volume and whale count
}

function detectPreMovementAccumulation(
  whaleEvents: CodexTokenEvent[],
  priceHistory: CodexBar
): PreMovementSignal[] {
  // Look for periods of heavy whale buying before price moves
  const signals: PreMovementSignal[] = [];
  
  // Group whale events by week
  const weeks = groupByWeek(whaleEvents);
  
  for (const [weekStart, events] of weeks) {
    const buys = events.filter(e => e.labels.includes('buy'));
    const sells = events.filter(e => e.labels.includes('sell'));
    
    if (buys.length > sells.length * 2) {
      // Heavy accumulation
      const priceAfter = getPriceAtTimestamp(priceHistory, weekStart + 7 * 86400);
      const priceBefore = getPriceAtTimestamp(priceHistory, weekStart);
      
      signals.push({
        timestamp: weekStart,
        whaleActivity: 'accumulating',
        priceChangeNext7d: (priceAfter - priceBefore) / priceBefore,
        signalStrength: buys.length / sells.length,
      });
    }
  }
  
  return signals;
}
```

### Coordination Metrics

| Metric | Formula | Significance |
|--------|---------|--------------|
| **Cluster Density** | # events in window / window size | Activity concentration |
| **Whale Overlap** | # unique whales in cluster | Coordination indicator |
| **Directional Alignment** | (buys - sells) / total | Are whales aligned? |
| **Pre-pump Accumulation** | Whale buys 7d before >20% pump | Predictive value |

---

## Implementation Priority

### Phase 1: Core Analytics
1. **Tier transition matrices** - Fundamental to understanding holder evolution
2. **Cohort retention curves** - Classic retention analysis
3. **Wallet overlap** - Cross-token portfolio analysis

### Phase 2: Advanced Analytics
4. **Entry/exit timing** - Price-relative behavior
5. **First-mover analysis** - Early holder advantages

### Phase 3: Predictive Analytics
6. **Accumulation/distribution detection** - Wyckoff phases
7. **Whale coordination** - Market microstructure

---

## API Rate Limiting Considerations

With 88 tokens and comprehensive analysis:
- `getHolders`: ~88 calls (+ pagination) = ~200-500 calls
- `getTokenEvents`: ~88 calls × time ranges = ~500-1000 calls
- `getBars`: ~88 calls = ~100 calls

**Total estimated**: 800-1600 API calls per full analysis run

**Mitigation strategies**:
1. Cache holder snapshots (refresh daily)
2. Batch event queries by date range
3. Use rate limiter (current: 30 req/min with 0.5s delay)
4. Prioritize high-value tokens for deep analysis

---

## Data Model Requirements

```typescript
// New types needed for cohort analysis
interface CohortSnapshot {
  tokenId: string;
  timestamp: number;
  cohortMonth: string;
  holders: Map<string, { balance: number; tier: WalletCategory }>;
}

interface TransitionEvent {
  address: string;
  tokenId: string;
  timestamp: number;
  fromTier: WalletCategory | 'new';
  toTier: WalletCategory | 'exited';
  priceUsd: number;
}

interface RetentionCohort {
  tokenId: string;
  entryMonth: string;
  entrantCount: number;
  retainedAt: { [days: number]: number };
}

interface WalletPortfolio {
  address: string;
  holdings: TokenHolding[];
  categories: Set<TokenCategory>;
  totalValueUsd: number;
}
```

---

## Expected Insights

### MetaDAO Hypothesis Testing
1. **Graduation rate**: Do MetaDAO holders upgrade tiers faster than VC-backed token holders?
2. **Retention**: Are futarchy participants more "sticky"?
3. **Portfolio composition**: Do MetaDAO holders have unique portfolio profiles?
4. **Entry timing**: Do governance participants show better market timing?

### Market Structure Insights
1. **Whale behavior**: Are whales coordinated? Predictive of price moves?
2. **Accumulation patterns**: Can we detect institutional accumulation?
3. **First-mover advantage**: How much does early participation matter?

### Comparative Analysis
- Compare all metrics across categories: metadao, futarchy-dao, vc-backed, community
- Identify governance model impact on holder behavior
- Build decentralization scoring incorporating behavioral metrics
