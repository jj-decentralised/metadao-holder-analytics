# Holder Concentration Time-Series Pattern Analysis Methodology

This document outlines the analytical framework for detecting and visualizing patterns in token holder distribution over time, with specific focus on validating the MetaDAO hypothesis that futarchy governance leads to more decentralized holding patterns.

## Table of Contents

1. [Accumulation/Distribution Detection](#1-accumulationdistribution-detection)
2. [Holder Cohort Analysis](#2-holder-cohort-analysis)
3. [Decentralization Score Evolution](#3-decentralization-score-evolution)
4. [Visualization Approaches](#4-visualization-approaches)
5. [Implementation Recommendations](#5-implementation-recommendations)

---

## 1. Accumulation/Distribution Detection

### 1.1 Problem Statement

Detecting whether large holders (whales) are accumulating or distributing tokens is critical for understanding market structure and governance power dynamics. Accumulation phases typically precede governance proposals or price movements, while distribution phases may indicate loss of conviction or profit-taking.

### 1.2 Whale Accumulation Detection

**Definition**: Accumulation occurs when whale addresses (≥1% of supply) systematically increase their position sizes over time.

#### Statistical Methods

**1. Moving Average on Whale Holdings**

Track the total percentage of supply held by whale addresses using exponential moving averages (EMA) to smooth noise:

```
EMA_whale(t) = α × whale_pct(t) + (1 - α) × EMA_whale(t-1)
```

Where α = 2/(N+1) for N-period EMA. Recommended periods:
- Short-term: 7-day EMA (α ≈ 0.25)
- Medium-term: 21-day EMA (α ≈ 0.09)
- Long-term: 50-day EMA (α ≈ 0.04)

**Accumulation Signal**: Short EMA crosses above long EMA while total whale holdings increase.

**2. Rate of Change (ROC) Analysis**

```
ROC_whale(t, n) = (whale_pct(t) - whale_pct(t-n)) / whale_pct(t-n) × 100
```

Thresholds for accumulation detection:
- Mild accumulation: ROC > 5% over 7 days
- Strong accumulation: ROC > 15% over 7 days
- Sustained accumulation: ROC > 5% for 3+ consecutive weeks

**3. Individual Whale Tracking**

Track position changes for each whale address:

```typescript
interface WhalePositionChange {
  address: string;
  startBalance: number;
  endBalance: number;
  percentChange: number;
  action: 'accumulating' | 'distributing' | 'holding';
}

function classifyWhaleAction(startPct: number, endPct: number): string {
  const change = (endPct - startPct) / startPct;
  if (change > 0.10) return 'accumulating';
  if (change < -0.10) return 'distributing';
  return 'holding';
}
```

### 1.3 Distribution Phase Detection

**Definition**: Distribution occurs when whales sell to retail, typically characterized by:
- Decreasing whale concentration
- Increasing holder count
- Stable or increasing total supply held by retail cohorts

#### Breakpoint Detection Methods

**1. CUSUM (Cumulative Sum) Control Charts**

Detect shifts in the mean of whale holdings:

```
S_t = max(0, S_{t-1} + (x_t - μ_0 - k))
```

Where:
- `μ_0` = target mean (historical average whale concentration)
- `k` = allowance parameter (typically 0.5σ)
- Signal when `S_t > h` (threshold, typically 4-5σ)

**2. Pettitt Test for Change Point Detection**

Non-parametric test to identify a single change point in a time series:

```
K_T = max|U_{t,T}|  where  U_{t,T} = Σᵢ₌₁ᵗ Σⱼ₌ₜ₊₁ᵀ sgn(Xᵢ - Xⱼ)
```

Useful for detecting when whale-to-retail distribution began.

**3. Regime Change Detection**

Use hidden Markov models (HMM) with two states:
- State A: Accumulation regime (whale holdings increasing)
- State B: Distribution regime (whale holdings decreasing)

### 1.4 Composite Accumulation/Distribution Index

Combine signals into a single indicator:

```typescript
interface AccDistIndex {
  timestamp: number;
  score: number;        // -100 (heavy distribution) to +100 (heavy accumulation)
  whaleNetFlow: number; // Net change in whale holdings
  retailNetFlow: number;
  priceCorrelation: number;
}

function calculateAccDistIndex(
  whaleROC: number,
  retailROC: number,
  holderCountChange: number
): number {
  // Weighted combination
  const whaleWeight = 0.5;
  const retailWeight = 0.3;
  const holderWeight = 0.2;
  
  // Normalize each component to -1 to +1 range
  const whaleSignal = Math.tanh(whaleROC / 20);
  const retailSignal = Math.tanh(-retailROC / 20); // Inverse: retail gaining = distribution
  const holderSignal = Math.tanh(holderCountChange / 10);
  
  return (whaleSignal * whaleWeight + 
          retailSignal * retailWeight + 
          holderSignal * holderWeight) * 100;
}
```

---

## 2. Holder Cohort Analysis

### 2.1 Cohort Definitions

Based on percentage of total supply held, aligned with existing `holderBuckets()` function but with refined boundaries:

| Cohort | Supply % Range | Rationale |
|--------|----------------|-----------|
| **Whales** | ≥ 1% | Single holder can significantly impact governance votes |
| **Large Holders** | 0.1% – 1% | Collectively powerful, individually significant |
| **Medium Holders** | 0.01% – 0.1% | Active community members, potential governance participants |
| **Retail** | < 0.01% | Mass adoption indicator, limited individual governance power |

**Alternative: Market Cap-Based Thresholds**

For cross-token comparison, consider USD-value thresholds:
- Whale: > $100,000
- Large: $10,000 – $100,000
- Medium: $1,000 – $10,000
- Retail: < $1,000

### 2.2 Cohort Tracking Over Time

```typescript
interface CohortSnapshot {
  timestamp: number;
  cohorts: {
    whale: CohortMetrics;
    large: CohortMetrics;
    medium: CohortMetrics;
    retail: CohortMetrics;
  };
}

interface CohortMetrics {
  count: number;           // Number of addresses in cohort
  totalSupply: number;     // Absolute tokens held
  supplyPercent: number;   // Percentage of total supply
  avgHolding: number;      // Average holding per address
  medianHolding: number;   // Median holding per address
}
```

Track these metrics at regular intervals (daily/weekly) to build time series.

### 2.3 Net Flow Between Cohorts

**Flow Matrix Analysis**

Track address movements between cohorts over each period:

```typescript
interface CohortFlowMatrix {
  period: { start: number; end: number };
  flows: {
    [fromCohort: string]: {
      [toCohort: string]: {
        addressCount: number;  // Number of addresses that moved
        supplyMoved: number;   // Tokens that moved with those addresses
      };
    };
  };
  netFlow: {
    [cohort: string]: {
      addresses: number;  // Net address gain/loss
      supply: number;     // Net supply gain/loss
    };
  };
}
```

**Interpretation Guidelines**:

- **Healthy decentralization**: Positive net flow into medium/retail from whale/large
- **Whale consolidation**: Positive net flow into whale from all other cohorts
- **New entrant pattern**: Large positive retail count with small per-address holdings

### 2.4 Cohort Velocity Metrics

Measure how quickly addresses move between cohorts:

```typescript
function cohortVelocity(flows: CohortFlowMatrix[], periods: number): number {
  // Sum all inter-cohort movements over periods
  const totalMovements = flows.reduce((sum, f) => {
    let periodMoves = 0;
    for (const from in f.flows) {
      for (const to in f.flows[from]) {
        if (from !== to) periodMoves += f.flows[from][to].addressCount;
      }
    }
    return sum + periodMoves;
  }, 0);
  
  // Normalize by total addresses and periods
  const avgAddresses = /* average total addresses over period */;
  return totalMovements / (avgAddresses * periods);
}
```

High velocity indicates active trading; low velocity indicates sticky holders.

---

## 3. Decentralization Score Evolution

### 3.1 Current Metrics (from `distribution.ts`)

The codebase already implements key distribution metrics:

| Metric | Range | Better Decentralization |
|--------|-------|-------------------------|
| Gini Coefficient | 0 – 1 | Lower |
| HHI (10000 scale) | 0 – 10000 | Lower |
| Nakamoto Coefficient | 1 – ∞ | Higher |
| Palma Ratio | 0 – ∞ | Lower |
| Shannon Entropy | 0 – log₂(n) | Higher |
| Normalized Entropy | 0 – 1 | Higher |

### 3.2 Time-Series Patterns for Healthy Decentralization

**Pattern 1: Gradual Improvement**
```
Gini(t) < Gini(t - 30d) < Gini(t - 90d)
Nakamoto(t) > Nakamoto(t - 30d) > Nakamoto(t - 90d)
```

Steady month-over-month improvement indicates organic distribution.

**Pattern 2: Stair-Step Decentralization**

Large discrete improvements (often after:)
- Airdrops to new addresses
- Protocol incentive distributions
- Major exchange listings (increases retail access)

**Pattern 3: Event-Driven Spikes**

Temporary concentration increases followed by return to trend:
- Governance votes (temporary delegation)
- Liquidity events (LP positions consolidated)

### 3.3 MetaDAO Hypothesis Testing

**Hypothesis**: Futarchy governance leads to MORE decentralized holding patterns compared to traditional VC-backed tokens.

**Metrics to Compare**:

```typescript
interface DecentralizationComparison {
  tokenId: string;
  category: 'metadao' | 'vc-backed' | 'community';
  metrics: {
    giniTrend: number;      // Slope of Gini over 90 days
    nakamotoTrend: number;  // Slope of Nakamoto coefficient
    entropyTrend: number;   // Slope of normalized entropy
    holderGrowthRate: number;
    whaleConcentrationChange: number;
  };
}
```

**Statistical Tests**:

1. **Two-sample t-test**: Compare mean Gini between MetaDAO and VC tokens
2. **Mann-Whitney U test**: Non-parametric alternative for skewed distributions
3. **Trend correlation**: Compare slopes of decentralization metrics

**Expected Results for MetaDAO Tokens**:
- Lower Gini coefficients (more equal distribution)
- Higher Nakamoto coefficients (more entities needed for 51%)
- Positive holder growth rate
- Decreasing whale concentration over time

### 3.4 Composite Decentralization Health Score

Extend the existing `decentralizationScore()` function with time-series awareness:

```typescript
interface TemporalDecentralizationScore {
  current: DecentralizationScore;
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    velocity: number;  // Rate of change in overall score
    confidence: number; // Based on data points and variance
  };
  momentum: {
    shortTerm: number;  // 7-day momentum
    mediumTerm: number; // 30-day momentum
    longTerm: number;   // 90-day momentum
  };
  alerts: Array<{
    type: 'whale_accumulation' | 'rapid_concentration' | 'holder_exodus';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;
}
```

### 3.5 Benchmark Thresholds

Define what "healthy" looks like:

| Metric | Poor | Fair | Good | Excellent |
|--------|------|------|------|-----------|
| Gini | > 0.9 | 0.8 – 0.9 | 0.6 – 0.8 | < 0.6 |
| Nakamoto | 1 – 2 | 3 – 5 | 6 – 15 | > 15 |
| HHI | > 2500 | 1500 – 2500 | 500 – 1500 | < 500 |
| Normalized Entropy | < 0.3 | 0.3 – 0.5 | 0.5 – 0.7 | > 0.7 |

Note: These thresholds are calibrated for crypto tokens. Traditional equity markets have different norms.

---

## 4. Visualization Approaches

### 4.1 Stacked Area Chart for Cohort Sizes

**Purpose**: Show how supply distribution across cohorts evolves over time.

**Implementation** (using Recharts, consistent with existing codebase):

```typescript
interface CohortAreaData {
  timestamp: number;
  date: string;
  whale: number;      // % of supply
  large: number;
  medium: number;
  retail: number;
}

// Stack order: bottom to top = retail → medium → large → whale
// This emphasizes changes in whale concentration at the top
```

**Design Considerations**:
- Use color gradient from light (retail) to dark (whale)
- Add annotations for significant events (airdrops, governance votes)
- Provide toggle to show absolute values vs percentages
- Consider secondary y-axis for holder count

### 4.2 Animated Lorenz Curves

**Purpose**: Visualize how distribution inequality changes over time.

**Implementation**:

```typescript
interface AnimatedLorenzProps {
  snapshots: Array<{
    timestamp: number;
    points: Array<{ x: number; y: number }>;
    gini: number;
  }>;
  playbackSpeed: number; // ms per frame
  showTrail: boolean;    // Keep previous curves visible (faded)
}
```

**Features**:
- Playback controls (play/pause, speed adjustment)
- Timeline scrubber for manual navigation
- Gini coefficient display that updates in real-time
- Option to overlay multiple tokens for comparison
- Trail effect showing curve evolution

**Visual Encoding**:
- Current curve: solid, full opacity
- Historical curves: increasingly transparent
- Equality line: dashed, always visible
- Shaded area between curve and equality = visual Gini representation

### 4.3 Whale Position Heatmap

**Purpose**: Show individual whale behavior patterns over time.

**Data Structure**:

```typescript
interface WhaleHeatmapData {
  addresses: string[]; // Y-axis: whale addresses (anonymized or labeled)
  timestamps: number[]; // X-axis: time periods
  values: number[][];   // Position size at each time for each whale
  // values[addressIndex][timestampIndex] = holding percentage
}
```

**Visual Design**:
- Color scale: red (decreasing) → white (stable) → green (increasing)
- Alternative: absolute holdings with sequential color scale
- Row sorting options: by current holdings, by change, by activity
- Highlight rows with significant changes

**Interaction**:
- Hover for exact values and address details
- Click row to see detailed history
- Filter by behavior type (accumulators only, distributors only)

### 4.4 Price-Concentration Correlation Chart

**Purpose**: Identify relationships between price movements and holder behavior.

**Dual-Axis Implementation**:

```typescript
interface PriceConcentrationData {
  timestamp: number;
  price: number;
  priceChange24h: number;
  gini: number;
  giniChange: number;
  whalePercent: number;
  whaleChange: number;
  correlation30d: number; // Rolling 30-day correlation
}
```

**Visualization Options**:

1. **Dual-axis line chart**:
   - Left axis: Price
   - Right axis: Gini coefficient
   - Shaded regions indicating correlation strength

2. **Scatter plot**:
   - X-axis: Price change %
   - Y-axis: Gini change
   - Color: Time (recent = darker)
   - Regression line with confidence interval

3. **Rolling correlation line**:
   - Single metric showing how price and concentration move together
   - Helps identify regime changes

**Correlation Interpretation**:
- Positive correlation: Price up → concentration increases (whales buying rallies)
- Negative correlation: Price up → concentration decreases (whales distributing into strength)
- Near-zero: No clear relationship

### 4.5 Decentralization Dashboard Widgets

**Summary KPIs**:

```typescript
interface DecentralizationKPIs {
  currentScore: number;
  scoreChange7d: number;
  scoreChange30d: number;
  trend: 'up' | 'down' | 'flat';
  percentile: number; // Relative to other tokens
  alerts: number;
}
```

**Spark Charts**:
- Mini time-series for each metric (Gini, Nakamoto, HHI, Entropy)
- 30-day window with current value annotation
- Color-coded by trend direction

---

## 5. Implementation Recommendations

### 5.1 Data Collection Strategy

**Snapshot Frequency**:
- Minimum: Daily snapshots
- Ideal: 4-hour snapshots for high-activity tokens
- Archive: Weekly rollups for historical storage efficiency

**Required Data Points Per Snapshot**:
```typescript
interface HolderSnapshot {
  tokenId: string;
  timestamp: number;
  blockNumber?: number;
  holders: Array<{
    address: string;
    balance: number;
    // Optional enrichments
    label?: string;        // "Binance Hot Wallet", "Team Multisig", etc.
    isContract?: boolean;
    firstSeen?: number;
  }>;
  totalSupply: number;
  circulatingSupply?: number;
}
```

### 5.2 New Functions to Implement

**In `distribution.ts`**:

```typescript
// Time-series analysis functions
export function giniTimeSeries(snapshots: HolderSnapshot[]): TimeSeriesPoint[];
export function concentrationMovingAverage(
  data: TimeSeriesPoint[],
  period: number,
  type: 'sma' | 'ema'
): TimeSeriesPoint[];
export function detectConcentrationBreakpoints(
  data: TimeSeriesPoint[],
  sensitivity: number
): BreakpointResult[];
```

**In `behavior.ts`**:

```typescript
// Cohort flow analysis
export function calculateCohortFlows(
  snapshot1: HolderSnapshot,
  snapshot2: HolderSnapshot,
  thresholds: CohortThresholds
): CohortFlowMatrix;

// Accumulation/Distribution index
export function accumulationDistributionIndex(
  snapshots: HolderSnapshot[],
  window: number
): AccDistPoint[];
```

**New file `src/lib/metrics/timeseries.ts`**:

```typescript
// Statistical functions for time-series analysis
export function rollingCorrelation(
  series1: number[],
  series2: number[],
  window: number
): number[];

export function detectTrend(
  data: number[],
  significance?: number
): TrendResult;

export function pettittTest(
  data: number[]
): ChangePointResult;
```

### 5.3 API Endpoints to Add

```
GET /api/tokens/[id]/concentration/history
  Query params: start, end, interval (hourly|daily|weekly)
  Returns: Time series of concentration metrics

GET /api/tokens/[id]/cohorts/history
  Query params: start, end, interval
  Returns: Cohort breakdown over time

GET /api/tokens/[id]/flows
  Query params: start, end
  Returns: Inter-cohort flow matrix

GET /api/tokens/[id]/accumulation-distribution
  Query params: window (days)
  Returns: Acc/Dist index time series
```

### 5.4 Database Schema Considerations

For efficient time-series queries, consider:

```sql
-- Holder snapshots (append-only)
CREATE TABLE holder_snapshots (
  id SERIAL PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  address VARCHAR(64) NOT NULL,
  balance NUMERIC(78, 0) NOT NULL, -- Supports uint256
  UNIQUE(token_id, timestamp, address)
);

-- Pre-computed metrics (materialized view or separate table)
CREATE TABLE concentration_metrics (
  token_id VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  gini DECIMAL(10, 6),
  hhi DECIMAL(10, 2),
  nakamoto INT,
  entropy DECIMAL(10, 6),
  whale_count INT,
  whale_percent DECIMAL(10, 6),
  total_holders INT,
  PRIMARY KEY (token_id, timestamp)
);

-- Index for time-range queries
CREATE INDEX idx_metrics_token_time 
ON concentration_metrics(token_id, timestamp DESC);
```

### 5.5 Testing the MetaDAO Hypothesis

**Experimental Design**:

1. **Sample Selection**:
   - MetaDAO group: META and ecosystem tokens launched via futarchy
   - Control group: VC-backed tokens with similar market cap and launch date
   - Community baseline: Memecoins/fair-launch tokens for comparison

2. **Time Period**: Minimum 6 months of data post-launch

3. **Metrics to Compare**:
   - Initial Gini coefficient at launch
   - Gini coefficient trajectory (slope)
   - Time to reach Nakamoto > 10
   - Whale concentration stability (variance)
   - Holder growth rate

4. **Statistical Analysis**:
   - Paired comparisons where possible (match by launch date, market cap)
   - Control for token utility and sector
   - Report effect sizes, not just p-values

---

## References

1. Gini, C. (1912). "Variabilità e mutabilità"
2. Herfindahl, O. C. (1950). "Concentration in the Steel Industry"
3. Nakamoto, S. (2008). "Bitcoin: A Peer-to-Peer Electronic Cash System"
4. Palma, J. G. (2011). "Homogeneous Middles vs. Heterogeneous Tails"
5. Shannon, C. E. (1948). "A Mathematical Theory of Communication"

---

*Document version: 1.0*
*Last updated: 2026-02-12*
*Author: MetaDAO Holder Analytics Research*
