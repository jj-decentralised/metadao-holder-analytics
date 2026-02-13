# Token Velocity and Liquidity Dynamics Research

## Overview

This document explores the relationship between token velocity, liquidity dynamics, and holder patterns for MetaDAO and comparison tokens. Our hypothesis is that futarchy-governed tokens exhibit distinct market microstructure characteristics—specifically lower velocity and different liquidity patterns—compared to traditional VC-backed or community tokens.

## 1. Token Velocity Measurement

### 1.1 Definition and Formula

**Token Velocity** measures how frequently tokens change hands within a given period:

```
Velocity = Trading Volume / Circulating Market Cap
```

- **High velocity** (V > 0.5): Tokens change hands frequently, suggesting speculative trading or utility-driven turnover
- **Low velocity** (V < 0.1): Tokens held longer, indicating "hodling" behavior or conviction-based holding
- **Medium velocity** (0.1 ≤ V ≤ 0.5): Balanced trading activity

### 1.2 Data Sources

| Metric | Source | API Method |
|--------|--------|------------|
| Trading Volume | Codex | `getBars(symbol, from, to, resolution)` with volume data |
| Market Cap | CoinGecko | `/coins/{id}/market_chart` |
| Circulating Supply | Codex | `getTokenInfo(address)` → `totalSupply` |

### 1.3 Implementation Approach

```typescript
// Calculate daily velocity using Codex getBars
async function calculateVelocity(
  tokenAddress: string,
  days: number = 30
): Promise<{ date: number; velocity: number }[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;
  
  // Get OHLCV data with volume
  const bars = await codex.getBars(
    `${tokenAddress}:${SOLANA_NETWORK_ID}`,
    from,
    now,
    "1D"
  );
  
  // Get market cap from CoinGecko for each day
  const marketCaps = await getMarketCapHistory(tokenAddress, from, now);
  
  return bars.t.map((timestamp, i) => ({
    date: timestamp,
    velocity: bars.volume[i] / marketCaps[i]
  }));
}
```

### 1.4 Hypothesis: Futarchy Tokens Have Lower Velocity

**Rationale:**
- Futarchy governance requires staking/locking tokens for prediction markets
- Meta-governance participants are incentivized for long-term holding
- Less speculative trading due to governance-focused community
- Expected velocity: MetaDAO < VC-backed < Community/Meme tokens

**Validation Metrics:**
- 7-day rolling average velocity
- 30-day average velocity
- Velocity standard deviation (lower = more consistent holding patterns)

## 2. Liquidity Depth vs Holder Concentration

### 2.1 Measuring Total Liquidity

Use `listPairsForToken` to aggregate liquidity across all trading pairs:

```typescript
async function getTotalLiquidity(tokenAddress: string): Promise<{
  totalLiquidity: number;
  pairCount: number;
  primaryPair: CodexPairWithMetadata;
}> {
  const pairs = await codex.listPairsForToken(tokenAddress);
  
  const totalLiquidity = pairs.reduce((sum, p) => sum + p.liquidity, 0);
  const primaryPair = pairs.sort((a, b) => b.liquidity - a.liquidity)[0];
  
  return { totalLiquidity, pairCount: pairs.length, primaryPair };
}
```

### 2.2 Liquidity-to-Holder Ratio

```
Liquidity per Holder = Total Liquidity (USD) / Total Holder Count
```

This metric reveals:
- **High ratio**: Large average stake per holder, potentially institutional
- **Low ratio**: Distributed retail participation

### 2.3 Concentration vs Liquidity Relationship

**Research Questions:**
1. Do tokens with higher Gini coefficients have more or less liquidity per holder?
2. Is liquidity concentrated among whales who also hold large token positions?
3. Do futarchy protocols have more distributed LP positions?

**Analysis Framework:**

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| Liquidity Concentration | Top 3 pair liquidity / Total liquidity | How concentrated is market making |
| Holder-Liquidity Correlation | Pearson(whale_holdings, lp_positions) | Do big holders also provide liquidity |
| LP Distribution Score | 1 - (Max pair liquidity / Total) | Higher = more distributed |

### 2.4 Cross-Category Comparison

Expected patterns by token category:

| Category | Expected Liquidity/Holder | Expected LP Distribution |
|----------|--------------------------|-------------------------|
| MetaDAO | Medium-High (governance participants) | Distributed |
| Futarchy DAOs | High (protocol incentives) | Varies by protocol |
| VC-Backed | High (MM agreements) | Concentrated |
| Community | Low-Medium (retail) | Distributed |

## 3. Buy/Sell Asymmetry Analysis

### 3.1 Data Collection

Use `getDetailedPairStats` for comprehensive buy/sell metrics:

```typescript
interface BuySellAsymmetry {
  volumeRatio: number;     // buyVolume / sellVolume
  countRatio: number;      // buys / sells
  participantRatio: number; // buyers / sellers
  interpretation: 'accumulation' | 'distribution' | 'balanced';
}

async function analyzeBuySellAsymmetry(
  pairAddress: string,
  duration: number = 86400 * 7 // 7 days
): Promise<BuySellAsymmetry> {
  const stats = await codex.getDetailedPairStats(
    pairAddress,
    SOLANA_NETWORK_ID,
    duration
  );
  
  const volumeRatio = stats.buyVolume / stats.sellVolume;
  const countRatio = stats.buys / stats.sells;
  const participantRatio = stats.buyers / stats.sellers;
  
  let interpretation: BuySellAsymmetry['interpretation'];
  if (volumeRatio > 1.2 && participantRatio > 1.1) {
    interpretation = 'accumulation';
  } else if (volumeRatio < 0.8 && participantRatio < 0.9) {
    interpretation = 'distribution';
  } else {
    interpretation = 'balanced';
  }
  
  return { volumeRatio, countRatio, participantRatio, interpretation };
}
```

### 3.2 Temporal Buy/Sell Analysis

Track buy/sell ratio evolution using `getBars` with extended fields:

```typescript
// Extended getBars can include: buyVolume, sellVolume, buyers, sellers, transactions
interface ExtendedBar {
  t: number;
  o: number; h: number; l: number; c: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
  buyers?: number;
  sellers?: number;
  transactions?: number;
}
```

### 3.3 Accumulation Signals

**Strong Accumulation Indicators:**
- Buy volume > 60% of total volume
- More unique buyers than sellers
- Increasing buy ratio over 7+ days
- Large buys (volume/transactions ratio increasing)

**MetaDAO Hypothesis:**
- Expected to show more consistent accumulation patterns
- Lower sell pressure during market downturns (governance conviction)
- Buyer/seller ratio > 1.0 more frequently than VC tokens

## 4. Volume-Price Elasticity

### 4.1 Definition

**Price Elasticity** measures how much price moves per unit of trading volume:

```
Elasticity = Δ Price (%) / Volume (normalized)
```

- **Low elasticity**: Deep liquidity, institutional-grade markets, price stability
- **High elasticity**: Thin markets, retail-dominated, high volatility per trade

### 4.2 Calculation Methods

**Method 1: Simple Daily Elasticity**
```typescript
function calculateElasticity(bars: CodexBar): number[] {
  return bars.t.map((_, i) => {
    if (i === 0) return 0;
    const priceChange = Math.abs((bars.c[i] - bars.c[i-1]) / bars.c[i-1]);
    const normalizedVolume = bars.volume[i] / bars.c[i]; // Volume in token units
    return priceChange / normalizedVolume;
  });
}
```

**Method 2: Amihud Illiquidity Ratio**

The Amihud ratio is a standard academic measure of price impact:

```
Amihud = (1/N) × Σ |Return_i| / Volume_i
```

Higher Amihud = more illiquid (larger price impact per dollar traded)

```typescript
function calculateAmihudRatio(bars: CodexBar, days: number = 30): number {
  let sumRatios = 0;
  let count = 0;
  
  for (let i = 1; i < bars.t.length && count < days; i++) {
    const return_i = Math.abs((bars.c[i] - bars.c[i-1]) / bars.c[i-1]);
    const volume_i = bars.volume[i];
    
    if (volume_i > 0) {
      sumRatios += return_i / volume_i;
      count++;
    }
  }
  
  return sumRatios / count;
}
```

### 4.3 Kyle's Lambda

Kyle's lambda measures permanent price impact (informed trading signal):

```
λ = Cov(ΔP, SignedVolume) / Var(SignedVolume)
```

Where `SignedVolume = BuyVolume - SellVolume`

```typescript
function calculateKyleLambda(
  priceChanges: number[],
  signedVolumes: number[]
): number {
  const n = priceChanges.length;
  
  const meanPrice = priceChanges.reduce((a, b) => a + b, 0) / n;
  const meanVolume = signedVolumes.reduce((a, b) => a + b, 0) / n;
  
  let covariance = 0;
  let volumeVariance = 0;
  
  for (let i = 0; i < n; i++) {
    covariance += (priceChanges[i] - meanPrice) * (signedVolumes[i] - meanVolume);
    volumeVariance += Math.pow(signedVolumes[i] - meanVolume, 2);
  }
  
  return covariance / volumeVariance;
}
```

### 4.4 Cross-Category Elasticity Comparison

| Category | Expected Elasticity | Expected Amihud | Rationale |
|----------|--------------------|--------------| -----------|
| MetaDAO | Medium | Medium | Growing liquidity, engaged community |
| VC-Backed | Low | Low | Market maker agreements, deep books |
| Community/Meme | High | High | Retail-driven, volatile |
| Futarchy DAOs | Medium-Low | Medium-Low | Protocol incentives for liquidity |

## 5. Liquidity Provider Analysis

### 5.1 Market Depth Assessment

Using pair data to understand market structure:

```typescript
interface MarketDepthMetrics {
  totalLiquidity: number;
  primaryPairShare: number;     // % of liquidity in top pair
  exchangeDistribution: Record<string, number>; // liquidity by DEX
  liquidityPerHolder: number;
  depthScore: number;           // 0-100 composite score
}

async function analyzeMarketDepth(tokenAddress: string): Promise<MarketDepthMetrics> {
  const pairs = await codex.listPairsForToken(tokenAddress);
  const tokenInfo = await codex.getTokenInfo(tokenAddress);
  
  const totalLiquidity = pairs.reduce((sum, p) => sum + p.liquidity, 0);
  const maxPairLiquidity = Math.max(...pairs.map(p => p.liquidity));
  
  const exchangeDistribution: Record<string, number> = {};
  for (const pair of pairs) {
    exchangeDistribution[pair.exchange] = 
      (exchangeDistribution[pair.exchange] || 0) + pair.liquidity;
  }
  
  const liquidityPerHolder = totalLiquidity / (tokenInfo?.holderCount || 1);
  
  // Depth score: penalize concentration, reward distribution
  const concentrationPenalty = (maxPairLiquidity / totalLiquidity) * 30;
  const exchangeBonus = Math.min(Object.keys(exchangeDistribution).length * 10, 30);
  const liquidityBonus = Math.min(Math.log10(totalLiquidity) * 5, 40);
  
  const depthScore = Math.max(0, liquidityBonus + exchangeBonus - concentrationPenalty);
  
  return {
    totalLiquidity,
    primaryPairShare: maxPairLiquidity / totalLiquidity,
    exchangeDistribution,
    liquidityPerHolder,
    depthScore
  };
}
```

### 5.2 LP Concentration Questions

**Research Areas:**
1. Are LP positions concentrated in few wallets?
2. Do futarchy protocols have more distributed LPs?
3. Is there correlation between token holder concentration and LP concentration?

**Data Limitations:**
- Codex pair data provides aggregate liquidity, not individual LP positions
- Individual LP analysis requires direct on-chain indexing
- Focus on aggregate metrics and cross-pair distribution

### 5.3 Exchange Distribution as Proxy

When direct LP data is unavailable, exchange distribution serves as a proxy:
- Multiple exchanges = more diverse market making
- Single exchange dominance = potentially concentrated LPs

## 6. Trading Frequency Distribution

### 6.1 Transaction Metrics from getBars

Using `getBars` with transactions count:

```typescript
interface TradingFrequencyMetrics {
  avgDailyTrades: number;
  avgTradeSize: number;        // volume / transactions
  tradeSizeVariance: number;
  peakTradingHour?: number;
  tradingPatternType: 'retail' | 'institutional' | 'mixed';
}

async function analyzeTradingFrequency(
  tokenAddress: string,
  days: number = 30
): Promise<TradingFrequencyMetrics> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;
  
  // Get hourly bars for granular analysis
  const bars = await codex.getBars(
    `${tokenAddress}:${SOLANA_NETWORK_ID}`,
    from,
    now,
    "60" // hourly
  );
  
  // Note: transactions field availability depends on Codex response
  const dailyTrades: number[] = [];
  const tradeSizes: number[] = [];
  
  // Aggregate to daily
  const dailyBuckets = new Map<number, { volume: number; txns: number }>();
  
  for (let i = 0; i < bars.t.length; i++) {
    const dayKey = Math.floor(bars.t[i] / 86400) * 86400;
    const existing = dailyBuckets.get(dayKey) || { volume: 0, txns: 0 };
    // Estimate transactions from volume patterns if not available
    dailyBuckets.set(dayKey, {
      volume: existing.volume + bars.volume[i],
      txns: existing.txns + 1 // Placeholder if transactions not available
    });
  }
  
  for (const [_, data] of dailyBuckets) {
    dailyTrades.push(data.txns);
    if (data.txns > 0) {
      tradeSizes.push(data.volume / data.txns);
    }
  }
  
  const avgDailyTrades = dailyTrades.reduce((a, b) => a + b, 0) / dailyTrades.length;
  const avgTradeSize = tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length;
  
  const tradeSizeVariance = tradeSizes.reduce(
    (sum, size) => sum + Math.pow(size - avgTradeSize, 2), 0
  ) / tradeSizes.length;
  
  // Classify trading pattern
  let tradingPatternType: TradingFrequencyMetrics['tradingPatternType'];
  if (avgTradeSize > 10000 && tradeSizeVariance > avgTradeSize * avgTradeSize) {
    tradingPatternType = 'institutional';
  } else if (avgTradeSize < 1000) {
    tradingPatternType = 'retail';
  } else {
    tradingPatternType = 'mixed';
  }
  
  return {
    avgDailyTrades,
    avgTradeSize,
    tradeSizeVariance,
    tradingPatternType
  };
}
```

### 6.2 Trade Size Distribution Analysis

**MetaDAO Hypothesis:**
- Expected to have larger average trade sizes (governance participants)
- Lower trade frequency but higher conviction per trade
- Less "noise trading" compared to meme tokens

**Distribution Buckets:**
- Micro: < $100
- Small: $100 - $1,000  
- Medium: $1,000 - $10,000
- Large: $10,000 - $100,000
- Whale: > $100,000

## 7. Correlation Analysis: Velocity ↔ Holder Metrics

### 7.1 Key Correlations to Measure

| Velocity Metric | Holder Metric | Expected Correlation | Hypothesis |
|-----------------|---------------|---------------------|------------|
| Token velocity | Avg hold duration | Strong negative | Higher velocity = shorter holds |
| Volume/Liquidity ratio | Gini coefficient | Weak positive | Concentrated tokens may have more relative volume |
| Buyer/seller ratio | Holder growth rate | Moderate positive | Net buyers = growing holder base |
| Trade size distribution | Concentration metrics | Moderate positive | Larger trades = more concentrated activity |

### 7.2 Implementation

```typescript
interface VelocityHolderCorrelations {
  velocityVsHoldDuration: number;
  volumeLiquidityVsGini: number;
  buyerSellerVsGrowth: number;
  tradeSizeVsConcentration: number;
}

async function calculateCorrelations(
  tokens: TokenMetadata[]
): Promise<VelocityHolderCorrelations> {
  const dataPoints: Array<{
    velocity: number;
    holdDuration: number;
    volumeLiquidityRatio: number;
    gini: number;
    buyerSellerRatio: number;
    holderGrowth: number;
    avgTradeSize: number;
    top10Concentration: number;
  }> = [];
  
  for (const token of tokens) {
    // Collect metrics for each token
    const velocity = await calculateAverageVelocity(token.mintAddress);
    const holdMetrics = await getHolderMetrics(token.mintAddress);
    const tradingMetrics = await getTradingMetrics(token.mintAddress);
    
    dataPoints.push({
      velocity,
      holdDuration: holdMetrics.avgHoldDuration,
      volumeLiquidityRatio: tradingMetrics.volume24h / tradingMetrics.liquidity,
      gini: holdMetrics.gini,
      buyerSellerRatio: tradingMetrics.buyers / tradingMetrics.sellers,
      holderGrowth: holdMetrics.growthRate30d,
      avgTradeSize: tradingMetrics.avgTradeSize,
      top10Concentration: holdMetrics.top10Percent
    });
  }
  
  return {
    velocityVsHoldDuration: pearsonCorrelation(
      dataPoints.map(d => d.velocity),
      dataPoints.map(d => d.holdDuration)
    ),
    volumeLiquidityVsGini: pearsonCorrelation(
      dataPoints.map(d => d.volumeLiquidityRatio),
      dataPoints.map(d => d.gini)
    ),
    buyerSellerVsGrowth: pearsonCorrelation(
      dataPoints.map(d => d.buyerSellerRatio),
      dataPoints.map(d => d.holderGrowth)
    ),
    tradeSizeVsConcentration: pearsonCorrelation(
      dataPoints.map(d => d.avgTradeSize),
      dataPoints.map(d => d.top10Concentration)
    )
  };
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
  
  return numerator / denominator;
}
```

### 7.3 Category-Specific Patterns

**Expected Results by Category:**

**MetaDAO/Futarchy:**
- Low velocity, high hold duration
- Low volume/liquidity ratio (stable markets)
- Buyer/seller ratio > 1 (accumulation)
- Larger trade sizes (governance participants)

**VC-Backed:**
- Medium velocity
- Very low volume/liquidity (deep liquidity)
- Balanced buyer/seller ratio
- Medium-large trade sizes

**Community/Meme:**
- High velocity, short holds
- High volume/liquidity ratio (volatile)
- Variable buyer/seller (momentum-driven)
- Small trade sizes (retail)

## 8. Academic Framework

### 8.1 Quantity Theory of Money Applied to Tokens

The classical equation of exchange:

```
M × V = P × Y
```

Where:
- **M** = Money supply (token supply)
- **V** = Velocity of money (trading velocity)
- **P** = Price level (token price)
- **Y** = Real output (utility/activity)

**Token Interpretation:**
```
Token Supply × Velocity = Market Cap × (Protocol Activity / Market Cap)
```

Simplified:
```
Volume = Market Cap × Velocity
```

**Implications for Futarchy Tokens:**
- Lower V (velocity) suggests tokens are held for governance, not speculation
- If P (price) grows while V decreases, implies growing conviction
- Protocol activity (Y) in futarchy = governance participation, prediction market activity

### 8.2 Amihud Illiquidity Ratio

Standard academic measure (Amihud, 2002):

```
ILLIQ = (1/D) × Σ |R_d| / VOLD_d
```

Where:
- D = number of days
- R_d = daily return
- VOLD_d = daily dollar volume

**Interpretation:**
- Higher ILLIQ = price moves more per dollar traded
- Lower ILLIQ = deeper, more institutional market

**Application:**
- Compare ILLIQ across token categories
- Track ILLIQ over time as markets mature
- Expected: VC-backed < Futarchy < Community

### 8.3 Kyle's Lambda (Price Impact)

From Kyle (1985), measures permanent price impact:

```
ΔP = λ × (x + u)
```

Where:
- λ = price impact coefficient
- x = informed trading
- u = noise trading

**Estimation:**
```
λ = Cov(ΔP, Order Flow) / Var(Order Flow)
```

**For Futarchy Analysis:**
- Lower λ = more efficient price discovery
- Futarchy should have lower λ due to governance mechanism revealing information
- Compare λ during governance events vs normal periods

### 8.4 Research Methodology

**Data Collection Period:** 90 days rolling
**Sample:** All tokens in `ALL_TOKENS` from `src/data/tokens.ts`
**Frequency:** Daily metrics, aggregated weekly for trends

**Statistical Tests:**
1. **Welch's t-test**: Compare means between categories
2. **Mann-Whitney U**: Non-parametric comparison for non-normal distributions
3. **Spearman correlation**: Rank-based correlation for robustness
4. **Linear regression**: Velocity as function of holder metrics

## 9. Implementation Roadmap

### Phase 1: Data Pipeline (Week 1-2)
- [ ] Implement velocity calculation service
- [ ] Add Amihud ratio computation
- [ ] Extend Codex client for detailed pair stats aggregation
- [ ] Create correlation calculation utilities

### Phase 2: Analysis Engine (Week 2-3)
- [ ] Build cross-category comparison framework
- [ ] Implement Kyle's lambda estimation
- [ ] Create buy/sell asymmetry tracker
- [ ] Add market depth scoring

### Phase 3: Visualization & Dashboard (Week 3-4)
- [ ] Velocity trend charts by category
- [ ] Liquidity depth heatmaps
- [ ] Buy/sell pressure gauges
- [ ] Correlation matrix visualization

### Phase 4: Reporting (Week 4)
- [ ] Automated weekly velocity reports
- [ ] Anomaly detection for accumulation/distribution
- [ ] Category comparison scorecards

## 10. Key Metrics Summary

### Core Velocity Metrics
| Metric | Formula | Update Frequency |
|--------|---------|------------------|
| Daily Velocity | Volume24h / MarketCap | Daily |
| Rolling 7D Velocity | Avg(Velocity, 7 days) | Daily |
| Velocity Trend | Slope of 30D velocity regression | Weekly |

### Liquidity Metrics
| Metric | Formula | Update Frequency |
|--------|---------|------------------|
| Total Liquidity | Σ(pair.liquidity) | Hourly |
| Liquidity per Holder | TotalLiquidity / HolderCount | Daily |
| Depth Score | Composite (see section 5.1) | Daily |

### Price Impact Metrics
| Metric | Formula | Update Frequency |
|--------|---------|------------------|
| Amihud Ratio | Avg(|Return| / Volume) | Daily |
| Kyle Lambda | Cov(ΔP, SignedVol) / Var(SignedVol) | Weekly |
| Elasticity | ΔPrice% / NormalizedVolume | Daily |

### Trading Pattern Metrics
| Metric | Formula | Update Frequency |
|--------|---------|------------------|
| Buy/Sell Volume Ratio | BuyVolume / SellVolume | Hourly |
| Buyer/Seller Count Ratio | Buyers / Sellers | Daily |
| Avg Trade Size | Volume / Transactions | Daily |

## 11. Expected Findings Summary

Based on our hypotheses, we expect to find:

1. **Velocity**: MetaDAO < VC-backed < Community tokens
2. **Amihud Ratio**: VC-backed < Futarchy < Community
3. **Buy/Sell Asymmetry**: MetaDAO shows consistent net buying
4. **Trade Size**: MetaDAO/Futarchy have larger average trades
5. **LP Distribution**: MetaDAO has more distributed liquidity provision
6. **Correlation**: Strong negative correlation between velocity and holder concentration for governance tokens

These findings would support the thesis that futarchy-governed tokens exhibit fundamentally different market microstructure, reflecting their governance-first design rather than speculation-first dynamics.

## References

1. Amihud, Y. (2002). "Illiquidity and stock returns: cross-section and time-series effects." Journal of Financial Markets.
2. Kyle, A. S. (1985). "Continuous Auctions and Insider Trading." Econometrica.
3. Fisher, I. (1911). "The Purchasing Power of Money." Macmillan.
4. Codex API Documentation: https://docs.codex.io/
5. MetaDAO Whitepaper: https://docs.themetadao.org/
