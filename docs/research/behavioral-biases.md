# Behavioral Biases in Crypto Token Holders

Research methodology for measuring cognitive biases and behavioral patterns in cryptocurrency token holders using Codex API on-chain data.

## Academic Foundation

### Key Theories

**Disposition Effect (Shefrin & Statman, 1985)**
Investors systematically sell winning investments too early and hold losing investments too long. This behavior contradicts rational utility maximization and stems from:
- Mental accounting: treating each investment as a separate "account"
- Prospect theory's value function: losses loom larger than gains
- Regret avoidance: selling a loser realizes the loss and triggers regret

**Prospect Theory (Kahneman & Tversky, 1979)**
Decision-making under uncertainty exhibits:
- **Loss aversion**: losses are psychologically ~2.5x more painful than equivalent gains
- **Reference point dependence**: outcomes evaluated relative to a reference point (typically purchase price)
- **Diminishing sensitivity**: marginal impact decreases as gains/losses increase

**Herding Behavior**
Investors follow the actions of others, particularly "smart money" or large holders, rather than relying on their own analysis. In crypto markets, this manifests as:
- Following whale movements
- Copy-trading behavior
- FOMO-driven buying after price increases

**Anchoring Bias**
Investors anchor decisions to arbitrary reference points, most commonly their entry price, leading to:
- Break-even selling: liquidating positions when price returns to purchase price
- Price level fixation: setting targets based on historical prices rather than fundamentals

---

## Measurement Framework Using Codex API

### 1. Disposition Effect Measurement

**Theory**: Disposition effect coefficient = PGR - PLR, where:
- PGR (Proportion of Gains Realized): realized gains / (realized gains + paper gains)
- PLR (Proportion of Losses Realized): realized losses / (realized losses + paper losses)

**Implementation**:

```typescript path=null start=null
interface DispositionAnalysis {
  walletAddress: string;
  pgr: number;  // Proportion of Gains Realized
  plr: number;  // Proportion of Losses Realized
  dispositionCoefficient: number;  // PGR - PLR
  totalTrades: number;
}

async function measureDispositionEffect(
  tokenAddress: string,
  walletAddress: string
): Promise<DispositionAnalysis> {
  // 1. Get all trading events for this wallet
  const events = await codex.getTokenEvents(tokenAddress);
  const walletEvents = events.filter(e => e.maker === walletAddress);
  
  // 2. Build position history with cost basis
  const positions: PositionEntry[] = [];
  let currentCostBasis = 0;
  let currentQuantity = 0;
  
  for (const event of walletEvents.sort((a, b) => a.timestamp - b.timestamp)) {
    const isBuy = event.labels.includes('buy') || event.labels.includes('swap_buy');
    const isSell = event.labels.includes('sell') || event.labels.includes('swap_sell');
    
    if (isBuy) {
      // Update cost basis using weighted average
      // New cost basis = (old_qty * old_basis + new_qty * new_price) / total_qty
      currentCostBasis = (currentQuantity * currentCostBasis + quantity * event.priceUsd) / 
                         (currentQuantity + quantity);
      currentQuantity += quantity;
    } else if (isSell) {
      // Calculate realized P/L
      const realizedPnL = (event.priceUsd - currentCostBasis) * quantity;
      positions.push({
        timestamp: event.timestamp,
        sellPrice: event.priceUsd,
        costBasis: currentCostBasis,
        realizedPnL,
        isGain: realizedPnL > 0
      });
      currentQuantity -= quantity;
    }
  }
  
  // 3. Calculate PGR and PLR
  const realizedGains = positions.filter(p => p.isGain).length;
  const realizedLosses = positions.filter(p => !p.isGain).length;
  
  // Paper gains/losses require current price vs remaining cost basis
  const currentPrice = await codex.getTokenPrice(tokenAddress);
  const paperGainLoss = (currentPrice.priceUsd - currentCostBasis) * currentQuantity;
  const paperGains = paperGainLoss > 0 ? 1 : 0;
  const paperLosses = paperGainLoss <= 0 ? 1 : 0;
  
  const pgr = realizedGains / (realizedGains + paperGains) || 0;
  const plr = realizedLosses / (realizedLosses + paperLosses) || 0;
  
  return {
    walletAddress,
    pgr,
    plr,
    dispositionCoefficient: pgr - plr,
    totalTrades: positions.length
  };
}
```

**Data Requirements**:
- `getTokenEvents()`: Full trade history per token
- Event labels to classify buy/sell direction
- `priceUsd` at each transaction for P/L calculation
- `getTokenPrice()`: Current price for paper gains calculation

**Interpretation**:
| Coefficient | Interpretation |
|-------------|----------------|
| > 0.2 | Strong disposition effect (behavioral) |
| 0 to 0.2 | Mild disposition effect |
| ~0 | Neutral (rational baseline) |
| < 0 | Reverse disposition (may indicate tax-loss harvesting) |

**Hypothesis**: MetaDAO holders exhibit lower disposition effect due to:
- Information from futarchy markets reducing uncertainty
- Governance participation creating stronger conviction
- Self-selection of more sophisticated participants

---

### 2. Loss Aversion Quantification

**Theory**: Loss aversion predicts asymmetric sell probability—higher probability of selling at +X% than at -X%.

**Implementation**:

```typescript path=null start=null
interface SellProbabilityCurve {
  pnlBucket: number;  // e.g., -50%, -40%, ..., +40%, +50%
  sellProbability: number;  // % of holders at this P/L level who sold
  sampleSize: number;
}

async function buildSellProbabilityCurve(
  tokenAddress: string,
  bucketSize: number = 10  // 10% buckets
): Promise<SellProbabilityCurve[]> {
  const holders = await codex.getHolders(tokenAddress);
  const events = await codex.getTokenEvents(tokenAddress);
  
  // Build P/L history for each holder
  const holderPnL = new Map<string, { pnlPercent: number; sold: boolean }[]>();
  
  for (const holder of holders.items) {
    const walletEvents = events.filter(e => e.maker === holder.address);
    // ... calculate P/L at each point, track if they sold
  }
  
  // Bucket by P/L percentage and calculate sell rate
  const buckets = new Map<number, { sold: number; held: number }>();
  
  for (const [_, pnlHistory] of holderPnL) {
    for (const entry of pnlHistory) {
      const bucket = Math.round(entry.pnlPercent / bucketSize) * bucketSize;
      const current = buckets.get(bucket) || { sold: 0, held: 0 };
      if (entry.sold) current.sold++;
      else current.held++;
      buckets.set(bucket, current);
    }
  }
  
  return Array.from(buckets.entries())
    .map(([bucket, counts]) => ({
      pnlBucket: bucket,
      sellProbability: counts.sold / (counts.sold + counts.held),
      sampleSize: counts.sold + counts.held
    }))
    .sort((a, b) => a.pnlBucket - b.pnlBucket);
}
```

**Expected Results**:
```
P/L Bucket | Sell Probability
-----------+------------------
   -50%    |      8%
   -40%    |     10%
   -30%    |     12%
   -20%    |     15%
   -10%    |     18%
     0%    |     35%  ← Break-even spike (anchoring)
   +10%    |     42%
   +20%    |     48%
   +30%    |     52%
   +40%    |     55%
   +50%    |     58%
```

**Loss Aversion Ratio**:
```
LA_ratio = avg(sell_prob at +X%) / avg(sell_prob at -X%)
```
Expected: LA_ratio ≈ 2.0-3.0 for retail-heavy tokens

---

### 3. Herding Behavior Detection

**Theory**: Retail traders follow whale movements, creating predictable flow patterns after large transactions.

**Implementation**:

```typescript path=null start=null
interface HerdingMetrics {
  whaleEventTimestamp: number;
  whaleAction: 'buy' | 'sell';
  whaleAmountPct: number;  // % of supply moved
  followersWithin24h: number;
  followerVolumeUsd: number;
  followerDirection: 'same' | 'opposite' | 'mixed';
  herdingCoefficient: number;
}

async function detectHerdingBehavior(
  tokenAddress: string,
  whaleThresholdPct: number = 1.0  // 1% of supply = whale
): Promise<HerdingMetrics[]> {
  const events = await codex.getTokenEvents(tokenAddress);
  const tokenInfo = await codex.getTokenInfo(tokenAddress);
  const totalSupply = parseFloat(tokenInfo.totalSupply);
  
  const results: HerdingMetrics[] = [];
  
  // Identify whale events
  for (const event of events) {
    const eventSupplyPct = (event.amountToken / totalSupply) * 100;
    
    if (eventSupplyPct >= whaleThresholdPct) {
      const isWhaleBuy = event.labels.includes('buy');
      
      // Find follower activity in next 24 hours
      const followWindow = events.filter(e => 
        e.timestamp > event.timestamp &&
        e.timestamp <= event.timestamp + 86400 &&  // 24h window
        e.maker !== event.maker &&  // Exclude the whale
        (e.amountToken / totalSupply) * 100 < whaleThresholdPct  // Only retail
      );
      
      const followerBuys = followWindow.filter(e => e.labels.includes('buy'));
      const followerSells = followWindow.filter(e => e.labels.includes('sell'));
      
      // Calculate herding coefficient
      // Positive = followers move same direction as whale
      // Negative = followers move opposite (contrarian behavior)
      const sameDirection = isWhaleBuy ? followerBuys.length : followerSells.length;
      const oppositeDirection = isWhaleBuy ? followerSells.length : followerBuys.length;
      const herdingCoef = (sameDirection - oppositeDirection) / 
                          (sameDirection + oppositeDirection) || 0;
      
      results.push({
        whaleEventTimestamp: event.timestamp,
        whaleAction: isWhaleBuy ? 'buy' : 'sell',
        whaleAmountPct: eventSupplyPct,
        followersWithin24h: followWindow.length,
        followerVolumeUsd: followWindow.reduce((sum, e) => sum + e.priceUsd * e.amountToken, 0),
        followerDirection: herdingCoef > 0.3 ? 'same' : herdingCoef < -0.3 ? 'opposite' : 'mixed',
        herdingCoefficient: herdingCoef
      });
    }
  }
  
  return results;
}
```

**Aggregate Herding Metrics**:
```typescript path=null start=null
interface TokenHerdingProfile {
  tokenAddress: string;
  avgHerdingCoefficient: number;  // -1 to +1
  herdingAfterWhaleBuys: number;  // avg coefficient after whale buys
  herdingAfterWhaleSells: number; // avg coefficient after whale sells
  asymmetry: number;  // difference in herding behavior buy vs sell
}
```

**Interpretation**:
| Herding Coefficient | Interpretation |
|---------------------|----------------|
| > 0.5 | Strong herding (followers copy whales) |
| 0.2 to 0.5 | Moderate herding |
| -0.2 to 0.2 | Independent behavior |
| < -0.2 | Contrarian behavior |

**Hypothesis**: MetaDAO holders show less herding because:
- Futarchy markets provide price signals independent of whale activity
- Governance participation correlates with independent research
- Community tokens may show highest herding (FOMO-driven)

---

### 4. Reference Point Anchoring (Break-Even Effect)

**Theory**: Holders anchor to their purchase price and are significantly more likely to sell when price returns to their entry point.

**Implementation**:

```typescript path=null start=null
interface AnchoringAnalysis {
  walletAddress: string;
  purchasePrice: number;
  sellEvents: Array<{
    timestamp: number;
    sellPrice: number;
    distanceFromAnchor: number;  // % distance from purchase price
  }>;
  breakEvenSellCount: number;  // Sells within ±3% of purchase price
  breakEvenAnchoringScore: number;  // Concentration of sells near anchor
}

async function measureAnchoring(
  tokenAddress: string,
  anchorTolerancePct: number = 3  // ±3% = "break-even zone"
): Promise<Map<string, AnchoringAnalysis>> {
  const events = await codex.getTokenEvents(tokenAddress);
  const walletAnalyses = new Map<string, AnchoringAnalysis>();
  
  // Group events by wallet
  const walletEvents = new Map<string, typeof events>();
  for (const event of events) {
    const existing = walletEvents.get(event.maker) || [];
    existing.push(event);
    walletEvents.set(event.maker, existing);
  }
  
  for (const [wallet, wEvents] of walletEvents) {
    const sorted = wEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    // Find first buy (anchor point)
    const firstBuy = sorted.find(e => e.labels.includes('buy'));
    if (!firstBuy) continue;
    
    const purchasePrice = firstBuy.priceUsd;
    
    // Analyze all subsequent sells
    const sells = sorted.filter(e => 
      e.labels.includes('sell') && 
      e.timestamp > firstBuy.timestamp
    );
    
    const sellEvents = sells.map(s => ({
      timestamp: s.timestamp,
      sellPrice: s.priceUsd,
      distanceFromAnchor: ((s.priceUsd - purchasePrice) / purchasePrice) * 100
    }));
    
    const breakEvenSells = sellEvents.filter(s => 
      Math.abs(s.distanceFromAnchor) <= anchorTolerancePct
    ).length;
    
    // Anchoring score: ratio of break-even sells to expected under uniform distribution
    // If sells were uniformly distributed, ~6% would fall in ±3% zone
    const expectedBreakEvenRate = (anchorTolerancePct * 2) / 100;  // ~6%
    const actualBreakEvenRate = breakEvenSells / sellEvents.length || 0;
    const anchoringScore = actualBreakEvenRate / expectedBreakEvenRate;
    
    walletAnalyses.set(wallet, {
      walletAddress: wallet,
      purchasePrice,
      sellEvents,
      breakEvenSellCount: breakEvenSells,
      breakEvenAnchoringScore: anchoringScore
    });
  }
  
  return walletAnalyses;
}
```

**Visualization**: Histogram of sell prices relative to purchase price
```
       ▄▄▄
      █████
     ███████     ▄▄▄
    █████████   █████
   ███████████ ███████
  █████████████████████
 ███████████████████████
-50%  -25%   0%   +25%  +50%
           (break-even)
```

**Token-Level Anchoring Score**:
```typescript path=null start=null
function getTokenAnchoringScore(analyses: Map<string, AnchoringAnalysis>): number {
  const scores = Array.from(analyses.values())
    .filter(a => a.sellEvents.length >= 3)  // Minimum trades threshold
    .map(a => a.breakEvenAnchoringScore);
  
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}
```

**Interpretation**:
| Score | Interpretation |
|-------|----------------|
| > 3.0 | Very strong anchoring (highly behavioral) |
| 2.0-3.0 | Strong anchoring |
| 1.0-2.0 | Moderate anchoring (some behavioral) |
| < 1.0 | Weak/no anchoring (more rational) |

---

### 5. FOMO Entry Patterns (Momentum Chasing)

**Theory**: FOMO-driven buyers enter positions after price increases, buying high rather than buying dips.

**Implementation**:

```typescript path=null start=null
interface FOMOAnalysis {
  tokenAddress: string;
  priceChangeWindow: '1h' | '4h' | '24h';
  newBuyerCorrelation: number;  // Correlation: price change vs new buyers
  avgEntryTiming: 'early' | 'middle' | 'late' | 'peak';  // Where in price cycle
  fomoBuyerPct: number;  // % of new buyers entering after >10% pump
}

async function measureFOMOBehavior(
  tokenAddress: string
): Promise<FOMOAnalysis> {
  const bars = await codex.getBars(
    `${tokenAddress}:${SOLANA_NETWORK_ID}`,
    from,
    to,
    '1D'
  );
  const events = await codex.getTokenEvents(tokenAddress);
  
  // Calculate daily returns
  const dailyReturns: Array<{ date: number; return: number }> = [];
  for (let i = 1; i < bars.c.length; i++) {
    dailyReturns.push({
      date: bars.t[i],
      return: (bars.c[i] - bars.c[i-1]) / bars.c[i-1] * 100
    });
  }
  
  // Identify new buyers per day
  const knownBuyers = new Set<string>();
  const newBuyersPerDay: Array<{ date: number; count: number }> = [];
  
  for (const day of dailyReturns) {
    const dayStart = day.date;
    const dayEnd = dayStart + 86400;
    
    const dayEvents = events.filter(e => 
      e.timestamp >= dayStart && 
      e.timestamp < dayEnd &&
      e.labels.includes('buy')
    );
    
    const newBuyers = dayEvents.filter(e => !knownBuyers.has(e.maker));
    newBuyers.forEach(e => knownBuyers.add(e.maker));
    
    newBuyersPerDay.push({ date: dayStart, count: newBuyers.length });
  }
  
  // Calculate correlation between prior day return and new buyers
  const correlation = calculatePearsonCorrelation(
    dailyReturns.slice(1).map(d => d.return),  // Prior day return
    newBuyersPerDay.slice(1).map(d => d.count)  // Next day new buyers
  );
  
  // Calculate FOMO buyer percentage
  const pumpDays = dailyReturns.filter(d => d.return > 10);
  const buyersAfterPumps = newBuyersPerDay.filter((d, i) => 
    i > 0 && dailyReturns[i-1].return > 10
  );
  const fomoBuyerPct = buyersAfterPumps.reduce((sum, d) => sum + d.count, 0) / 
                       newBuyersPerDay.reduce((sum, d) => sum + d.count, 0);
  
  return {
    tokenAddress,
    priceChangeWindow: '24h',
    newBuyerCorrelation: correlation,
    avgEntryTiming: correlation > 0.3 ? 'late' : correlation < -0.1 ? 'early' : 'middle',
    fomoBuyerPct
  };
}
```

**Interpretation**:
| Correlation | Interpretation |
|-------------|----------------|
| > 0.4 | Strong FOMO behavior (chasing pumps) |
| 0.1-0.4 | Moderate momentum chasing |
| -0.1 to 0.1 | Neutral (no clear pattern) |
| < -0.1 | Contrarian buying (buying dips) |

**Hypothesis**: Community tokens show highest FOMO correlation, MetaDAO tokens show more contrarian or neutral behavior.

---

### 6. Panic Selling Analysis

**Theory**: During market drawdowns, less sophisticated investors panic sell at the worst time.

**Implementation**:

```typescript path=null start=null
interface PanicSellAnalysis {
  tokenAddress: string;
  drawdownThreshold: number;  // e.g., 10% or 20%
  drawdownEvents: Array<{
    startTimestamp: number;
    endTimestamp: number;
    maxDrawdownPct: number;
    sellerCount: number;
    sellerPctOfHolders: number;
    volumeSoldUsd: number;
  }>;
  avgPanicSellRate: number;  // Avg % of holders who sell during drawdowns
  diamondHandsRate: number;  // % who held through all drawdowns
}

async function analyzePanicSelling(
  tokenAddress: string,
  drawdownThreshold: number = 10  // 10% drawdown
): Promise<PanicSellAnalysis> {
  const bars = await codex.getBars(
    `${tokenAddress}:${SOLANA_NETWORK_ID}`,
    from,
    to,
    '1D'
  );
  const events = await codex.getTokenEvents(tokenAddress);
  
  // Identify drawdown periods
  const drawdownPeriods: Array<{
    start: number;
    end: number;
    maxDrawdown: number;
    peak: number;
    trough: number;
  }> = [];
  
  let peak = bars.c[0];
  let peakIdx = 0;
  let inDrawdown = false;
  let drawdownStart = 0;
  
  for (let i = 1; i < bars.c.length; i++) {
    if (bars.c[i] > peak) {
      if (inDrawdown) {
        // Drawdown ended
        drawdownPeriods.push({
          start: bars.t[drawdownStart],
          end: bars.t[i],
          maxDrawdown: ((peak - Math.min(...bars.c.slice(peakIdx, i))) / peak) * 100,
          peak,
          trough: Math.min(...bars.c.slice(peakIdx, i))
        });
        inDrawdown = false;
      }
      peak = bars.c[i];
      peakIdx = i;
    } else {
      const drawdown = ((peak - bars.c[i]) / peak) * 100;
      if (drawdown >= drawdownThreshold && !inDrawdown) {
        inDrawdown = true;
        drawdownStart = i;
      }
    }
  }
  
  // Analyze selling behavior during each drawdown
  const drawdownEvents = [];
  const holdersAtStart = new Set<string>();
  
  for (const period of drawdownPeriods.filter(p => p.maxDrawdown >= drawdownThreshold)) {
    // Get holders before drawdown
    // (would need historical holder data or reconstruct from events)
    
    const sellsDuringDrawdown = events.filter(e =>
      e.timestamp >= period.start &&
      e.timestamp <= period.end &&
      e.labels.includes('sell')
    );
    
    const uniqueSellers = new Set(sellsDuringDrawdown.map(e => e.maker));
    
    drawdownEvents.push({
      startTimestamp: period.start,
      endTimestamp: period.end,
      maxDrawdownPct: period.maxDrawdown,
      sellerCount: uniqueSellers.size,
      sellerPctOfHolders: uniqueSellers.size / holdersAtStart.size || 0,
      volumeSoldUsd: sellsDuringDrawdown.reduce((sum, e) => sum + e.priceUsd * e.amount, 0)
    });
  }
  
  return {
    tokenAddress,
    drawdownThreshold,
    drawdownEvents,
    avgPanicSellRate: drawdownEvents.reduce((sum, d) => sum + d.sellerPctOfHolders, 0) / 
                      drawdownEvents.length || 0,
    diamondHandsRate: calculateDiamondHandsRate(tokenAddress, drawdownPeriods)
  };
}
```

**Diamond Hands Resilience Metric**:
```typescript path=null start=null
interface DiamondHandsMetrics {
  tokenAddress: string;
  holdersAnalyzed: number;
  diamondHandsCount: number;  // Held through ≥1 major drawdown (>20%)
  diamondHandsPct: number;
  avgDrawdownsHeldThrough: number;
  maxDrawdownHeldThrough: number;
}
```

**Interpretation**:
| Panic Sell Rate | Interpretation |
|-----------------|----------------|
| > 30% | Weak hands (high panic selling) |
| 15-30% | Moderate resilience |
| 5-15% | Strong hands |
| < 5% | Diamond hands (very resilient) |

---

### 7. Smart Money vs Dumb Money Timing

**Theory**: Profitable wallets (smart money) time their entries/exits better than unprofitable wallets (dumb money).

**Implementation**:

```typescript path=null start=null
interface SmartMoneyAnalysis {
  tokenAddress: string;
  smartMoneyTiming: {
    avgEntryPercentile: number;  // 0 = bought at bottom, 100 = bought at top
    avgExitPercentile: number;   // 0 = sold at bottom, 100 = sold at top
  };
  dumbMoneyTiming: {
    avgEntryPercentile: number;
    avgExitPercentile: number;
  };
  timingDifferential: number;  // Smart - Dumb (positive = smart money times better)
}

async function analyzeSmartMoney(
  tokenAddress: string
): Promise<SmartMoneyAnalysis> {
  const holders = await codex.getHolders(tokenAddress);
  const events = await codex.getTokenEvents(tokenAddress);
  const bars = await codex.getBars(`${tokenAddress}:${SOLANA_NETWORK_ID}`, from, to, '1D');
  
  // Get wallet stats to classify smart vs dumb money
  const walletStats = await Promise.all(
    holders.items.slice(0, 100).map(h => 
      codex.getWalletStats(h.address)
    )
  );
  
  const smartMoney = walletStats
    .filter(w => w && w.pnlPercent > 0)
    .map(w => w!.walletAddress);
  const dumbMoney = walletStats
    .filter(w => w && w.pnlPercent <= 0)
    .map(w => w!.walletAddress);
  
  // Calculate price percentile for each timestamp
  const priceMin = Math.min(...bars.c);
  const priceMax = Math.max(...bars.c);
  const getPricePercentile = (price: number) => 
    ((price - priceMin) / (priceMax - priceMin)) * 100;
  
  // Analyze entry timing
  const smartEntries = events
    .filter(e => smartMoney.includes(e.maker) && e.labels.includes('buy'))
    .map(e => getPricePercentile(e.priceUsd));
  
  const dumbEntries = events
    .filter(e => dumbMoney.includes(e.maker) && e.labels.includes('buy'))
    .map(e => getPricePercentile(e.priceUsd));
  
  // Analyze exit timing
  const smartExits = events
    .filter(e => smartMoney.includes(e.maker) && e.labels.includes('sell'))
    .map(e => getPricePercentile(e.priceUsd));
  
  const dumbExits = events
    .filter(e => dumbMoney.includes(e.maker) && e.labels.includes('sell'))
    .map(e => getPricePercentile(e.priceUsd));
  
  return {
    tokenAddress,
    smartMoneyTiming: {
      avgEntryPercentile: avg(smartEntries),  // Lower = buys lower
      avgExitPercentile: avg(smartExits)      // Higher = sells higher
    },
    dumbMoneyTiming: {
      avgEntryPercentile: avg(dumbEntries),
      avgExitPercentile: avg(dumbExits)
    },
    timingDifferential: 
      (avg(smartExits) - avg(smartEntries)) - 
      (avg(dumbExits) - avg(dumbEntries))
  };
}
```

**Interpretation**:
| Timing Differential | Interpretation |
|---------------------|----------------|
| > 20 | Strong smart/dumb divergence |
| 10-20 | Moderate divergence |
| 0-10 | Weak divergence |
| < 0 | Counter-intuitive (dumb money outperforming) |

---

## Comparative Framework: MetaDAO vs Other Categories

### Category Definitions

| Category | Description | Expected Bias Level |
|----------|-------------|---------------------|
| `metadao` | Core MetaDAO ecosystem | Low (sophisticated) |
| `metadao-ico` | MetaDAO ICO participants | Low-Medium |
| `futarchy-dao` | Other futarchy tokens | Low |
| `vc-backed` | Traditional VC-funded | Medium-High |
| `community` | Meme/community tokens | High (retail-driven) |

### Hypothesis Matrix

| Bias | MetaDAO | VC-Backed | Community |
|------|---------|-----------|-----------|
| Disposition Effect | Low | Medium | High |
| Loss Aversion | Moderate | Moderate | High |
| Herding | Low | Medium | Very High |
| Anchoring | Low | Medium | High |
| FOMO Entry | Low | Low-Medium | Very High |
| Panic Selling | Low | Medium | Very High |

### Aggregate Behavioral Score

```typescript path=null start=null
interface BehavioralBiasScore {
  tokenAddress: string;
  category: TokenCategory;
  
  // Individual scores (0-100, higher = more behavioral/biased)
  dispositionScore: number;
  lossAversionScore: number;
  herdingScore: number;
  anchoringScore: number;
  fomoScore: number;
  panicScore: number;
  
  // Composite
  compositeBiasScore: number;  // Weighted average
  rationalityRank: number;  // Percentile rank vs all tokens
}

function calculateCompositeBiasScore(metrics: BiasMetrics): number {
  const weights = {
    disposition: 0.20,
    lossAversion: 0.15,
    herding: 0.20,
    anchoring: 0.10,
    fomo: 0.15,
    panic: 0.20
  };
  
  return (
    metrics.dispositionScore * weights.disposition +
    metrics.lossAversionScore * weights.lossAversion +
    metrics.herdingScore * weights.herding +
    metrics.anchoringScore * weights.anchoring +
    metrics.fomoScore * weights.fomo +
    metrics.panicScore * weights.panic
  );
}
```

---

## Data Requirements & API Mapping

### Required Codex API Calls

| Metric | Primary API | Supporting APIs |
|--------|-------------|-----------------|
| Disposition Effect | `getTokenEvents()` | `getTokenPrice()`, `getHolders()` |
| Loss Aversion | `getTokenEvents()` | `getBars()` |
| Herding | `getTokenEvents()` | `getTokenInfo()` (for supply) |
| Anchoring | `getTokenEvents()` | - |
| FOMO | `getTokenEvents()` | `getBars()` |
| Panic Selling | `getTokenEvents()` | `getBars()`, `getHolders()` |
| Smart Money | `getWalletStats()` | `getTokenEvents()`, `getBars()` |

### Data Granularity Requirements

- **Minimum history**: 90 days for meaningful behavior analysis
- **Event sampling**: All events (no sampling) for accurate P/L tracking
- **Price data**: Daily bars sufficient for most metrics
- **Holder snapshots**: Weekly for turnover analysis

### API Rate Limiting Considerations

Per-token analysis requires:
- 1 call: `getTokenInfo()`
- 1+ calls: `getHolders()` (paginated, ~10 calls for 1000 holders)
- 1+ calls: `getTokenEvents()` (paginated by time window)
- 1 call: `getBars()`
- N calls: `getWalletStats()` for each wallet analyzed

**Recommendation**: Batch wallet stats calls, cache holder/event data, use 30 req/min rate limit.

---

## Implementation Roadmap

### Phase 1: Core Metrics (Week 1-2)
1. Implement disposition effect calculator
2. Build sell probability curves
3. Create basic herding detection

### Phase 2: Advanced Analysis (Week 3-4)
1. Anchoring analysis with visualization
2. FOMO correlation studies
3. Panic selling metrics

### Phase 3: Comparative Framework (Week 5-6)
1. Smart money analysis
2. Cross-category comparisons
3. Composite bias scores

### Phase 4: Visualization & Dashboard (Week 7-8)
1. Interactive charts for each bias
2. Token comparison views
3. Category-level aggregations

---

## References

1. Shefrin, H., & Statman, M. (1985). The Disposition to Sell Winners Too Early and Ride Losers Too Long: Theory and Evidence. *The Journal of Finance*, 40(3), 777-790.

2. Kahneman, D., & Tversky, A. (1979). Prospect Theory: An Analysis of Decision under Risk. *Econometrica*, 47(2), 263-291.

3. Odean, T. (1998). Are Investors Reluctant to Realize Their Losses? *The Journal of Finance*, 53(5), 1775-1798.

4. Barber, B. M., & Odean, T. (2000). Trading Is Hazardous to Your Wealth: The Common Stock Investment Performance of Individual Investors. *The Journal of Finance*, 55(2), 773-806.

5. Grinblatt, M., & Keloharju, M. (2001). What Makes Investors Trade? *The Journal of Finance*, 56(2), 589-616.

6. Bikhchandani, S., & Sharma, S. (2000). Herd Behavior in Financial Markets. *IMF Staff Papers*, 47(3), 279-310.

---

*Last updated: February 2026*
*Author: MetaDAO Holder Analytics Research Team*
