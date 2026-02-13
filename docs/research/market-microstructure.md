# Market Microstructure Analysis for Solana Token Trading

This document outlines market microstructure patterns extractable from the Codex API and their relationship to holder behavior in MetaDAO/futarchy tokens versus VC-backed tokens.

## Executive Summary

Market microstructure—the study of how trades are executed and prices formed—provides valuable signals about token holder composition and behavior. By analyzing order flow, trade sizes, liquidity, and trading patterns from Codex API data, we can:

1. Identify informed vs. uninformed trading activity
2. Measure decentralization through trading behavior (not just holder counts)
3. Detect whale accumulation/distribution before holder count changes
4. Compare institutional vs. retail participation across token categories

## Data Sources from Codex API

### Available Endpoints

| Endpoint | Key Fields | Microstructure Use |
|----------|-----------|-------------------|
| `getBars(symbol, from, to, resolution)` | OHLCV, buyVolume, sellVolume, buyers, sellers, transactions, liquidity | Order flow imbalance, trade size, intraday patterns |
| `getDetailedPairStats(pairAddress, networkId, duration, bucketCount)` | volume, buyVolume, sellVolume, buys, sells, buyers, sellers, liquidity, priceChange | Aggregate order flow, buyer/seller counts |
| `getTokenEvents(address, networkId, from, to, limit)` | timestamp, maker, priceUsd, labels | Individual trade analysis, informed trading detection |
| `listPairsForToken(tokenAddress)` | All DEX pairs with liquidity/volume | Venue fragmentation analysis |

### Resolution Options for getBars

- `1`, `5`, `15`, `30`, `60` (minutes)
- `240`, `720` (4h, 12h)
- `1D`, `7D` (daily, weekly)

---

## 1. Order Flow Imbalance

### Background

Order flow imbalance measures the directional pressure in trading activity. Persistent buy-side or sell-side dominance can predict future price movements and, importantly for our analysis, holder growth or decline.

### Academic Foundation

- **Kyle (1985)**: Established that informed traders hide their information by splitting orders, creating persistent order flow in one direction
- **Easley et al. (2012) VPIN**: Volume-synchronized Probability of Informed Trading detects toxic order flow

### Computation from Codex Data

```typescript
interface OrderFlowMetrics {
  buyVolume: number;
  sellVolume: number;
  netFlow: number;           // buyVolume - sellVolume
  imbalanceRatio: number;    // (buyVolume - sellVolume) / (buyVolume + sellVolume)
  buyerSellerRatio: number;  // buyers / sellers (from getDetailedPairStats)
}

async function computeOrderFlowImbalance(
  tokenAddress: string,
  from: number,
  to: number
): Promise<OrderFlowMetrics[]> {
  const stats = await codex.getDetailedPairStats(pairAddress, networkId, duration);
  
  return {
    buyVolume: stats.buyVolume,
    sellVolume: stats.sellVolume,
    netFlow: stats.buyVolume - stats.sellVolume,
    imbalanceRatio: (stats.buyVolume - stats.sellVolume) / 
                    (stats.buyVolume + stats.sellVolume),
    buyerSellerRatio: stats.buyers / stats.sellers
  };
}
```

### VPIN Approximation

While true VPIN requires tick-by-tick data with trade classification, we can approximate it using Codex's buy/sell volume breakdown:

```typescript
interface VPINMetrics {
  vpin: number;              // Approximated VPIN (0-1)
  toxicityLevel: 'low' | 'medium' | 'high';
  rollingImbalance: number[];
}

function computeApproximateVPIN(
  buyVolumes: number[],
  sellVolumes: number[],
  bucketSize: number = 50  // Number of volume buckets
): number {
  // Aggregate into volume buckets (not time buckets)
  const buckets: { buy: number; sell: number }[] = [];
  let currentBucket = { buy: 0, sell: 0 };
  let totalVolume = 0;
  const targetBucketVolume = buyVolumes.reduce((a, b) => a + b, 0) / bucketSize;
  
  for (let i = 0; i < buyVolumes.length; i++) {
    currentBucket.buy += buyVolumes[i];
    currentBucket.sell += sellVolumes[i];
    totalVolume += buyVolumes[i] + sellVolumes[i];
    
    if (totalVolume >= targetBucketVolume) {
      buckets.push({ ...currentBucket });
      currentBucket = { buy: 0, sell: 0 };
      totalVolume = 0;
    }
  }
  
  // VPIN = average |OI| across buckets
  const sumAbsImbalance = buckets.reduce((sum, b) => 
    sum + Math.abs(b.buy - b.sell) / (b.buy + b.sell), 0);
  
  return sumAbsImbalance / buckets.length;
}
```

### Hypothesis: Order Flow → Holder Growth

**H1**: Sustained positive order flow imbalance (more buying) precedes holder count increases by 1-3 days.

**H2**: Futarchy tokens show more balanced order flow (lower |imbalance|) than VC tokens due to decentralized governance reducing information asymmetry.

### Implementation Notes

- Use hourly `getBars` data for intraday imbalance
- Rolling 24h imbalance window for trend detection
- Compare imbalance during governance events (futarchy tokens should show information flowing to market)

---

## 2. Trade Size Distribution

### Background

Trade size distribution reveals the composition of market participants. Retail traders typically execute smaller trades while institutional players and whales execute larger ones.

### Size Categories (Suggested Thresholds)

| Category | USD Range | Interpretation |
|----------|-----------|----------------|
| Micro | < $100 | Bot activity, dust trades |
| Retail | $100 - $1,000 | Individual retail traders |
| Small Fish | $1,000 - $10,000 | Active retail, small funds |
| Medium | $10,000 - $100,000 | Professional traders, small institutions |
| Large | $100,000 - $1M | Institutional, whales |
| Whale | > $1M | Major institutional, market makers |

### Computation from Codex Data

```typescript
interface TradeSizeMetrics {
  averageTradeSize: number;
  medianTradeSize: number;  // Requires getTokenEvents
  tradeSizeStdDev: number;
  retailRatio: number;      // % of trades < $1k
  whaleRatio: number;       // % of trades > $100k
  sizeGini: number;         // Gini coefficient of trade sizes
}

// From getBars aggregate data
function computeAverageTradeSize(bars: CodexBar[]): number {
  const totalVolume = bars.reduce((sum, b) => sum + b.volume, 0);
  const totalTxns = bars.reduce((sum, b) => sum + (b.transactions || 0), 0);
  return totalVolume / totalTxns;
}

// From getTokenEvents for distribution
async function computeTradeSizeDistribution(
  tokenAddress: string,
  from: number,
  to: number
): Promise<Map<string, number>> {
  const events = await codex.getTokenEvents(tokenAddress, networkId, from, to, 1000);
  
  const buckets = new Map<string, number>([
    ['micro', 0], ['retail', 0], ['small', 0], 
    ['medium', 0], ['large', 0], ['whale', 0]
  ]);
  
  for (const event of events) {
    const size = event.priceUsd; // This is actually trade value
    if (size < 100) buckets.set('micro', buckets.get('micro')! + 1);
    else if (size < 1000) buckets.set('retail', buckets.get('retail')! + 1);
    else if (size < 10000) buckets.set('small', buckets.get('small')! + 1);
    else if (size < 100000) buckets.set('medium', buckets.get('medium')! + 1);
    else if (size < 1000000) buckets.set('large', buckets.get('large')! + 1);
    else buckets.set('whale', buckets.get('whale')! + 1);
  }
  
  return buckets;
}
```

### Hypothesis: Trade Size by Token Category

**H3**: VC-backed tokens have larger average trade sizes due to institutional investors and VCs moving larger positions.

**H4**: Community/futarchy tokens have higher retail trade ratios, indicating broader participation.

**H5**: Trade size Gini coefficient correlates with holder concentration Gini.

---

## 3. Intraday Trading Patterns

### Background

Different market participants trade at different times. Analyzing hourly volume patterns can reveal the geographic and demographic composition of traders.

### Time Zone Analysis

| UTC Hour Range | Primary Markets | Expected Activity |
|----------------|-----------------|-------------------|
| 00:00 - 07:00 | Asia (Tokyo, Hong Kong, Singapore) | Asian retail, institutions |
| 07:00 - 12:00 | Europe (London) | European institutions |
| 12:00 - 21:00 | Americas (NY, SF) | US retail and institutions |
| 21:00 - 00:00 | Overlap/Low activity | Mixed |

### Computation from Codex Data

```typescript
interface IntradayPattern {
  hourlyVolume: number[];      // 24 hours
  hourlyTxnCount: number[];
  peakHour: number;
  troughHour: number;
  asianSessionRatio: number;   // % volume in Asian hours
  usSessionRatio: number;      // % volume in US hours
  volumeAutocorrelation: number;
}

async function computeIntradayPatterns(
  tokenAddress: string,
  days: number = 30
): Promise<IntradayPattern> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;
  
  // Get hourly bars
  const bars = await codex.getBars(
    `${tokenAddress}:${SOLANA_NETWORK_ID}`,
    from,
    now,
    '60'
  );
  
  // Aggregate by hour of day
  const hourlyAggregates = Array(24).fill(0).map(() => ({ volume: 0, count: 0 }));
  
  for (let i = 0; i < bars.t.length; i++) {
    const hour = new Date(bars.t[i] * 1000).getUTCHours();
    hourlyAggregates[hour].volume += bars.volume[i];
    hourlyAggregates[hour].count += 1;
  }
  
  const hourlyVolume = hourlyAggregates.map(h => h.volume / Math.max(h.count, 1));
  const totalVolume = hourlyVolume.reduce((a, b) => a + b, 0);
  
  // Asian session: UTC 0-7
  const asianVolume = hourlyVolume.slice(0, 8).reduce((a, b) => a + b, 0);
  // US session: UTC 14-21
  const usVolume = hourlyVolume.slice(14, 22).reduce((a, b) => a + b, 0);
  
  return {
    hourlyVolume,
    hourlyTxnCount: [], // Would need txn data
    peakHour: hourlyVolume.indexOf(Math.max(...hourlyVolume)),
    troughHour: hourlyVolume.indexOf(Math.min(...hourlyVolume)),
    asianSessionRatio: asianVolume / totalVolume,
    usSessionRatio: usVolume / totalVolume,
    volumeAutocorrelation: computeAutocorrelation(hourlyVolume, 1)
  };
}

function computeAutocorrelation(series: number[], lag: number): number {
  const n = series.length - lag;
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (series[i] - mean) * (series[i + lag] - mean);
  }
  for (let i = 0; i < series.length; i++) {
    denominator += (series[i] - mean) ** 2;
  }
  
  return numerator / denominator;
}
```

### Hypothesis: Intraday Patterns by Category

**H6**: VC-backed tokens show more activity during US market hours (when VCs are active).

**H7**: Futarchy/governance tokens show volume spikes during proposal voting periods.

**H8**: Community tokens have more uniform 24h distribution (global retail base).

---

## 4. Price Impact Estimation

### Background

Price impact measures how much a trade moves the market price. Higher price impact indicates lower liquidity and potentially higher concentration of holdings (thin markets are dominated by whales).

### Academic Foundation

- **Amihud (2002)**: Illiquidity ratio = |return| / volume
- **Kyle (1985)**: Lambda = price change per unit of net order flow

### Computation from Codex Data

```typescript
interface PriceImpactMetrics {
  amihudRatio: number;         // Daily avg |return|/volume
  kyleLambda: number;          // Regression: price change vs net flow
  impactPerMillion: number;    // Estimated price impact per $1M trade
  depthScore: number;          // Inverse of impact (higher = more liquid)
}

async function computeAmihudIlliquidity(
  tokenAddress: string,
  days: number = 30
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;
  
  const bars = await codex.getBars(
    `${tokenAddress}:${SOLANA_NETWORK_ID}`,
    from,
    now,
    '1D'
  );
  
  let sumRatio = 0;
  let count = 0;
  
  for (let i = 1; i < bars.c.length; i++) {
    const dailyReturn = Math.abs((bars.c[i] - bars.c[i-1]) / bars.c[i-1]);
    const dailyVolume = bars.volume[i];
    
    if (dailyVolume > 0) {
      sumRatio += dailyReturn / dailyVolume;
      count++;
    }
  }
  
  return sumRatio / count; // Higher = less liquid
}

async function estimateKyleLambda(
  pairAddress: string,
  days: number = 30
): Promise<number> {
  // Get bucketed stats for regression
  const stats = await codex.getDetailedPairStats(
    pairAddress,
    SOLANA_NETWORK_ID,
    days * 24 * 60 * 60,
    days  // One bucket per day
  );
  
  // Simple OLS: priceChange = alpha + lambda * netFlow
  // Lambda represents price sensitivity to order flow
  const netFlow = stats.buyVolume - stats.sellVolume;
  const priceChange = stats.priceChange;
  
  // Would need multiple observations for proper regression
  // Single-point estimate:
  return priceChange / (netFlow / (stats.buyVolume + stats.sellVolume));
}
```

### Hypothesis: Liquidity and Concentration

**H9**: Tokens with higher Amihud illiquidity ratios have higher holder concentration (whales avoid illiquid markets or create them).

**H10**: Price impact increases non-linearly as holder concentration increases.

---

## 5. Bid-Ask Spread Proxy

### Background

Bid-ask spreads represent trading costs. Wider spreads discourage small traders, potentially leading to fewer but larger holders.

### Academic Foundation

- **Corwin-Schultz (2012)**: High-Low spread estimator using OHLCV data

### Computation from Codex Data

The Corwin-Schultz estimator uses the intuition that daily high prices are usually ask prices and daily lows are usually bid prices.

```typescript
interface SpreadMetrics {
  corwinSchultzSpread: number;  // Estimated daily spread
  highLowRatio: number;         // Simple (H-L)/((H+L)/2)
  volatilityAdjustedSpread: number;
}

function computeCorwinSchultzSpread(bars: CodexBar[]): number {
  // CS Estimator: S = (2*(e^α - 1)) / (1 + e^α)
  // where α = (sqrt(2*β) - sqrt(β)) / (3 - 2*sqrt(2)) - sqrt(γ/(3-2*sqrt(2)))
  
  const spreads: number[] = [];
  
  for (let i = 1; i < bars.t.length; i++) {
    const H_t = bars.h[i];
    const L_t = bars.l[i];
    const H_t1 = bars.h[i - 1];
    const L_t1 = bars.l[i - 1];
    
    // Two-day high and low
    const H_2d = Math.max(H_t, H_t1);
    const L_2d = Math.min(L_t, L_t1);
    
    // Beta = sum of squared log(H/L) for each day
    const beta = Math.log(H_t / L_t) ** 2 + Math.log(H_t1 / L_t1) ** 2;
    
    // Gamma = log(H_2d / L_2d)^2
    const gamma = Math.log(H_2d / L_2d) ** 2;
    
    // Alpha calculation
    const sqrt2 = Math.sqrt(2);
    const denom = 3 - 2 * sqrt2;
    const alpha = (Math.sqrt(2 * beta) - Math.sqrt(beta)) / denom 
                  - Math.sqrt(gamma / denom);
    
    // Spread estimate
    if (alpha > 0) {
      const spread = 2 * (Math.exp(alpha) - 1) / (1 + Math.exp(alpha));
      spreads.push(spread);
    }
  }
  
  // Return average spread
  return spreads.length > 0 
    ? spreads.reduce((a, b) => a + b, 0) / spreads.length 
    : 0;
}
```

### Hypothesis: Spreads and Holder Distribution

**H11**: Wider implied spreads correlate with fewer total holders (higher trading costs discourage retail).

**H12**: Futarchy tokens may have narrower spreads due to better price discovery from governance markets.

---

## 6. Informed Trading Detection

### Background

Informed traders have superior information and trade before price moves. Detecting informed trading helps identify:
- Insider activity (especially relevant for VC tokens)
- Governance-related information trading (futarchy tokens)
- Market manipulation patterns

### Academic Foundation

- **Easley, Kiefer, O'Hara (1997)**: PIN (Probability of Informed Trading) model

### Computation from Codex Data

```typescript
interface InformedTradingMetrics {
  prePriceMoveTrades: TradeCluster[];
  consistentWinners: WalletStats[];
  eventDayAnomalies: number;
  estimatedPIN: number;
}

interface TradeCluster {
  startTime: number;
  endTime: number;
  netFlow: number;
  subsequentPriceMove: number;
  informedScore: number;
}

interface WalletStats {
  address: string;
  tradeCount: number;
  winRate: number;          // % of trades before favorable moves
  avgAdvantage: number;     // Avg price improvement vs next hour
  informedProbability: number;
}

async function detectInformedTrading(
  tokenAddress: string,
  lookbackDays: number = 30
): Promise<InformedTradingMetrics> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - lookbackDays * 24 * 60 * 60;
  
  // Get all trade events
  const events = await codex.getTokenEvents(tokenAddress, SOLANA_NETWORK_ID, from, now, 10000);
  
  // Get price data for subsequent moves
  const bars = await codex.getBars(
    `${tokenAddress}:${SOLANA_NETWORK_ID}`,
    from,
    now,
    '60'  // Hourly for price moves
  );
  
  // Track each wallet's trading performance
  const walletStats = new Map<string, {
    trades: { timestamp: number; isBuy: boolean; price: number }[];
  }>();
  
  for (const event of events) {
    const wallet = event.maker;
    if (!walletStats.has(wallet)) {
      walletStats.set(wallet, { trades: [] });
    }
    
    walletStats.get(wallet)!.trades.push({
      timestamp: event.timestamp,
      isBuy: event.labels.includes('buy'),
      price: event.priceUsd
    });
  }
  
  // Analyze each wallet for informed trading patterns
  const consistentWinners: WalletStats[] = [];
  
  for (const [address, stats] of walletStats) {
    if (stats.trades.length < 5) continue;  // Need minimum trades
    
    let wins = 0;
    let totalAdvantage = 0;
    
    for (const trade of stats.trades) {
      // Find price 1 hour later
      const futureBar = bars.t.findIndex(t => t > trade.timestamp + 3600);
      if (futureBar === -1) continue;
      
      const futurePrice = bars.c[futureBar];
      const priceChange = (futurePrice - trade.price) / trade.price;
      
      // Win = bought before price up, or sold before price down
      const isWin = (trade.isBuy && priceChange > 0.01) || 
                    (!trade.isBuy && priceChange < -0.01);
      
      if (isWin) {
        wins++;
        totalAdvantage += Math.abs(priceChange);
      }
    }
    
    const winRate = wins / stats.trades.length;
    
    // Flag wallets with > 60% win rate (significant above random 50%)
    if (winRate > 0.6 && stats.trades.length >= 10) {
      consistentWinners.push({
        address,
        tradeCount: stats.trades.length,
        winRate,
        avgAdvantage: totalAdvantage / wins,
        informedProbability: calculateInformedProbability(winRate, stats.trades.length)
      });
    }
  }
  
  return {
    prePriceMoveTrades: [], // Would cluster trades before big moves
    consistentWinners: consistentWinners.sort((a, b) => b.winRate - a.winRate),
    eventDayAnomalies: 0,   // Would detect abnormal volume on event days
    estimatedPIN: estimatePIN(events)
  };
}

function calculateInformedProbability(winRate: number, n: number): number {
  // Binomial probability that win rate this high is due to skill vs chance
  // Using normal approximation for large n
  const p = 0.5;  // Null hypothesis: random
  const z = (winRate - p) / Math.sqrt(p * (1 - p) / n);
  
  // One-tailed test: P(Z > z)
  return 1 - normalCDF(z);
}

function estimatePIN(events: CodexTokenEvent[]): number {
  // Simplified PIN estimation
  // Real PIN requires maximum likelihood estimation
  // This is a heuristic based on order flow imbalance persistence
  
  const hourlyBuckets = new Map<number, { buys: number; sells: number }>();
  
  for (const event of events) {
    const hour = Math.floor(event.timestamp / 3600);
    if (!hourlyBuckets.has(hour)) {
      hourlyBuckets.set(hour, { buys: 0, sells: 0 });
    }
    
    const bucket = hourlyBuckets.get(hour)!;
    if (event.labels.includes('buy')) {
      bucket.buys++;
    } else {
      bucket.sells++;
    }
  }
  
  // PIN proxy: average absolute imbalance
  let sumImbalance = 0;
  for (const bucket of hourlyBuckets.values()) {
    const total = bucket.buys + bucket.sells;
    if (total > 0) {
      sumImbalance += Math.abs(bucket.buys - bucket.sells) / total;
    }
  }
  
  return sumImbalance / hourlyBuckets.size;
}

function normalCDF(z: number): number {
  // Approximation of standard normal CDF
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  
  return 0.5 * (1 + sign * y);
}
```

### Hypothesis: Informed Trading by Token Category

**H13**: VC-backed tokens show higher PIN estimates due to information asymmetry from insiders.

**H14**: Futarchy tokens show informed trading spikes around governance events (but information eventually becomes public via governance mechanisms).

---

## 7. Fragmentation and Venue Analysis

### Background

Token trading can be fragmented across multiple DEX pools. The distribution of liquidity and volume across venues affects price discovery, trading costs, and potentially holder behavior.

### Computation from Codex Data

```typescript
interface VenueFragmentation {
  totalPairs: number;
  activePairs: number;              // Pairs with >$1k daily volume
  venueHHI: number;                 // Herfindahl-Hirschman Index of volume
  topVenueConcentration: number;   // % volume on top venue
  liquidityWeightedVenues: number; // Effective number of venues
  exchanges: Map<string, VenueStats>;
}

interface VenueStats {
  exchange: string;
  pairCount: number;
  totalLiquidity: number;
  totalVolume24h: number;
  volumeShare: number;
}

async function analyzeVenueFragmentation(
  tokenAddress: string
): Promise<VenueFragmentation> {
  const pairs = await codex.listPairsForToken(tokenAddress);
  
  // Aggregate by exchange
  const exchangeStats = new Map<string, VenueStats>();
  let totalVolume = 0;
  let totalLiquidity = 0;
  
  for (const pair of pairs) {
    const exchange = pair.exchange;
    
    if (!exchangeStats.has(exchange)) {
      exchangeStats.set(exchange, {
        exchange,
        pairCount: 0,
        totalLiquidity: 0,
        totalVolume24h: 0,
        volumeShare: 0
      });
    }
    
    const stats = exchangeStats.get(exchange)!;
    stats.pairCount++;
    stats.totalLiquidity += pair.liquidity;
    stats.totalVolume24h += pair.volume24;
    
    totalVolume += pair.volume24;
    totalLiquidity += pair.liquidity;
  }
  
  // Calculate volume shares and HHI
  let venueHHI = 0;
  for (const stats of exchangeStats.values()) {
    stats.volumeShare = stats.totalVolume24h / totalVolume;
    venueHHI += stats.volumeShare ** 2;
  }
  
  // Sort by volume
  const sortedExchanges = [...exchangeStats.values()]
    .sort((a, b) => b.totalVolume24h - a.totalVolume24h);
  
  return {
    totalPairs: pairs.length,
    activePairs: pairs.filter(p => p.volume24 > 1000).length,
    venueHHI,
    topVenueConcentration: sortedExchanges[0]?.volumeShare || 0,
    liquidityWeightedVenues: 1 / venueHHI,  // Effective number of venues
    exchanges: exchangeStats
  };
}
```

### Hypothesis: Fragmentation and Decentralization

**H15**: More fragmented trading (lower HHI) correlates with more decentralized holder distribution.

**H16**: VC-backed tokens may concentrate on specific exchanges due to market maker relationships.

---

## 8. Market Maker Behavior

### Background

Market makers provide liquidity by continuously buying and selling. Identifying market maker wallets helps distinguish liquidity provision from directional trading.

### Detection Criteria

1. **High frequency**: Many trades per day
2. **Balanced activity**: Similar buy and sell volumes
3. **Narrow spreads**: Trades clustered around mid-price
4. **Consistent presence**: Active across different market conditions

### Computation from Codex Data

```typescript
interface MarketMakerMetrics {
  identifiedMMs: MarketMakerProfile[];
  mmVolumeShare: number;
  mmConcentration: number;
  avgMMSpread: number;
}

interface MarketMakerProfile {
  address: string;
  dailyTrades: number;
  buyRatio: number;           // Should be close to 0.5
  volumeShare: number;
  avgTradeSize: number;
  spreadEstimate: number;     // Avg distance from mid
  confidenceScore: number;
}

async function identifyMarketMakers(
  tokenAddress: string,
  days: number = 7
): Promise<MarketMakerMetrics> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;
  
  const events = await codex.getTokenEvents(tokenAddress, SOLANA_NETWORK_ID, from, now, 10000);
  
  // Group by wallet
  const walletActivity = new Map<string, {
    buys: number;
    sells: number;
    buyVolume: number;
    sellVolume: number;
    prices: number[];
    timestamps: number[];
  }>();
  
  for (const event of events) {
    const wallet = event.maker;
    
    if (!walletActivity.has(wallet)) {
      walletActivity.set(wallet, {
        buys: 0, sells: 0,
        buyVolume: 0, sellVolume: 0,
        prices: [], timestamps: []
      });
    }
    
    const activity = walletActivity.get(wallet)!;
    activity.prices.push(event.priceUsd);
    activity.timestamps.push(event.timestamp);
    
    if (event.labels.includes('buy')) {
      activity.buys++;
      activity.buyVolume += event.priceUsd;
    } else {
      activity.sells++;
      activity.sellVolume += event.priceUsd;
    }
  }
  
  // Score each wallet as potential market maker
  const mmCandidates: MarketMakerProfile[] = [];
  
  for (const [address, activity] of walletActivity) {
    const totalTrades = activity.buys + activity.sells;
    const totalVolume = activity.buyVolume + activity.sellVolume;
    
    // Must have significant activity
    if (totalTrades < 20) continue;
    
    const buyRatio = activity.buys / totalTrades;
    const dailyTrades = totalTrades / days;
    
    // MM characteristics:
    // 1. High frequency (> 10 trades/day)
    // 2. Balanced (buy ratio between 0.4 and 0.6)
    // 3. Regular activity (low time variance)
    
    const isHighFrequency = dailyTrades > 10;
    const isBalanced = buyRatio > 0.4 && buyRatio < 0.6;
    
    // Calculate time regularity (lower = more regular)
    const timeDeltas: number[] = [];
    for (let i = 1; i < activity.timestamps.length; i++) {
      timeDeltas.push(activity.timestamps[i] - activity.timestamps[i-1]);
    }
    const avgDelta = timeDeltas.reduce((a, b) => a + b, 0) / timeDeltas.length;
    const deltaStdDev = Math.sqrt(
      timeDeltas.reduce((sum, d) => sum + (d - avgDelta) ** 2, 0) / timeDeltas.length
    );
    const regularityScore = 1 / (1 + deltaStdDev / avgDelta);
    
    // Confidence score
    const confidenceScore = (
      (isHighFrequency ? 0.3 : 0) +
      (isBalanced ? 0.3 : 0) +
      regularityScore * 0.4
    );
    
    if (confidenceScore > 0.5) {
      mmCandidates.push({
        address,
        dailyTrades,
        buyRatio,
        volumeShare: totalVolume / events.reduce((sum, e) => sum + e.priceUsd, 0),
        avgTradeSize: totalVolume / totalTrades,
        spreadEstimate: 0,  // Would need order book data
        confidenceScore
      });
    }
  }
  
  // Sort by confidence
  mmCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
  
  return {
    identifiedMMs: mmCandidates.slice(0, 10),  // Top 10
    mmVolumeShare: mmCandidates.reduce((sum, mm) => sum + mm.volumeShare, 0),
    mmConcentration: mmCandidates.length > 0 ? mmCandidates[0].volumeShare : 0,
    avgMMSpread: 0
  };
}
```

### Hypothesis: Market Makers by Token Category

**H17**: VC-backed tokens have more professional market makers (higher MM volume share, more concentrated MM activity).

**H18**: Community/futarchy tokens rely more on organic trading (lower MM share, more balanced participant types).

---

## 9. Combined Microstructure Score

### Aggregating Signals

```typescript
interface MicrostructureScore {
  overall: number;              // 0-100
  components: {
    liquidityScore: number;     // Based on Amihud, spread, depth
    informationScore: number;   // Based on PIN, informed trading
    participationScore: number; // Based on trade sizes, buyer/seller counts
    stabilityScore: number;     // Based on volatility, order flow persistence
    decentralizationScore: number; // Based on MM concentration, venue fragmentation
  };
  interpretation: string;
}

function computeMicrostructureScore(
  orderFlow: OrderFlowMetrics,
  tradeSize: TradeSizeMetrics,
  priceImpact: PriceImpactMetrics,
  spread: SpreadMetrics,
  informed: InformedTradingMetrics,
  fragmentation: VenueFragmentation,
  marketMakers: MarketMakerMetrics
): MicrostructureScore {
  // Liquidity: low Amihud + narrow spread = good
  const liquidityScore = Math.min(100, Math.max(0,
    100 - (priceImpact.amihudRatio * 1000000) - (spread.corwinSchultzSpread * 1000)
  ));
  
  // Information: low PIN = less informed trading = more fair
  const informationScore = Math.min(100, Math.max(0,
    100 - (informed.estimatedPIN * 200)
  ));
  
  // Participation: high retail ratio + many unique traders = good
  const participationScore = Math.min(100, Math.max(0,
    tradeSize.retailRatio * 50 + (1 - tradeSize.sizeGini) * 50
  ));
  
  // Stability: low imbalance persistence + low volatility
  const stabilityScore = Math.min(100, Math.max(0,
    100 - Math.abs(orderFlow.imbalanceRatio) * 100
  ));
  
  // Decentralization: low MM concentration + high fragmentation
  const decentralizationScore = Math.min(100, Math.max(0,
    (1 - marketMakers.mmConcentration) * 50 + 
    (1 - fragmentation.venueHHI) * 50
  ));
  
  const overall = (
    liquidityScore * 0.2 +
    informationScore * 0.2 +
    participationScore * 0.25 +
    stabilityScore * 0.15 +
    decentralizationScore * 0.2
  );
  
  return {
    overall,
    components: {
      liquidityScore,
      informationScore,
      participationScore,
      stabilityScore,
      decentralizationScore
    },
    interpretation: interpretScore(overall)
  };
}

function interpretScore(score: number): string {
  if (score >= 80) return 'Excellent market quality - broad participation, fair pricing, good liquidity';
  if (score >= 60) return 'Good market quality - some areas for improvement';
  if (score >= 40) return 'Moderate market quality - significant concentrated activity';
  if (score >= 20) return 'Poor market quality - dominated by few players, low liquidity';
  return 'Very poor market quality - high manipulation risk';
}
```

---

## 10. Relationship to Holder Behavior

### Key Correlations to Investigate

| Microstructure Signal | Holder Metric | Expected Relationship |
|-----------------------|---------------|----------------------|
| Order flow imbalance | Holder count change | Positive (buying → more holders) |
| Average trade size | Holder concentration | Positive (large trades → whales) |
| Retail trade ratio | Number of fish/dolphins | Positive |
| Amihud illiquidity | Gini coefficient | Positive (illiquid → concentrated) |
| PIN estimate | Insider holdings % | Positive |
| MM volume share | Price stability | Positive |
| Venue fragmentation | Geographic diversity | Positive (assumed) |

### Predictive Models

```typescript
interface HolderPrediction {
  predictedHolderChange: number;
  confidence: number;
  keyFactors: { name: string; impact: number }[];
}

function predictHolderChange(
  microstructure: MicrostructureScore,
  recentOrderFlow: OrderFlowMetrics[],
  currentHolderCount: number
): HolderPrediction {
  // Simple linear model based on order flow
  // In practice, would use ML with historical calibration
  
  const avgNetFlow = recentOrderFlow.reduce((sum, of) => 
    sum + of.imbalanceRatio, 0) / recentOrderFlow.length;
  
  // Heuristic: 10% net buy flow → ~5% holder growth
  const predictedGrowth = avgNetFlow * 0.5;
  const predictedChange = currentHolderCount * predictedGrowth;
  
  return {
    predictedHolderChange: Math.round(predictedChange),
    confidence: microstructure.components.stabilityScore / 100,
    keyFactors: [
      { name: 'Net Order Flow', impact: avgNetFlow },
      { name: 'Retail Participation', impact: microstructure.components.participationScore / 100 },
      { name: 'Market Quality', impact: microstructure.overall / 100 }
    ]
  };
}
```

---

## 11. Implementation Roadmap

### Phase 1: Data Collection
1. Set up scheduled jobs to collect hourly bars for all tracked tokens
2. Store getDetailedPairStats snapshots daily
3. Batch getTokenEvents collection (rate-limited)

### Phase 2: Metric Computation
1. Implement order flow imbalance tracking
2. Add trade size distribution analysis
3. Build intraday pattern recognition

### Phase 3: Advanced Analysis
1. VPIN approximation
2. Informed trading detection
3. Market maker identification

### Phase 4: Integration
1. Link microstructure metrics to holder dashboard
2. Create alerts for significant microstructure changes
3. Build comparison views (futarchy vs VC)

---

## References

1. Kyle, A.S. (1985). "Continuous Auctions and Insider Trading." *Econometrica*, 53(6), 1315-1335.

2. Easley, D., Kiefer, N.M., O'Hara, M., & Paperman, J.B. (1996). "Liquidity, Information, and Infrequently Traded Stocks." *Journal of Finance*, 51(4), 1405-1436.

3. Easley, D., López de Prado, M.M., & O'Hara, M. (2012). "Flow Toxicity and Liquidity in a High-Frequency World." *Review of Financial Studies*, 25(5), 1457-1493.

4. Amihud, Y. (2002). "Illiquidity and Stock Returns: Cross-Section and Time-Series Effects." *Journal of Financial Markets*, 5(1), 31-56.

5. Corwin, S.A., & Schultz, P. (2012). "A Simple Way to Estimate Bid-Ask Spreads from Daily High and Low Prices." *Journal of Finance*, 67(2), 719-760.

6. Hasbrouck, J. (2007). *Empirical Market Microstructure: The Institutions, Economics, and Econometrics of Securities Trading.* Oxford University Press.

---

## Appendix: Codex API Field Mapping

### getBars Extended Fields (when available)

```typescript
interface ExtendedCodexBar {
  // Standard OHLCV
  o: number[];      // Open prices
  h: number[];      // High prices
  l: number[];      // Low prices
  c: number[];      // Close prices
  t: number[];      // Unix timestamps
  volume: number[]; // Total volume
  
  // Extended fields (check availability)
  buyVolume?: number[];
  sellVolume?: number[];
  buyers?: number[];
  sellers?: number[];
  transactions?: number[];
  liquidity?: number[];
}
```

### getDetailedPairStats Response

```typescript
interface DetailedPairStatsResponse {
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
```

### getTokenEvents Response

```typescript
interface TokenEvent {
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  maker: string;
  priceUsd: number;
  labels: string[];  // e.g., ['buy', 'swap'], ['sell', 'swap']
}
```
