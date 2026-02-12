# Token Velocity and Correlation Metrics Research

This document outlines methodologies for computing token velocity, transfer frequency, price-holder correlation, and liquidity metrics using Codex API data for Solana tokens.

## 1. Token Velocity

### 1.1 Definition

Token velocity measures how frequently tokens change hands within a specific timeframe. It's derived from the monetary equation of exchange:

```
MV = PQ

Where:
- M = Token supply (circulating or total)
- V = Velocity
- P = Price level
- Q = Transaction quantity/volume
```

Rearranging for velocity:

```
V = Transaction Volume / Average Market Cap
```

Or equivalently:

```
V = Transaction Volume / (Token Price × Circulating Supply)
```

### 1.2 Computing Velocity from Codex Data

Using Codex API's `getTokenEvents` endpoint, we can compute velocity:

```typescript
interface VelocityMetrics {
  period: 'daily' | 'weekly' | 'monthly';
  transactionVolume: number;      // Sum of all transfer values in USD
  averageMarketCap: number;       // Average market cap over period
  velocity: number;               // Volume / MarketCap
  tokenVelocity: number;          // Total tokens moved / circulating supply
}

async function computeTokenVelocity(
  tokenAddress: string,
  periodDays: number
): Promise<VelocityMetrics> {
  // 1. Fetch token events from Codex
  const events = await codex.getTokenEvents({
    tokenAddress,
    from: Date.now() - periodDays * 86400000,
    to: Date.now()
  });
  
  // 2. Sum transaction volumes
  const transactionVolume = events.reduce((sum, e) => sum + e.amountUSD, 0);
  
  // 3. Get average market cap from price history
  const priceHistory = await codex.getBars(tokenAddress, periodDays, '1d');
  const avgMarketCap = priceHistory.reduce((sum, bar) => 
    sum + (bar.close * circulatingSupply), 0) / priceHistory.length;
  
  // 4. Calculate velocity
  return {
    period: periodDays === 1 ? 'daily' : periodDays === 7 ? 'weekly' : 'monthly',
    transactionVolume,
    averageMarketCap,
    velocity: transactionVolume / avgMarketCap,
    tokenVelocity: totalTokensMoved / circulatingSupply
  };
}
```

### 1.3 Velocity Interpretation

| Velocity Range | Interpretation | Token Type Example |
|----------------|----------------|-------------------|
| < 0.05 | Very low - store of value behavior | BTC (4.1%), ETH (3.6%) |
| 0.05 - 0.2 | Low - governance/staking tokens | Governance tokens like META |
| 0.2 - 0.5 | Medium - utility tokens with active use | DeFi utility tokens |
| 0.5 - 1.0 | High - active trading/speculation | Popular altcoins |
| > 1.0 | Very high - heavy speculation/trading | Meme tokens, BONK |

### 1.4 Expected Velocity Patterns by Token Type

**Governance Tokens (e.g., META, JTO, JUP)**
- Expected velocity: 0.05 - 0.15 monthly
- Low velocity indicates holders stake/hold for governance participation
- Spike in velocity around governance votes or major announcements
- MetaDAO tokens should show particularly low velocity due to futarchy mechanics

**Meme Tokens (e.g., BONK)**
- Expected velocity: 0.5 - 2.0+ monthly
- High velocity indicates speculative trading dominates
- Velocity often inversely correlated with price during accumulation
- Sharp velocity increases may precede price movements

**DeFi Utility Tokens (e.g., RAY, ORCA)**
- Expected velocity: 0.2 - 0.5 monthly
- Medium velocity reflects actual protocol usage
- Velocity correlates with protocol TVL and trading activity
- More stable velocity patterns than meme tokens

### 1.5 Velocity Reduction Mechanisms

Tokens with built-in velocity reduction tend to hold value better:
1. **Staking mechanisms** - Locks tokens, reducing circulating velocity
2. **Governance participation** - Holding required for voting
3. **Buy-and-burn** - Reduces supply over time
4. **Yield farming** - Incentivizes holding
5. **Vesting schedules** - VC tokens have locked allocations

---

## 2. Transfer Frequency Analysis

### 2.1 Daily Active Addresses (DAA)

DAA serves as a proxy for network activity and can be derived from Codex event data:

```typescript
interface TransferFrequencyMetrics {
  dailyActiveAddresses: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  transferCount: number;
  avgTransferSize: number;
  medianTransferSize: number;
}

async function computeTransferMetrics(
  tokenAddress: string,
  date: Date
): Promise<TransferFrequencyMetrics> {
  const dayStart = new Date(date).setHours(0, 0, 0, 0);
  const dayEnd = dayStart + 86400000;
  
  const events = await codex.getTokenEvents({
    tokenAddress,
    from: dayStart,
    to: dayEnd
  });
  
  const senders = new Set<string>();
  const receivers = new Set<string>();
  const transferAmounts: number[] = [];
  
  for (const event of events) {
    if (event.maker) senders.add(event.maker);
    // Note: Codex events are trade-based; for pure transfers, 
    // additional SPL token program parsing may be needed
    transferAmounts.push(event.amount);
  }
  
  // DAA = unique senders + unique receivers (deduplicated)
  const allAddresses = new Set([...senders, ...receivers]);
  
  return {
    dailyActiveAddresses: allAddresses.size,
    uniqueSenders: senders.size,
    uniqueReceivers: receivers.size,
    transferCount: events.length,
    avgTransferSize: transferAmounts.reduce((a, b) => a + b, 0) / transferAmounts.length,
    medianTransferSize: median(transferAmounts)
  };
}
```

### 2.2 Deriving DAA from Codex Event Data

**Codex Capabilities:**
- `getTokenEvents` returns DEX trade events (swaps)
- `getTokenEventsForMaker` tracks specific wallet activity
- `holders` endpoint provides current holder snapshots

**Limitations:**
- Codex primarily indexes DEX activity, not all SPL token transfers
- Pure wallet-to-wallet transfers may not appear unless through DEX
- For comprehensive transfer data, supplement with Helius or Bitquery

**Approximation Strategy:**
```typescript
// Approximate DAA using trading activity
async function approximateDAA(tokenAddress: string): Promise<number> {
  const events = await getTokenEventsForDay(tokenAddress);
  
  // Extract unique addresses from buy/sell events
  const activeAddresses = new Set<string>();
  for (const event of events) {
    if (event.maker) activeAddresses.add(event.maker);
    if (event.taker) activeAddresses.add(event.taker);
  }
  
  // This underestimates true DAA but captures active traders
  return activeAddresses.size;
}
```

### 2.3 Transfer Count Trends

Track transfer patterns over time to identify:
- **Accumulation phases**: Low transfer count, increasing holder count
- **Distribution phases**: High transfer count, decreasing holder count  
- **Consolidation**: Stable transfer count and holder count
- **FOMO/Panic**: Spike in transfer count

```typescript
interface TransferTrend {
  date: Date;
  transferCount: number;
  holderCount: number;
  netHolderChange: number;
  transferToHolderRatio: number;  // High ratio = churn
}

function classifyPhase(trends: TransferTrend[]): 'accumulation' | 'distribution' | 'consolidation' | 'volatile' {
  const recentTrends = trends.slice(-7);  // Last 7 days
  
  const avgHolderChange = average(recentTrends.map(t => t.netHolderChange));
  const avgTransferRatio = average(recentTrends.map(t => t.transferToHolderRatio));
  
  if (avgHolderChange > 0 && avgTransferRatio < 0.5) return 'accumulation';
  if (avgHolderChange < 0 && avgTransferRatio > 1.0) return 'distribution';
  if (Math.abs(avgHolderChange) < 10 && avgTransferRatio < 0.3) return 'consolidation';
  return 'volatile';
}
```

---

## 3. Price-Holder Correlation Analysis

### 3.1 Pearson Correlation Computation

```typescript
interface CorrelationResult {
  correlation: number;        // -1 to 1
  pValue: number;             // Statistical significance
  sampleSize: number;
  interpretation: string;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );
  
  return denominator === 0 ? 0 : numerator / denominator;
}

async function computePriceHolderCorrelation(
  tokenAddress: string,
  days: number
): Promise<CorrelationResult> {
  // Get daily price changes
  const priceHistory = await getPriceHistory(tokenAddress, days);
  const priceChanges = priceHistory.slice(1).map((p, i) => 
    (p.close - priceHistory[i].close) / priceHistory[i].close
  );
  
  // Get daily holder count changes
  const holderHistory = await getHolderHistory(tokenAddress, days);
  const holderChanges = holderHistory.slice(1).map((h, i) =>
    h.count - holderHistory[i].count
  );
  
  const r = pearsonCorrelation(priceChanges, holderChanges);
  const pValue = computePValue(r, priceChanges.length);
  
  return {
    correlation: r,
    pValue,
    sampleSize: priceChanges.length,
    interpretation: interpretCorrelation(r, pValue)
  };
}

function interpretCorrelation(r: number, p: number): string {
  if (p > 0.05) return 'Not statistically significant';
  if (r > 0.7) return 'Strong positive: price and holders move together';
  if (r > 0.3) return 'Moderate positive correlation';
  if (r > -0.3) return 'Weak or no correlation';
  if (r > -0.7) return 'Moderate negative correlation';
  return 'Strong negative: inverse relationship';
}
```

### 3.2 Lead-Lag Analysis

Determine whether holder changes LEAD or LAG price changes:

```typescript
interface LeadLagResult {
  optimalLag: number;           // Positive = holders lead, Negative = holders lag
  correlationAtLag: number;
  lagCorrelations: Map<number, number>;
  interpretation: string;
}

function crossCorrelation(x: number[], y: number[], maxLag: number): Map<number, number> {
  const results = new Map<number, number>();
  
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let xShifted: number[];
    let yAligned: number[];
    
    if (lag >= 0) {
      // Shift x forward (x leads y)
      xShifted = x.slice(0, x.length - lag);
      yAligned = y.slice(lag);
    } else {
      // Shift y forward (y leads x)
      xShifted = x.slice(-lag);
      yAligned = y.slice(0, y.length + lag);
    }
    
    results.set(lag, pearsonCorrelation(xShifted, yAligned));
  }
  
  return results;
}

async function analyzeLeadLag(
  tokenAddress: string,
  days: number,
  maxLagDays: number = 7
): Promise<LeadLagResult> {
  const priceChanges = await getDailyPriceChanges(tokenAddress, days);
  const holderChanges = await getDailyHolderChanges(tokenAddress, days);
  
  const lagCorrelations = crossCorrelation(holderChanges, priceChanges, maxLagDays);
  
  // Find lag with highest absolute correlation
  let optimalLag = 0;
  let maxCorr = 0;
  for (const [lag, corr] of lagCorrelations) {
    if (Math.abs(corr) > Math.abs(maxCorr)) {
      maxCorr = corr;
      optimalLag = lag;
    }
  }
  
  return {
    optimalLag,
    correlationAtLag: maxCorr,
    lagCorrelations,
    interpretation: interpretLeadLag(optimalLag, maxCorr)
  };
}

function interpretLeadLag(lag: number, corr: number): string {
  if (Math.abs(corr) < 0.2) return 'No significant lead-lag relationship';
  
  if (lag > 0) {
    return `Holder changes LEAD price by ${lag} day(s) - ` +
           `holders are predictive (r=${corr.toFixed(2)})`;
  } else if (lag < 0) {
    return `Holder changes LAG price by ${-lag} day(s) - ` +
           `holders react to price (r=${corr.toFixed(2)})`;
  }
  return `Simultaneous correlation (r=${corr.toFixed(2)})`;
}
```

### 3.3 Expected Patterns by Token Type

**MetaDAO Tokens (META, DEAN, FUTURE)**
- Expected: Weak or lagging correlation
- Holders motivated by governance, not price speculation
- Holder growth may LEAD price during proposal activity
- More stable holder base during price volatility

**VC-Backed Tokens (JTO, JUP, PYTH)**
- Expected: Moderate positive correlation
- Retail follows price momentum
- Holder changes typically LAG price by 1-3 days
- Vesting unlocks create predictable holder dilution events
- Strong correlation during airdrops/distribution events

**Meme Tokens (BONK)**
- Expected: Strong positive correlation
- Highly speculative - holders chase price
- Very short lag (0-1 days)
- Correlation breaks down during extreme volatility

### 3.4 Statistical Significance Testing

```typescript
function computePValue(r: number, n: number): number {
  // t-statistic for correlation coefficient
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  
  // Degrees of freedom
  const df = n - 2;
  
  // Use t-distribution CDF (approximate with normal for large n)
  if (df > 30) {
    return 2 * (1 - normalCDF(Math.abs(t)));
  }
  
  // For smaller samples, use t-distribution
  return 2 * (1 - tDistributionCDF(Math.abs(t), df));
}

function isSignificant(pValue: number, alpha: number = 0.05): boolean {
  return pValue < alpha;
}
```

---

## 4. Liquidity Metrics

### 4.1 Bid-Ask Spread Proxy

For AMM-based DEXs (Raydium, Orca), there's no traditional order book. The "spread" is approximated by the trading fee plus price impact:

```typescript
interface SpreadMetrics {
  impliedSpread: number;      // Fee + minimal price impact
  effectiveSpread: number;    // For a reference trade size
  depth2Percent: number;      // Liquidity within 2% of current price
}

async function computeSpreadMetrics(
  pairAddress: string,
  tradeSize: number = 1000  // USD
): Promise<SpreadMetrics> {
  const pair = await codex.getTokenPairs(tokenAddress);
  
  // AMM fee (typically 0.25-0.30% for Raydium/Orca)
  const ammFee = 0.003;  // 0.3%
  
  // Price impact for trade size
  const priceImpact = computePriceImpact(pair.liquidity, tradeSize);
  
  return {
    impliedSpread: ammFee * 2,  // Round-trip fee
    effectiveSpread: ammFee + priceImpact,
    depth2Percent: pair.liquidity * 0.02  // Simplified approximation
  };
}
```

### 4.2 Market Depth Approximation

For constant product AMMs (x * y = k):

```typescript
/**
 * Calculate price impact for a trade on constant product AMM
 * Formula: Price Impact ≈ Trade Size / (2 * Liquidity)
 * 
 * More precise: amountOut = (y * dx) / (x + dx)
 * Price impact = 1 - (amountOut / expectedAmountOut)
 */
function computePriceImpact(
  poolLiquidity: number,  // Total liquidity in USD
  tradeSize: number       // Trade size in USD
): number {
  // Simplified approximation for constant product AMM
  // Accurate for small trades relative to pool size
  return tradeSize / (2 * poolLiquidity);
}

/**
 * More precise constant product calculation
 */
function constantProductPriceImpact(
  reserveIn: number,   // Reserve of token being sold
  reserveOut: number,  // Reserve of token being bought  
  amountIn: number     // Amount being sold
): { amountOut: number; priceImpact: number } {
  // x * y = k
  // (x + dx) * (y - dy) = k
  // dy = y * dx / (x + dx)
  
  const amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
  const spotPrice = reserveOut / reserveIn;
  const executionPrice = amountOut / amountIn;
  const priceImpact = 1 - (executionPrice / spotPrice);
  
  return { amountOut, priceImpact };
}
```

### 4.3 Slippage Estimation for Various Trade Sizes

```typescript
interface SlippageTable {
  tradeSize: number;
  expectedSlippage: number;
  worstCase: number;  // With 1% tolerance
}

async function generateSlippageTable(
  tokenAddress: string,
  tradeSizes: number[] = [100, 1000, 5000, 10000, 50000, 100000]
): Promise<SlippageTable[]> {
  const pairs = await codex.getTokenPairs(tokenAddress);
  
  // Aggregate liquidity across all pairs
  const totalLiquidity = pairs.reduce((sum, p) => sum + p.liquidity, 0);
  
  return tradeSizes.map(size => ({
    tradeSize: size,
    expectedSlippage: computePriceImpact(totalLiquidity, size),
    worstCase: computePriceImpact(totalLiquidity, size) + 0.01  // 1% tolerance
  }));
}
```

**Slippage Formula:**
```
Slippage (%) = ((Executed Price - Expected Price) / Expected Price) × 100
```

### 4.4 VC Token vs MetaDAO Token Liquidity Comparison

**Well-Supported VC Tokens (JTO, JUP, PYTH, W):**
- Typical liquidity: $5M - $50M+ across major pairs
- Multiple deep pools on Raydium, Orca, Jupiter
- Low slippage (< 0.5%) for trades up to $50K
- Institutional market makers provide depth
- Centralized exchange listings provide arbitrage anchors

**MetaDAO Tokens (META, DEAN, FUTURE):**
- Typical liquidity: $100K - $2M
- Fewer trading pairs, concentrated on 1-2 DEXs
- Higher slippage (1-5%) for trades over $5K
- Community liquidity provision, less professional
- No CEX listings = no external price anchors

**Comparison Metrics:**
```typescript
interface LiquidityComparison {
  token: string;
  category: 'metadao' | 'vc-backed';
  totalLiquidityUSD: number;
  numberOfPairs: number;
  slippage1k: number;    // Slippage for $1K trade
  slippage10k: number;   // Slippage for $10K trade
  slippage100k: number;  // Slippage for $100K trade
  liquidityScore: number; // 0-100 normalized
}

function computeLiquidityScore(metrics: LiquidityComparison): number {
  // Weighted score based on multiple factors
  const liquidityScore = Math.min(100, metrics.totalLiquidityUSD / 100000);
  const pairScore = Math.min(100, metrics.numberOfPairs * 10);
  const slippageScore = Math.max(0, 100 - metrics.slippage10k * 1000);
  
  return (liquidityScore * 0.4 + pairScore * 0.2 + slippageScore * 0.4);
}
```

---

## 5. Implementation Notes for Codex API

### 5.1 Available Codex Endpoints

| Endpoint | Use Case | Limitations |
|----------|----------|-------------|
| `getTokenEvents` | Trade/swap events | DEX trades only, not pure transfers |
| `getTokenEventsForMaker` | Wallet-specific activity | Requires known wallet address |
| `tokenHolders` | Current holder snapshot | Point-in-time, no history |
| `getTokenInfo` | Holder count, supply | Basic metrics only |
| `getTokenPairs` | Liquidity pool data | Pair-level granularity |
| `getBars` | Price/volume OHLCV | Good for historical analysis |

### 5.2 Data Gaps and Workarounds

**Gap 1: Historical Holder Count**
- Codex provides current holder count, not historical
- Workaround: Build local time series by polling `holderCount` daily
- Alternative: Use Helius for historical token account snapshots

**Gap 2: Pure Token Transfers**
- Codex focuses on DEX activity
- Workaround: Supplement with Bitquery or Helius transfer APIs
- For velocity calculation, DEX volume may be sufficient proxy

**Gap 3: Solana Data Start Date**
- Codex Solana data begins March 20, 2024
- Historical analysis limited to ~2 years maximum

### 5.3 Rate Limiting Considerations

```typescript
// Existing rate limiter in codebase: 30 req/min, 0.5 req/sec burst
const codexLimiter = new RateLimiter(30, 0.5);

// For batch historical analysis, implement backoff:
async function batchFetchWithBackoff<T>(
  requests: Array<() => Promise<T>>,
  batchSize: number = 10,
  delayMs: number = 2000
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(req => req()));
    results.push(...batchResults);
    
    if (i + batchSize < requests.length) {
      await delay(delayMs);
    }
  }
  
  return results;
}
```

---

## 6. Proposed Type Extensions

Add these types to `src/types/index.ts`:

```typescript
// ── Velocity Types ────────────────────────────────────────────────────────────

export interface VelocityMetrics {
  tokenId: string;
  timestamp: number;
  period: 'daily' | 'weekly' | 'monthly';
  transactionVolume: number;
  averageMarketCap: number;
  velocity: number;
  tokenVelocity: number;
}

export interface TransferMetrics {
  tokenId: string;
  timestamp: number;
  dailyActiveAddresses: number;
  uniqueSenders: number;
  uniqueReceivers: number;
  transferCount: number;
  avgTransferSize: number;
  netFlow: number;  // Positive = accumulation, negative = distribution
}

// ── Correlation Types ─────────────────────────────────────────────────────────

export interface CorrelationResult {
  tokenId: string;
  metric1: string;
  metric2: string;
  correlation: number;
  pValue: number;
  sampleSize: number;
  significant: boolean;
}

export interface LeadLagResult {
  tokenId: string;
  optimalLag: number;
  correlationAtLag: number;
  direction: 'leads' | 'lags' | 'simultaneous';
  confidence: number;
}

// ── Liquidity Types ───────────────────────────────────────────────────────────

export interface LiquidityMetrics {
  tokenId: string;
  timestamp: number;
  totalLiquidityUSD: number;
  numberOfPairs: number;
  impliedSpread: number;
  slippageTable: SlippageEstimate[];
  liquidityScore: number;
}

export interface SlippageEstimate {
  tradeSizeUSD: number;
  expectedSlippage: number;
  worstCaseSlippage: number;
}
```

---

## 7. Summary and Recommendations

### Key Metrics to Implement

1. **Token Velocity**: Monthly velocity = Volume / AvgMarketCap
2. **DAA Proxy**: Count unique addresses from Codex trade events
3. **Price-Holder Correlation**: Pearson correlation with lag analysis
4. **Liquidity Score**: Composite of total liquidity, pair count, slippage

### Expected Findings (Hypothesis)

| Metric | MetaDAO Tokens | VC Tokens | Meme Tokens |
|--------|---------------|-----------|-------------|
| Velocity | Low (< 0.15) | Medium (0.2-0.5) | High (> 0.5) |
| Holder Correlation | Weak/Leading | Moderate/Lagging | Strong/Lagging |
| Liquidity Score | Low (20-40) | High (60-90) | Variable |
| DAA Stability | High | Medium | Low |

### Next Steps

1. Extend `CodexClient` with `getTokenEvents` query
2. Implement velocity calculation in `src/lib/metrics/velocity.ts`
3. Add correlation analysis in `src/lib/metrics/correlation.ts`
4. Build liquidity scoring in `src/lib/metrics/liquidity.ts`
5. Create comparison dashboard component

---

## References

- Multicoin Capital: "Understanding Token Velocity" (2017)
- Paradigm Research: "Understanding Automated Market-Makers, Part 1: Price Impact" (2021)
- Santiment Academy: Velocity metrics documentation
- Codex API Documentation: https://docs.codex.io
- BlockApps: "Tokenomics in Crypto: Understanding Token Velocity" (2024)
