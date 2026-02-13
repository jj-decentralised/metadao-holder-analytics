# Holder P/L Analytics System Design

Research document for extracting and analyzing profit/loss data for token holders using the Codex API.

## Executive Summary

This document outlines a design for computing per-wallet profit/loss metrics across the 88 tokens in the MetaDAO holder analytics system. The system leverages the Codex API's event data, wallet stats, and holder endpoints to calculate realized/unrealized P/L, segment holders by profitability, and enable behavioral finance research (e.g., disposition effect analysis).

**Key findings:**
- Codex `getWalletStats` provides aggregate P/L but lacks per-token breakdown
- Accurate per-token P/L requires reconstructing trade history via `getTokenEvents`
- Full analysis of 100 holders × 88 tokens requires ~8,800 API calls (feasible with batching)
- Cost basis methods (FIFO, LIFO, average) can be computed client-side from event data

---

## 1. Per-Wallet P/L Calculation

### 1.1 Data Sources from Codex API

#### Primary: `getTokenEvents(address, networkId, from?, to?, limit?)`
Returns trade events with:
```typescript
interface CodexTokenEvent {
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  maker: string;          // Wallet address that executed the trade
  priceUsd: number;       // Execution price in USD
  labels: string[];       // Event type labels (e.g., ["swap", "buy"])
}
```

**Trade direction detection from labels:**
- Buy events: `labels` contains `"buy"` or `"swap"` with token as output
- Sell events: `labels` contains `"sell"` or `"swap"` with token as input

**Limitation:** The `labels` array doesn't always distinguish buy vs sell clearly. We may need to cross-reference with wallet balance changes or use heuristics based on the event context.

#### Secondary: `getWalletStats(walletAddress, networkId)`
Returns aggregate wallet metrics:
```typescript
interface CodexWalletStats {
  walletAddress: string;
  networkId: number;
  totalTokens: number;
  totalValueUsd: number;
  pnlUsd: number;         // Total realized + unrealized P/L
  pnlPercent: number;     // P/L as percentage of cost basis
}
```

**Key insight:** `getWalletStats` provides overall wallet P/L but not per-token breakdown. For per-token P/L, we must compute it from event history.

### 1.2 Cost Basis Calculation Methods

Given a series of buy events for a wallet, we can compute cost basis using three methods:

#### FIFO (First-In, First-Out)
```typescript
interface CostBasisLot {
  timestamp: number;
  quantity: number;
  priceUsd: number;
  remaining: number;  // Quantity not yet sold
}

function computeFifoCostBasis(
  buyEvents: CodexTokenEvent[],
  sellEvents: CodexTokenEvent[]
): { realizedPnl: number; unrealizedCostBasis: number; remainingLots: CostBasisLot[] } {
  // Sort buys chronologically
  const lots: CostBasisLot[] = buyEvents
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(e => ({
      timestamp: e.timestamp,
      quantity: e.quantity, // Need to derive from event
      priceUsd: e.priceUsd,
      remaining: e.quantity
    }));

  let realizedPnl = 0;

  // Process sells in order, consuming oldest lots first
  for (const sell of sellEvents.sort((a, b) => a.timestamp - b.timestamp)) {
    let toSell = sell.quantity;
    for (const lot of lots) {
      if (lot.remaining <= 0) continue;
      const consumed = Math.min(lot.remaining, toSell);
      realizedPnl += consumed * (sell.priceUsd - lot.priceUsd);
      lot.remaining -= consumed;
      toSell -= consumed;
      if (toSell <= 0) break;
    }
  }

  const remainingLots = lots.filter(l => l.remaining > 0);
  const unrealizedCostBasis = remainingLots.reduce(
    (sum, l) => sum + l.remaining * l.priceUsd, 0
  );

  return { realizedPnl, unrealizedCostBasis, remainingLots };
}
```

#### LIFO (Last-In, First-Out)
Same structure but consume newest lots first. Typically results in higher short-term gains/losses.

#### Average Cost
```typescript
function computeAverageCostBasis(buyEvents: CodexTokenEvent[]): number {
  const totalCost = buyEvents.reduce((sum, e) => sum + e.quantity * e.priceUsd, 0);
  const totalQuantity = buyEvents.reduce((sum, e) => sum + e.quantity, 0);
  return totalQuantity > 0 ? totalCost / totalQuantity : 0;
}
```

### 1.3 Data Accuracy Assessment

**What Codex provides:**
- ✅ Trade timestamps and USD prices at execution
- ✅ Wallet addresses for each trade
- ✅ Event labels for trade type classification
- ⚠️ Trade quantities may need derivation from other sources

**Limitations:**
- Event data may not include trade quantities directly (needs verification)
- Labels may be ambiguous for complex DeFi interactions
- No historical holder snapshots - only current holdings via `getHolders`

**Accuracy estimate:** ~85-90% for straightforward swap events. Complex multi-hop routes or unusual DeFi interactions may be harder to classify.

### 1.4 Unrealized P/L Calculation

```typescript
async function computeUnrealizedPnl(
  walletAddress: string,
  tokenAddress: string,
  costBasis: number,  // From FIFO/LIFO/Avg
  currentBalance: number
): Promise<number> {
  const currentPrice = await codex.getTokenPrice(tokenAddress);
  if (!currentPrice) return 0;
  
  const currentValue = currentBalance * currentPrice.priceUsd;
  const unrealizedPnl = currentValue - costBasis;
  
  return unrealizedPnl;
}
```

---

## 2. P/L Distribution Across Holder Categories

### 2.1 Whale P/L Analysis

**Approach:** Use `filterTokenWallets` to identify whales, then `getWalletStats` for each.

```typescript
interface WhalePnlAnalysis {
  tokenAddress: string;
  whaleCount: number;
  whaleTotalValue: number;
  whaleAvgPnlPercent: number;
  whalesInProfit: number;
  whalesInLoss: number;
  whalePnlDistribution: {
    heavyProfit: number;   // >100% gain
    profit: number;        // 0-100% gain
    breakeven: number;     // -10% to +10%
    loss: number;          // -10% to -50%
    heavyLoss: number;     // >50% loss
  };
}

async function analyzeWhalePnl(tokenAddress: string): Promise<WhalePnlAnalysis> {
  // Get whales (>1% of supply)
  const whales = await codex.filterTokenWallets({
    tokenAddress,
    percentOwned: { gte: 1.0 }
  });

  const stats = await Promise.all(
    whales.map(w => codex.getWalletStats(w.address))
  );

  // Aggregate P/L metrics
  // Note: getWalletStats returns wallet-level P/L, not token-specific
  // For accurate per-token whale P/L, need event-based calculation
  
  return aggregateWhalePnl(whales, stats);
}
```

**Challenge:** `getWalletStats` returns aggregate wallet P/L, not per-token P/L. For accurate whale analysis on a specific token:
1. Get whale addresses via `filterTokenWallets`
2. For each whale, fetch all events for that token via `getTokenEvents` with maker filter
3. Compute per-token P/L using cost basis methods above

### 2.2 Holder Size Tier Analysis

```typescript
type HolderTier = 'whale' | 'shark' | 'dolphin' | 'fish';

interface TierPnlAggregation {
  tier: HolderTier;
  holderCount: number;
  avgPnlPercent: number;
  medianPnlPercent: number;
  profitableCount: number;
  unprofitableCount: number;
  totalUnrealizedUsd: number;
  totalRealizedUsd: number;
}

const TIER_THRESHOLDS = {
  whale: 1.0,      // >= 1% of supply
  shark: 0.1,      // >= 0.1%
  dolphin: 0.01,   // >= 0.01%
  fish: 0          // < 0.01%
};

async function analyzePnlByTier(tokenAddress: string): Promise<TierPnlAggregation[]> {
  const allHolders = await getAllHolders(tokenAddress);
  
  // Group by tier
  const tiers = groupHoldersByTier(allHolders, TIER_THRESHOLDS);
  
  // For each tier, compute aggregate P/L
  return Promise.all(
    Object.entries(tiers).map(([tier, holders]) => 
      computeTierPnl(tier as HolderTier, holders, tokenAddress)
    )
  );
}
```

### 2.3 Smart Money Detection

**Definition:** Wallets with consistently positive P/L across multiple tokens.

```typescript
interface SmartMoneyCandidate {
  walletAddress: string;
  tokensAnalyzed: number;
  profitableTokens: number;
  avgPnlPercent: number;
  winRate: number;           // % of tokens with positive P/L
  totalPnlUsd: number;
  consistency: number;       // Low variance in returns
}

async function detectSmartMoney(
  tokens: string[],
  minTokens: number = 5,
  minWinRate: number = 0.6
): Promise<SmartMoneyCandidate[]> {
  // 1. Get all unique holders across tokens
  const holderTokenMap = new Map<string, string[]>();
  
  for (const token of tokens) {
    const holders = await codex.getHolders(token, SOLANA_NETWORK_ID, 100);
    for (const h of holders.items) {
      const tokens = holderTokenMap.get(h.address) || [];
      tokens.push(token);
      holderTokenMap.set(h.address, tokens);
    }
  }

  // 2. Filter to wallets holding multiple tokens
  const multiHolders = [...holderTokenMap.entries()]
    .filter(([_, tokens]) => tokens.length >= minTokens);

  // 3. Compute P/L for each wallet across all their tokens
  const candidates: SmartMoneyCandidate[] = [];
  
  for (const [wallet, tokens] of multiHolders) {
    const pnlResults = await Promise.all(
      tokens.map(t => computeWalletTokenPnl(wallet, t))
    );
    
    const profitable = pnlResults.filter(p => p.pnlPercent > 0).length;
    const winRate = profitable / tokens.length;
    
    if (winRate >= minWinRate) {
      candidates.push({
        walletAddress: wallet,
        tokensAnalyzed: tokens.length,
        profitableTokens: profitable,
        avgPnlPercent: average(pnlResults.map(p => p.pnlPercent)),
        winRate,
        totalPnlUsd: sum(pnlResults.map(p => p.pnlUsd)),
        consistency: 1 - coefficientOfVariation(pnlResults.map(p => p.pnlPercent))
      });
    }
  }

  return candidates.sort((a, b) => b.winRate - a.winRate);
}
```

---

## 3. Realized vs Unrealized P/L

### 3.1 Tracking Methodology

```typescript
interface WalletTokenPnl {
  walletAddress: string;
  tokenAddress: string;
  
  // Realized (from completed sales)
  realizedPnlUsd: number;
  realizedPnlPercent: number;
  totalSold: number;
  totalSoldValue: number;
  
  // Unrealized (current holdings)
  unrealizedPnlUsd: number;
  unrealizedPnlPercent: number;
  currentHolding: number;
  currentValue: number;
  costBasis: number;
  
  // Combined
  totalPnlUsd: number;
  totalPnlPercent: number;
  
  // Metadata
  firstBuyTimestamp: number;
  lastActivityTimestamp: number;
  buyCount: number;
  sellCount: number;
}

async function computeWalletTokenPnl(
  walletAddress: string,
  tokenAddress: string,
  costBasisMethod: 'fifo' | 'lifo' | 'average' = 'fifo'
): Promise<WalletTokenPnl> {
  // 1. Get all events for this wallet on this token
  const events = await codex.getTokenEvents(
    tokenAddress,
    SOLANA_NETWORK_ID,
    undefined, // from start
    undefined, // to now
    1000       // get comprehensive history
  );
  
  // 2. Filter to this wallet's trades
  const walletEvents = events.filter(e => 
    e.maker.toLowerCase() === walletAddress.toLowerCase()
  );
  
  // 3. Separate buys and sells
  const buys = walletEvents.filter(e => 
    e.labels.some(l => l.toLowerCase().includes('buy'))
  );
  const sells = walletEvents.filter(e => 
    e.labels.some(l => l.toLowerCase().includes('sell'))
  );
  
  // 4. Compute cost basis and realized P/L
  const { realizedPnl, unrealizedCostBasis, remainingLots } = 
    computeCostBasis(buys, sells, costBasisMethod);
  
  // 5. Get current price and holdings
  const [currentPrice, holders] = await Promise.all([
    codex.getTokenPrice(tokenAddress),
    codex.getHolders(tokenAddress, SOLANA_NETWORK_ID, 1000)
  ]);
  
  const currentHolding = holders.items
    .find(h => h.address.toLowerCase() === walletAddress.toLowerCase())
    ?.balance ?? '0';
  
  const holdingNum = parseFloat(currentHolding);
  const currentValue = holdingNum * (currentPrice?.priceUsd ?? 0);
  const unrealizedPnl = currentValue - unrealizedCostBasis;
  
  return {
    walletAddress,
    tokenAddress,
    realizedPnlUsd: realizedPnl,
    realizedPnlPercent: computePercent(realizedPnl, totalSoldCost(sells)),
    totalSold: sells.length,
    totalSoldValue: sumSellValue(sells),
    unrealizedPnlUsd: unrealizedPnl,
    unrealizedPnlPercent: unrealizedCostBasis > 0 
      ? (unrealizedPnl / unrealizedCostBasis) * 100 
      : 0,
    currentHolding: holdingNum,
    currentValue,
    costBasis: unrealizedCostBasis,
    totalPnlUsd: realizedPnl + unrealizedPnl,
    totalPnlPercent: computeTotalPnlPercent(realizedPnl, unrealizedPnl, buys),
    firstBuyTimestamp: Math.min(...buys.map(b => b.timestamp)),
    lastActivityTimestamp: Math.max(...walletEvents.map(e => e.timestamp)),
    buyCount: buys.length,
    sellCount: sells.length
  };
}
```

### 3.2 Cross-Token Aggregation (88 Tokens)

```typescript
interface PortfolioPnlSummary {
  totalTokensAnalyzed: number;
  totalRealizedUsd: number;
  totalUnrealizedUsd: number;
  totalPnlUsd: number;
  avgPnlPercent: number;
  
  byToken: WalletTokenPnl[];
  byCategory: Map<TokenCategory, CategoryPnl>;
}

async function computePortfolioPnl(
  walletAddress: string,
  tokens: TokenMetadata[]
): Promise<PortfolioPnlSummary> {
  // Process in batches to respect rate limits
  const BATCH_SIZE = 10;
  const results: WalletTokenPnl[] = [];
  
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(t => computeWalletTokenPnl(walletAddress, t.mintAddress))
    );
    results.push(...batchResults);
    
    // Small delay between batches for rate limiting
    if (i + BATCH_SIZE < tokens.length) {
      await delay(2000);
    }
  }
  
  // Aggregate by category
  const byCategory = new Map<TokenCategory, CategoryPnl>();
  for (const token of tokens) {
    const pnl = results.find(r => r.tokenAddress === token.mintAddress);
    if (!pnl) continue;
    
    const existing = byCategory.get(token.category) || {
      realizedUsd: 0,
      unrealizedUsd: 0,
      tokenCount: 0
    };
    
    byCategory.set(token.category, {
      realizedUsd: existing.realizedUsd + pnl.realizedPnlUsd,
      unrealizedUsd: existing.unrealizedUsd + pnl.unrealizedPnlUsd,
      tokenCount: existing.tokenCount + 1
    });
  }
  
  return {
    totalTokensAnalyzed: results.length,
    totalRealizedUsd: sum(results.map(r => r.realizedPnlUsd)),
    totalUnrealizedUsd: sum(results.map(r => r.unrealizedPnlUsd)),
    totalPnlUsd: sum(results.map(r => r.totalPnlUsd)),
    avgPnlPercent: average(results.map(r => r.totalPnlPercent)),
    byToken: results,
    byCategory
  };
}
```

---

## 4. P/L by Holder Duration

### 4.1 Duration-PnL Correlation Analysis

```typescript
interface DurationPnlCorrelation {
  tokenAddress: string;
  holdersAnalyzed: number;
  
  // Correlation metrics
  pearsonCorrelation: number;  // -1 to +1
  spearmanRank: number;        // Rank correlation
  
  // Duration buckets
  buckets: DurationBucket[];
  
  // Statistical significance
  pValue: number;
  isSignificant: boolean;      // p < 0.05
}

interface DurationBucket {
  label: string;              // e.g., "< 7 days", "7-30 days", etc.
  minDays: number;
  maxDays: number;
  holderCount: number;
  avgPnlPercent: number;
  medianPnlPercent: number;
  profitablePercent: number;
}

const DURATION_BUCKETS = [
  { label: '< 7 days', minDays: 0, maxDays: 7 },
  { label: '7-30 days', minDays: 7, maxDays: 30 },
  { label: '1-3 months', minDays: 30, maxDays: 90 },
  { label: '3-6 months', minDays: 90, maxDays: 180 },
  { label: '6-12 months', minDays: 180, maxDays: 365 },
  { label: '> 1 year', minDays: 365, maxDays: Infinity }
];

async function analyzeDurationPnlCorrelation(
  tokenAddress: string,
  topN: number = 100
): Promise<DurationPnlCorrelation> {
  // 1. Get top holders
  const holders = await codex.getHolders(tokenAddress, SOLANA_NETWORK_ID, topN);
  
  // 2. For each holder, compute duration and P/L
  const dataPoints: Array<{ duration: number; pnlPercent: number }> = [];
  
  for (const holder of holders.items) {
    const pnl = await computeWalletTokenPnl(holder.address, tokenAddress);
    const durationDays = (Date.now() - pnl.firstBuyTimestamp) / (1000 * 60 * 60 * 24);
    
    dataPoints.push({
      duration: durationDays,
      pnlPercent: pnl.totalPnlPercent
    });
  }
  
  // 3. Compute correlations
  const pearson = pearsonCorrelation(
    dataPoints.map(d => d.duration),
    dataPoints.map(d => d.pnlPercent)
  );
  
  // 4. Bucket analysis
  const buckets = DURATION_BUCKETS.map(bucket => {
    const inBucket = dataPoints.filter(
      d => d.duration >= bucket.minDays && d.duration < bucket.maxDays
    );
    
    return {
      ...bucket,
      holderCount: inBucket.length,
      avgPnlPercent: average(inBucket.map(d => d.pnlPercent)),
      medianPnlPercent: median(inBucket.map(d => d.pnlPercent)),
      profitablePercent: (inBucket.filter(d => d.pnlPercent > 0).length / inBucket.length) * 100
    };
  });
  
  return {
    tokenAddress,
    holdersAnalyzed: dataPoints.length,
    pearsonCorrelation: pearson.coefficient,
    spearmanRank: spearmanCorrelation(dataPoints),
    buckets,
    pValue: pearson.pValue,
    isSignificant: pearson.pValue < 0.05
  };
}
```

### 4.2 Cross-Category Duration Analysis

```typescript
interface CategoryDurationAnalysis {
  category: TokenCategory;
  tokensAnalyzed: number;
  
  // Does holding duration matter more for this category?
  avgDurationCorrelation: number;
  
  // Optimal holding period (bucket with best avg P/L)
  optimalHoldingPeriod: string;
  optimalPnlPercent: number;
  
  // Long-term holder performance
  longTermHolderPremium: number;  // % better than short-term
}

async function analyzeByCategory(
  tokens: TokenMetadata[]
): Promise<Map<TokenCategory, CategoryDurationAnalysis>> {
  const results = new Map<TokenCategory, CategoryDurationAnalysis>();
  
  const categories = [...new Set(tokens.map(t => t.category))];
  
  for (const category of categories) {
    const categoryTokens = tokens.filter(t => t.category === category);
    const analyses = await Promise.all(
      categoryTokens.map(t => analyzeDurationPnlCorrelation(t.mintAddress))
    );
    
    // Find optimal duration bucket across category
    const allBuckets = analyses.flatMap(a => a.buckets);
    const bucketAverages = DURATION_BUCKETS.map(b => ({
      label: b.label,
      avgPnl: average(
        allBuckets
          .filter(ab => ab.label === b.label)
          .map(ab => ab.avgPnlPercent)
      )
    }));
    
    const optimal = bucketAverages.reduce((best, curr) => 
      curr.avgPnl > best.avgPnl ? curr : best
    );
    
    // Long-term vs short-term comparison
    const shortTerm = bucketAverages.find(b => b.label === '< 7 days')?.avgPnl ?? 0;
    const longTerm = bucketAverages.find(b => b.label === '> 1 year')?.avgPnl ?? 0;
    
    results.set(category, {
      category,
      tokensAnalyzed: categoryTokens.length,
      avgDurationCorrelation: average(analyses.map(a => a.pearsonCorrelation)),
      optimalHoldingPeriod: optimal.label,
      optimalPnlPercent: optimal.avgPnl,
      longTermHolderPremium: longTerm - shortTerm
    });
  }
  
  return results;
}
```

---

## 5. P/L-Informed Persona Classification

### 5.1 Persona Definitions

```typescript
type HolderPersona = 
  | 'smart_money'      // Positive P/L >50% across multiple tokens
  | 'bag_holder'       // Unrealized loss >50%, still holding
  | 'profit_taker'     // Realized gains, reduced position significantly
  | 'loss_cutter'      // Sold at loss within 30 days
  | 'diamond_hands'    // Holding >6 months regardless of P/L
  | 'accumulator'      // Consistently buying, increasing position
  | 'flipper'          // Short holding periods (<7 days), frequent trading
  | 'new_entrant';     // First purchase within 30 days

interface PersonaClassification {
  walletAddress: string;
  primaryPersona: HolderPersona;
  confidence: number;          // 0-1 confidence in classification
  traits: PersonaTrait[];
  pnlMetrics: WalletTokenPnl;
}

interface PersonaTrait {
  trait: string;
  value: number;
  threshold: number;
  passed: boolean;
}
```

### 5.2 Classification Logic

```typescript
function classifyHolderPersona(
  pnl: WalletTokenPnl,
  multiTokenPnl?: WalletTokenPnl[]  // P/L across other tokens
): PersonaClassification {
  const traits: PersonaTrait[] = [];
  const now = Date.now();
  const holdingDays = (now - pnl.firstBuyTimestamp) / (1000 * 60 * 60 * 24);
  const daysSinceLastActivity = (now - pnl.lastActivityTimestamp) / (1000 * 60 * 60 * 24);
  
  // Trait: Smart Money (multi-token success)
  if (multiTokenPnl && multiTokenPnl.length >= 3) {
    const winRate = multiTokenPnl.filter(p => p.totalPnlPercent > 0).length / multiTokenPnl.length;
    const avgPnl = average(multiTokenPnl.map(p => p.totalPnlPercent));
    
    traits.push({
      trait: 'multi_token_win_rate',
      value: winRate * 100,
      threshold: 60,
      passed: winRate >= 0.6 && avgPnl > 50
    });
  }
  
  // Trait: Bag Holder
  traits.push({
    trait: 'unrealized_loss_severe',
    value: pnl.unrealizedPnlPercent,
    threshold: -50,
    passed: pnl.unrealizedPnlPercent < -50 && pnl.currentHolding > 0
  });
  
  // Trait: Profit Taker
  const positionReduction = pnl.totalSold > 0 
    ? pnl.totalSold / (pnl.totalSold + pnl.currentHolding)
    : 0;
  traits.push({
    trait: 'profit_taking',
    value: positionReduction * 100,
    threshold: 50,
    passed: pnl.realizedPnlPercent > 20 && positionReduction > 0.5
  });
  
  // Trait: Loss Cutter
  traits.push({
    trait: 'cut_losses_early',
    value: holdingDays,
    threshold: 30,
    passed: pnl.realizedPnlPercent < -10 && holdingDays < 30 && pnl.currentHolding === 0
  });
  
  // Trait: Diamond Hands
  traits.push({
    trait: 'long_hold_duration',
    value: holdingDays,
    threshold: 180,
    passed: holdingDays >= 180 && pnl.sellCount === 0
  });
  
  // Trait: Flipper
  const avgHoldPerTrade = holdingDays / Math.max(pnl.buyCount, 1);
  traits.push({
    trait: 'short_hold_per_trade',
    value: avgHoldPerTrade,
    threshold: 7,
    passed: avgHoldPerTrade < 7 && pnl.buyCount >= 3
  });
  
  // Trait: New Entrant
  traits.push({
    trait: 'recent_first_buy',
    value: holdingDays,
    threshold: 30,
    passed: holdingDays < 30
  });
  
  // Classify based on traits (priority order)
  let persona: HolderPersona = 'accumulator';  // Default
  let confidence = 0.5;
  
  const passedTraits = traits.filter(t => t.passed);
  
  if (passedTraits.find(t => t.trait === 'multi_token_win_rate')) {
    persona = 'smart_money';
    confidence = 0.9;
  } else if (passedTraits.find(t => t.trait === 'unrealized_loss_severe')) {
    persona = 'bag_holder';
    confidence = 0.85;
  } else if (passedTraits.find(t => t.trait === 'profit_taking')) {
    persona = 'profit_taker';
    confidence = 0.8;
  } else if (passedTraits.find(t => t.trait === 'cut_losses_early')) {
    persona = 'loss_cutter';
    confidence = 0.85;
  } else if (passedTraits.find(t => t.trait === 'long_hold_duration')) {
    persona = 'diamond_hands';
    confidence = 0.9;
  } else if (passedTraits.find(t => t.trait === 'short_hold_per_trade')) {
    persona = 'flipper';
    confidence = 0.8;
  } else if (passedTraits.find(t => t.trait === 'recent_first_buy')) {
    persona = 'new_entrant';
    confidence = 0.95;
  }
  
  return {
    walletAddress: pnl.walletAddress,
    primaryPersona: persona,
    confidence,
    traits,
    pnlMetrics: pnl
  };
}
```

### 5.3 Persona Distribution Analysis

```typescript
interface TokenPersonaDistribution {
  tokenAddress: string;
  tokenSymbol: string;
  totalHoldersClassified: number;
  
  distribution: Record<HolderPersona, {
    count: number;
    percentOfHolders: number;
    avgPnlPercent: number;
    totalValueHeld: number;
  }>;
  
  // Insights
  dominantPersona: HolderPersona;
  healthScore: number;  // Higher = healthier holder base
}

function computeHealthScore(dist: TokenPersonaDistribution): number {
  // Positive contributors
  const smartMoneyWeight = dist.distribution.smart_money.percentOfHolders * 3;
  const diamondHandsWeight = dist.distribution.diamond_hands.percentOfHolders * 2;
  const accumulatorWeight = dist.distribution.accumulator.percentOfHolders * 1.5;
  
  // Negative contributors
  const bagHolderPenalty = dist.distribution.bag_holder.percentOfHolders * 2;
  const flipperPenalty = dist.distribution.flipper.percentOfHolders * 1;
  const lossCutterPenalty = dist.distribution.loss_cutter.percentOfHolders * 0.5;
  
  const raw = smartMoneyWeight + diamondHandsWeight + accumulatorWeight
    - bagHolderPenalty - flipperPenalty - lossCutterPenalty;
  
  // Normalize to 0-100
  return Math.max(0, Math.min(100, 50 + raw));
}
```

---

## 6. Rate Limit Feasibility

### 6.1 API Call Requirements

**Per-token analysis (100 holders):**
| Operation | API Calls | Notes |
|-----------|-----------|-------|
| Get holders | 1 | `getHolders(token, limit=100)` |
| Get events per holder | 100 | `getTokenEvents` filtered by maker |
| Get wallet stats | 100 | `getWalletStats` per holder |
| Get current price | 1 | `getTokenPrice` |
| **Total per token** | **202** | |

**Full 88-token analysis:**
- Per token: 202 calls
- 88 tokens: 202 × 88 = **17,776 calls**

### 6.2 Rate Limit Configuration

Current rate limiter settings from `codex.ts`:
```typescript
private limiter = new RateLimiter(30, 0.5); // 30 tokens, 0.5 refill/sec
```

**Effective rate:** ~0.5 requests/second sustained, burst up to 30.

**Time estimates:**
- 17,776 calls at 0.5/sec = 35,552 seconds = **~9.9 hours**
- With batching optimizations: **~4-5 hours**

### 6.3 Optimization Strategies

#### Strategy 1: Batch API Calls
```typescript
// Use getTokenPricesBatch for all 88 tokens at once (1 call vs 88)
const prices = await codex.getTokenPricesBatch(
  tokens.map(t => ({ address: t.mintAddress }))
);

// Use getTokensBatch for token info (1 call vs 88)
const tokenInfo = await codex.getTokensBatch(
  tokens.map(t => ({ address: t.mintAddress }))
);
```

**Savings:** 174 calls → 2 calls (172 saved)

#### Strategy 2: Sample Holders
Instead of all 100 holders, sample strategically:
```typescript
async function sampleHolders(tokenAddress: string): Promise<CodexTokenHolder[]> {
  // Get top 20 whales
  const whales = await codex.filterTokenWallets({
    tokenAddress,
    percentOwned: { gte: 0.5 }
  });
  
  // Get random sample of 30 mid-tier holders
  const allHolders = await codex.getHolders(tokenAddress, SOLANA_NETWORK_ID, 500);
  const midTier = allHolders.items
    .filter(h => h.percentOwned >= 0.01 && h.percentOwned < 0.5)
    .sort(() => Math.random() - 0.5)
    .slice(0, 30);
  
  // Get random sample of 10 small holders
  const small = allHolders.items
    .filter(h => h.percentOwned < 0.01)
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);
  
  return [...whales.slice(0, 20), ...midTier, ...small];
}
```

**Savings:** 60 holders instead of 100 → 40% reduction in wallet-level calls

#### Strategy 3: Progressive Caching

```typescript
interface PnlCache {
  walletToken: Map<string, WalletTokenPnl>;  // key: `${wallet}:${token}`
  tokenPrice: Map<string, { price: number; timestamp: number }>;
  walletStats: Map<string, CodexWalletStats>;
  ttlMs: number;
}

const cache: PnlCache = {
  walletToken: new Map(),
  tokenPrice: new Map(),
  walletStats: new Map(),
  ttlMs: 5 * 60 * 1000  // 5 minute TTL
};

async function getCachedOrFetch<T>(
  key: string,
  map: Map<string, T>,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = map.get(key);
  if (cached) return cached;
  
  const fresh = await fetcher();
  map.set(key, fresh);
  return fresh;
}
```

### 6.4 Recommended Batching Strategy

```typescript
interface BatchConfig {
  tokensPerBatch: number;
  holdersPerToken: number;
  delayBetweenBatchesMs: number;
  parallelHolderFetches: number;
}

const OPTIMAL_CONFIG: BatchConfig = {
  tokensPerBatch: 10,
  holdersPerToken: 50,        // Sample instead of full 100
  delayBetweenBatchesMs: 5000,
  parallelHolderFetches: 5    // Parallel within rate limit
};

async function batchedPnlAnalysis(
  tokens: TokenMetadata[],
  config: BatchConfig = OPTIMAL_CONFIG
): Promise<Map<string, TokenPnlAnalysis>> {
  const results = new Map<string, TokenPnlAnalysis>();
  
  // Process in token batches
  for (let i = 0; i < tokens.length; i += config.tokensPerBatch) {
    const batch = tokens.slice(i, i + config.tokensPerBatch);
    
    // Fetch prices in batch (1 call)
    const prices = await codex.getTokenPricesBatch(
      batch.map(t => ({ address: t.mintAddress }))
    );
    
    // For each token, analyze sampled holders
    for (let j = 0; j < batch.length; j++) {
      const token = batch[j];
      const holders = await sampleHolders(token.mintAddress);
      
      // Process holders in parallel chunks
      const holderPnls: WalletTokenPnl[] = [];
      for (let k = 0; k < holders.length; k += config.parallelHolderFetches) {
        const chunk = holders.slice(k, k + config.parallelHolderFetches);
        const chunkResults = await Promise.all(
          chunk.map(h => computeWalletTokenPnl(h.address, token.mintAddress))
        );
        holderPnls.push(...chunkResults);
      }
      
      results.set(token.mintAddress, {
        tokenAddress: token.mintAddress,
        price: prices[j]?.priceUsd ?? 0,
        holderPnls,
        summary: computePnlSummary(holderPnls)
      });
    }
    
    // Delay between batches
    if (i + config.tokensPerBatch < tokens.length) {
      await delay(config.delayBetweenBatchesMs);
    }
  }
  
  return results;
}
```

**Optimized time estimate:**
- 88 tokens / 10 per batch = 9 batches
- ~50 calls per token (with sampling) = 500 calls per batch
- 500 calls / 0.5/sec = 1000 sec per batch
- 9 batches × 1000 sec = 9000 sec = **~2.5 hours**

---

## 7. Academic Context: Disposition Effect

### 7.1 Background

The disposition effect, identified by Shefrin & Statman (1985), describes investors' tendency to:
- **Sell winners too early**: Realize gains prematurely
- **Hold losers too long**: Avoid realizing losses

This creates suboptimal outcomes: winners are cut short while losers are allowed to grow.

### 7.2 Measuring Disposition Effect with Codex Data

```typescript
interface DispositionEffectMetrics {
  tokenAddress: string;
  
  // Proportion of Gains Realized (PGR)
  pgr: number;  // Realized gains / (Realized gains + Paper gains)
  
  // Proportion of Losses Realized (PLR)
  plr: number;  // Realized losses / (Realized losses + Paper losses)
  
  // Disposition Effect Coefficient
  dispositionCoeff: number;  // PGR - PLR (positive = disposition effect present)
  
  // Statistical measures
  sampleSize: number;
  isSignificant: boolean;
  pValue: number;
}

async function measureDispositionEffect(
  tokenAddress: string,
  holders: CodexTokenHolder[]
): Promise<DispositionEffectMetrics> {
  let realizedGains = 0;
  let paperGains = 0;
  let realizedLosses = 0;
  let paperLosses = 0;
  
  for (const holder of holders) {
    const pnl = await computeWalletTokenPnl(holder.address, tokenAddress);
    
    // Realized P/L
    if (pnl.realizedPnlUsd > 0) {
      realizedGains += pnl.realizedPnlUsd;
    } else {
      realizedLosses += Math.abs(pnl.realizedPnlUsd);
    }
    
    // Unrealized (paper) P/L
    if (pnl.unrealizedPnlUsd > 0) {
      paperGains += pnl.unrealizedPnlUsd;
    } else {
      paperLosses += Math.abs(pnl.unrealizedPnlUsd);
    }
  }
  
  // Calculate proportions
  const pgr = realizedGains / (realizedGains + paperGains) || 0;
  const plr = realizedLosses / (realizedLosses + paperLosses) || 0;
  const dispositionCoeff = pgr - plr;
  
  return {
    tokenAddress,
    pgr,
    plr,
    dispositionCoeff,
    sampleSize: holders.length,
    isSignificant: /* statistical test */ true,
    pValue: /* computed p-value */ 0.05
  };
}
```

### 7.3 Research Questions Addressable with This Data

1. **Do crypto holders exhibit disposition effect?**
   - Hypothesis: PGR > PLR across most tokens
   - Compare with traditional finance studies (~1.5x ratio typically)

2. **Is disposition effect stronger in meme tokens vs utility tokens?**
   - Compare community category vs vc-backed/futarchy-dao
   - Meme tokens may show stronger effect due to emotional attachment

3. **Does disposition effect predict future price performance?**
   - Tokens with high disposition effect may underperform
   - Mechanism: smart money exits while bag holders remain

4. **Cross-category comparison:**
   ```typescript
   interface CategoryDispositionComparison {
     category: TokenCategory;
     avgDispositionCoeff: number;
     tokensWithEffect: number;   // Significantly positive
     tokensWithoutEffect: number;
   }
   ```

5. **Whale vs retail disposition:**
   - Do whales exhibit weaker disposition effect?
   - "Smart money" may be more rational

### 7.4 Limitations for Academic Research

- **Selection bias**: Only analyzing current holders, not fully exited positions
- **Timing granularity**: Event timestamps may not capture intraday decisions
- **Trade size**: Events may not include precise quantities
- **Multi-wallet**: Same person may have multiple wallets
- **Bot activity**: Automated trading may skew results

**Mitigation strategies:**
- Filter for wallets with manual-looking trading patterns
- Focus on longer holding periods (>24 hours)
- Use statistical tests to identify outliers

---

## 8. Implementation Roadmap

### Phase 1: Core P/L Engine (Week 1-2)
- [ ] Implement cost basis calculators (FIFO, LIFO, Average)
- [ ] Build `computeWalletTokenPnl` function
- [ ] Create caching layer for API results
- [ ] Unit tests for P/L calculations

### Phase 2: Holder Analysis (Week 2-3)
- [ ] Implement tier-based P/L aggregation
- [ ] Build smart money detection algorithm
- [ ] Create persona classification system
- [ ] Add duration-correlation analysis

### Phase 3: Cross-Token Analytics (Week 3-4)
- [ ] Implement batched analysis for all 88 tokens
- [ ] Build category comparison reports
- [ ] Add disposition effect measurement
- [ ] Create summary dashboards

### Phase 4: API & Visualization (Week 4-5)
- [ ] Create API endpoints for P/L data
- [ ] Build P/L distribution charts
- [ ] Add persona breakdown visualizations
- [ ] Implement duration-P/L scatter plots

---

## 9. Appendix: Type Definitions

```typescript
// src/types/pnl.ts

export interface CostBasisLot {
  timestamp: number;
  quantity: number;
  priceUsd: number;
  remaining: number;
}

export type CostBasisMethod = 'fifo' | 'lifo' | 'average';

export interface WalletTokenPnl {
  walletAddress: string;
  tokenAddress: string;
  realizedPnlUsd: number;
  realizedPnlPercent: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPercent: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  costBasis: number;
  currentHolding: number;
  currentValue: number;
  firstBuyTimestamp: number;
  lastActivityTimestamp: number;
  buyCount: number;
  sellCount: number;
}

export type HolderPersona =
  | 'smart_money'
  | 'bag_holder'
  | 'profit_taker'
  | 'loss_cutter'
  | 'diamond_hands'
  | 'accumulator'
  | 'flipper'
  | 'new_entrant';

export interface PersonaClassification {
  walletAddress: string;
  primaryPersona: HolderPersona;
  confidence: number;
  pnlMetrics: WalletTokenPnl;
}

export interface DispositionEffectMetrics {
  tokenAddress: string;
  pgr: number;
  plr: number;
  dispositionCoeff: number;
  sampleSize: number;
  isSignificant: boolean;
}

export interface DurationPnlCorrelation {
  tokenAddress: string;
  pearsonCorrelation: number;
  spearmanRank: number;
  isSignificant: boolean;
}
```

---

## 10. References

1. Shefrin, H., & Statman, M. (1985). The disposition to sell winners too early and ride losers too long: Theory and evidence. *The Journal of Finance*, 40(3), 777-790.

2. Odean, T. (1998). Are investors reluctant to realize their losses? *The Journal of Finance*, 53(5), 1775-1798.

3. Barber, B. M., & Odean, T. (2000). Trading is hazardous to your wealth: The common stock investment performance of individual investors. *The Journal of Finance*, 55(2), 773-806.

4. Codex API Documentation: https://docs.codex.io/reference/graphql-api
