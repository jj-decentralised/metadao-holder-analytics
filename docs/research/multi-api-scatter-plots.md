# Multi-API Scatter Plot Research

Comprehensive documentation of scatter plots and cross-sectional visualizations achievable by combining data from CoinGecko, DeFiLlama, and Codex APIs for the MetaDAO Holder Analytics platform.

## API Data Inventory

### CoinGecko API
**Base:** `https://api.coingecko.com/api/v3`

| Endpoint | Data Points | Rate Limit |
|----------|-------------|------------|
| `/simple/price` | price, volume24h, marketCap, change24h | 30/min (free) |
| `/coins/{id}/market_chart` | historical price, volume, marketCap | 30/min |
| `/coins/{id}/ohlc` | OHLCV candles | 30/min |
| `/coins/{id}` | **full data** (see below) | 30/min |
| `/coins/markets` | batch market data | 30/min |
| `/search` | token discovery | 30/min |

**Full Coin Data (`/coins/{id}`)** - Not yet implemented:
- `market_cap`, `market_cap_rank`, `fully_diluted_valuation`
- `total_volume`, `high_24h`, `low_24h`
- `price_change_24h`, `price_change_percentage_24h/7d/14d/30d/60d/200d/1y`
- `market_cap_change_24h`, `market_cap_change_percentage_24h`
- `circulating_supply`, `total_supply`, `max_supply`
- `ath`, `ath_change_percentage`, `ath_date`
- `atl`, `atl_change_percentage`, `atl_date`
- **Community data**: `twitter_followers`, `reddit_subscribers`, `reddit_average_posts_48h`, `telegram_channel_user_count`
- **Developer data**: `github_forks`, `github_stars`, `github_subscribers`, `github_total_issues`, `github_closed_issues`, `github_pull_requests_merged`, `github_commit_count_4_weeks`
- `coingecko_score`, `developer_score`, `community_score`, `liquidity_score`

### DeFiLlama API
**Base:** `https://api.llama.fi` / `https://coins.llama.fi`

| Endpoint | Data Points | Rate Limit |
|----------|-------------|------------|
| `/prices/current/{coins}` | price, timestamp, confidence | 60/min |
| `/chart/{coins}` | historical prices | 60/min |
| `/protocol/{slug}` | tvl, chainTvls, raises | 60/min |
| `/protocols` | all protocols list | 60/min |
| `/overview/fees` | **fees overview** | 60/min |
| `/summary/fees/{protocol}` | **protocol fees** | 60/min |
| `/summary/revenue/{protocol}` | **protocol revenue** | 60/min |
| `/raises` | **all funding rounds** | 60/min |

**Protocol Data** (already partially implemented):
- `tvl` (current), `chainTvls` (by chain)
- `raises`: `[{ amount, round, date, leadInvestors, otherInvestors }]`

**Fees/Revenue Endpoints** (not yet implemented):
- `total24h`, `total7d`, `total30d` for fees
- `total24h`, `total7d`, `total30d` for revenue
- `dailyRevenue`, `dailyFees` time series
- `holdersRevenue` (revenue distributed to token holders)

### Codex API (GraphQL)
**Base:** `https://graph.codex.io/graphql`

| Query | Data Points | Rate Limit |
|-------|-------------|------------|
| `token` | holderCount, totalSupply, decimals, createdAt, creatorAddress | 30/min |
| `holders` | address, balance, percentOwned (paginated) | 30/min |
| `getBars` | OHLCV with buy/sell volume split | 30/min |
| `getTokenPrices` | current/historical prices | 30/min |
| `getTokenEvents` | trading events with labels | 30/min |
| `filterTokens` | discovery by volume, holders, liquidity | 30/min |
| `getDetailedPairStats` | buyVolume, sellVolume, buyers, sellers, liquidity | 30/min |
| `detailedWalletStats` | totalValueUsd, pnlUsd, pnlPercent | 30/min |

**Derived Metrics** (calculated from holder data):
- Gini coefficient
- HHI (Herfindahl-Hirschman Index)
- Nakamoto coefficient
- Palma ratio
- Shannon entropy
- Top 1%/10% concentration

---

## Scatter Plot Proposals

### Category 1: Market vs Distribution

#### 1.1 Market Cap vs Gini Coefficient
- **X-axis:** Market Cap (USD) — log scale
- **Y-axis:** Gini Coefficient (0-1)
- **Data Sources:**
  - X: CoinGecko `/simple/price` → `usd_market_cap`
  - Y: Codex `holders` → calculate Gini from `percentOwned`
- **Expected Insight:** Do larger tokens have better or worse distribution? Tests if size correlates with centralization.
- **Color by:** Category (metadao, futarchy-dao, vc-backed, community)
- **Implementation:** ✅ Ready (both APIs implemented)

#### 1.2 FDV/MC Ratio vs Top 10% Concentration
- **X-axis:** FDV/MC ratio (Fully Diluted Valuation / Market Cap)
- **Y-axis:** Top 10% holder concentration (%)
- **Data Sources:**
  - X: CoinGecko `/coins/{id}` → `fully_diluted_valuation / market_cap`
  - Y: Codex `holders` → sum top 10% `percentOwned`
- **Expected Insight:** Tokens with high unlock schedules (high FDV/MC) may have more concentrated holdings from insiders.
- **Implementation:** 🟡 Needs CoinGecko `/coins/{id}` endpoint

#### 1.3 Market Cap Rank vs Nakamoto Coefficient
- **X-axis:** CoinGecko market cap rank
- **Y-axis:** Nakamoto coefficient (# of addresses to reach 51%)
- **Data Sources:**
  - X: CoinGecko `/coins/{id}` → `market_cap_rank`
  - Y: Codex `holders` → calculate Nakamoto
- **Expected Insight:** Are top-ranked tokens more decentralized?
- **Implementation:** 🟡 Needs CoinGecko `/coins/{id}` endpoint

---

### Category 2: Revenue/Fees vs Distribution

#### 2.1 Daily Revenue vs Gini Coefficient
- **X-axis:** 24h Revenue (USD) — log scale
- **Y-axis:** Gini Coefficient
- **Data Sources:**
  - X: DeFiLlama `/summary/revenue/{protocol}` → `total24h`
  - Y: Codex `holders` → Gini calculation
- **Expected Insight:** Do revenue-generating protocols have better token distribution?
- **Implementation:** 🔴 Needs DeFiLlama revenue endpoint

#### 2.2 Fee Revenue vs Holder Count
- **X-axis:** 30d Fees (USD) — log scale
- **Y-axis:** Total holder count
- **Data Sources:**
  - X: DeFiLlama `/summary/fees/{protocol}` → `total30d`
  - Y: Codex `token` → `holderCount`
- **Expected Insight:** Correlation between protocol usage (fees) and holder base growth.
- **Implementation:** 🔴 Needs DeFiLlama fees endpoint

#### 2.3 Revenue per Holder vs HHI
- **X-axis:** (Daily Revenue / Holder Count)
- **Y-axis:** HHI (Herfindahl-Hirschman Index)
- **Data Sources:**
  - X: DeFiLlama `/summary/revenue/{protocol}` + Codex `token.holderCount`
  - Y: Codex `holders` → HHI calculation
- **Expected Insight:** Are tokens with higher per-holder value capture more or less concentrated?
- **Implementation:** 🔴 Needs DeFiLlama revenue endpoint

---

### Category 3: TVL & Protocol Metrics

#### 3.1 TVL vs Gini Coefficient
- **X-axis:** Total Value Locked (USD) — log scale
- **Y-axis:** Gini Coefficient
- **Data Sources:**
  - X: DeFiLlama `/protocol/{slug}` → `tvl`
  - Y: Codex `holders` → Gini calculation
- **Expected Insight:** Do DeFi protocols with more TVL have more equitable token distributions?
- **Implementation:** ✅ Ready (both APIs implemented)

#### 3.2 TVL vs Price Volatility
- **X-axis:** TVL (USD) — log scale
- **Y-axis:** 30d price volatility (std dev of daily returns)
- **Data Sources:**
  - X: DeFiLlama `/protocol/{slug}` → `tvl`
  - Y: CoinGecko `/coins/{id}/market_chart` → calculate volatility from price history
- **Expected Insight:** Higher TVL may indicate more stable, established protocols.
- **Implementation:** ✅ Ready

#### 3.3 TVL/MC Ratio vs Holder Growth Rate
- **X-axis:** TVL / Market Cap ratio
- **Y-axis:** 30d holder growth rate (%)
- **Data Sources:**
  - X: DeFiLlama `tvl` / CoinGecko `market_cap`
  - Y: Codex `token.holderCount` (tracked over time)
- **Expected Insight:** Protocols with high TVL relative to MC may attract more holders.
- **Implementation:** 🟡 Needs holder tracking over time

---

### Category 4: Funding & VC Analysis

#### 4.1 VC Raise Amount vs Gini Coefficient
- **X-axis:** Total funding raised (USD) — log scale
- **Y-axis:** Gini Coefficient
- **Data Sources:**
  - X: DeFiLlama `/protocol/{slug}` → sum of `raises[].amount`
  - Y: Codex `holders` → Gini calculation
- **Expected Insight:** Do VC-backed tokens with larger raises have more concentrated holdings?
- **Implementation:** ✅ Ready

#### 4.2 VC Raise Amount vs Nakamoto Coefficient
- **X-axis:** Total funding raised (USD) — log scale
- **Y-axis:** Nakamoto Coefficient
- **Data Sources:**
  - X: DeFiLlama `/protocol/{slug}` → sum of `raises[].amount`
  - Y: Codex `holders` → Nakamoto calculation
- **Expected Insight:** Does more funding lead to worse decentralization?
- **Implementation:** ✅ Ready

#### 4.3 Time Since Raise vs Distribution Equality
- **X-axis:** Days since last funding round
- **Y-axis:** Shannon Entropy (higher = more distributed)
- **Data Sources:**
  - X: DeFiLlama `/protocol/{slug}` → most recent `raises[].date`
  - Y: Codex `holders` → entropy calculation
- **Expected Insight:** Do distributions improve over time as vesting unlocks?
- **Implementation:** ✅ Ready

#### 4.4 Number of VC Investors vs Top 10 Holder %
- **X-axis:** Count of investors (from raises)
- **Y-axis:** Top 10 holder percentage
- **Data Sources:**
  - X: DeFiLlama `/protocol/{slug}` → count unique investors across raises
  - Y: Codex `holders` → sum top 10
- **Expected Insight:** More investors = more potential insider concentration?
- **Implementation:** 🟡 Needs investor parsing from DeFiLlama

---

### Category 5: Age & Maturity

#### 5.1 Token Age vs Gini Coefficient
- **X-axis:** Days since token creation
- **Y-axis:** Gini Coefficient
- **Data Sources:**
  - X: Codex `token.createdAt` or token metadata `launchDate`
  - Y: Codex `holders` → Gini calculation
- **Expected Insight:** Do distributions improve with maturity?
- **Implementation:** ✅ Ready

#### 5.2 Token Age vs Holder Count
- **X-axis:** Days since creation
- **Y-axis:** Total holders — log scale
- **Data Sources:**
  - X: Codex `token.createdAt`
  - Y: Codex `token.holderCount`
- **Expected Insight:** Growth rate comparison across categories.
- **Implementation:** ✅ Ready

#### 5.3 Token Age vs Price Performance (ATH %)
- **X-axis:** Days since creation
- **Y-axis:** Current price / ATH (%)
- **Data Sources:**
  - X: Codex `token.createdAt`
  - Y: CoinGecko `/coins/{id}` → `ath_change_percentage`
- **Expected Insight:** How do different token categories perform over time?
- **Implementation:** 🟡 Needs CoinGecko `/coins/{id}` endpoint

---

### Category 6: Trading Activity

#### 6.1 Buy Pressure vs Gini Coefficient
- **X-axis:** Buy pressure (buyVolume / totalVolume)
- **Y-axis:** Gini Coefficient
- **Data Sources:**
  - X: Codex `getDetailedPairStats` → `buyVolume / volume`
  - Y: Codex `holders` → Gini calculation
- **Expected Insight:** Does buying pressure correlate with distribution changes?
- **Implementation:** ✅ Ready

#### 6.2 Volume/MC Ratio vs Holder Growth
- **X-axis:** 24h Volume / Market Cap
- **Y-axis:** 7d holder change (%)
- **Data Sources:**
  - X: CoinGecko `volume24h / marketCap`
  - Y: Codex holder count change (requires tracking)
- **Expected Insight:** High turnover may indicate speculation vs accumulation.
- **Implementation:** 🟡 Needs holder tracking

#### 6.3 Buyer/Seller Ratio vs Price Change
- **X-axis:** Unique buyers / unique sellers (24h)
- **Y-axis:** 24h price change (%)
- **Data Sources:**
  - X: Codex `getDetailedPairStats` → `buyers / sellers`
  - Y: CoinGecko `change24h`
- **Expected Insight:** Buyer dominance as leading indicator.
- **Implementation:** ✅ Ready

#### 6.4 Liquidity vs Gini Coefficient
- **X-axis:** DEX Liquidity (USD) — log scale
- **Y-axis:** Gini Coefficient
- **Data Sources:**
  - X: Codex `getDetailedPairStats` → `liquidity` or `filterTokens` → `liquidity`
  - Y: Codex `holders` → Gini calculation
- **Expected Insight:** Does liquidity depth correlate with distribution quality?
- **Implementation:** ✅ Ready

---

### Category 7: Community & Developer Activity

#### 7.1 Twitter Followers vs Holder Count
- **X-axis:** Twitter followers — log scale
- **Y-axis:** Holder count — log scale
- **Data Sources:**
  - X: CoinGecko `/coins/{id}` → `community_data.twitter_followers`
  - Y: Codex `token.holderCount`
- **Expected Insight:** Social presence vs actual token holder adoption.
- **Implementation:** 🔴 Needs CoinGecko community data endpoint

#### 7.2 GitHub Commits vs Gini Coefficient
- **X-axis:** GitHub commits (4 weeks)
- **Y-axis:** Gini Coefficient
- **Data Sources:**
  - X: CoinGecko `/coins/{id}` → `developer_data.commit_count_4_weeks`
  - Y: Codex `holders` → Gini calculation
- **Expected Insight:** Active development may attract more distributed holder base.
- **Implementation:** 🔴 Needs CoinGecko developer data endpoint

#### 7.3 Developer Score vs Market Cap
- **X-axis:** CoinGecko developer score
- **Y-axis:** Market Cap — log scale
- **Data Sources:**
  - X: CoinGecko `/coins/{id}` → `developer_score`
  - Y: CoinGecko `market_cap`
- **Expected Insight:** Does development activity correlate with valuation?
- **Implementation:** 🔴 Needs CoinGecko scores endpoint

---

### Category 8: Cross-Category Comparisons

#### 8.1 Category Scatter: Gini vs TVL
- **X-axis:** TVL (USD) — log scale
- **Y-axis:** Gini Coefficient
- **Color/Shape by:** Token category
- **Data Sources:**
  - X: DeFiLlama `tvl`
  - Y: Codex `holders` → Gini
- **Expected Insight:** Visual comparison of MetaDAO/Futarchy vs VC-backed distribution.
- **Implementation:** ✅ Ready

#### 8.2 Category Scatter: Nakamoto vs Market Cap
- **X-axis:** Market Cap — log scale
- **Y-axis:** Nakamoto Coefficient
- **Color by:** Category
- **Data Sources:**
  - X: CoinGecko `marketCap`
  - Y: Codex `holders` → Nakamoto
- **Expected Insight:** Decentralization comparison at similar market caps.
- **Implementation:** ✅ Ready

#### 8.3 Category Scatter: Holder Growth vs Price Performance
- **X-axis:** 30d holder growth (%)
- **Y-axis:** 30d price change (%)
- **Color by:** Category
- **Data Sources:**
  - X: Codex holder tracking
  - Y: CoinGecko `price_change_percentage_30d`
- **Expected Insight:** Which categories grow holders during price appreciation?
- **Implementation:** 🟡 Needs holder tracking + CoinGecko extended data

---

### Category 9: Risk & Stability Metrics

#### 9.1 Price Volatility vs Nakamoto Coefficient
- **X-axis:** 30d price volatility
- **Y-axis:** Nakamoto Coefficient
- **Data Sources:**
  - X: CoinGecko price history → calculate std dev of returns
  - Y: Codex `holders` → Nakamoto
- **Expected Insight:** Does decentralization reduce price manipulation/volatility?
- **Implementation:** ✅ Ready

#### 9.2 Max Drawdown vs Top 1% Concentration
- **X-axis:** Max drawdown from ATH (%)
- **Y-axis:** Top 1% holder concentration
- **Data Sources:**
  - X: CoinGecko `/coins/{id}` → `ath_change_percentage`
  - Y: Codex `holders` → top 1% sum
- **Expected Insight:** Concentrated tokens may experience worse drawdowns.
- **Implementation:** 🟡 Needs CoinGecko ATH data

#### 9.3 Volume Stability vs Gini
- **X-axis:** Volume coefficient of variation (std/mean over 30d)
- **Y-axis:** Gini Coefficient
- **Data Sources:**
  - X: CoinGecko price history volumes → CoV calculation
  - Y: Codex `holders` → Gini
- **Expected Insight:** Stable trading activity may indicate better distribution.
- **Implementation:** ✅ Ready

---

## Implementation Priority

### Tier 1: Ready Now (APIs Implemented)
1. Market Cap vs Gini Coefficient
2. TVL vs Gini Coefficient
3. TVL vs Price Volatility
4. VC Raise Amount vs Gini Coefficient
5. VC Raise Amount vs Nakamoto Coefficient
6. Time Since Raise vs Distribution Equality
7. Token Age vs Gini Coefficient
8. Token Age vs Holder Count
9. Buy Pressure vs Gini Coefficient
10. Buyer/Seller Ratio vs Price Change
11. Liquidity vs Gini Coefficient
12. Category Scatter: Gini vs TVL
13. Category Scatter: Nakamoto vs Market Cap
14. Price Volatility vs Nakamoto Coefficient
15. Volume Stability vs Gini

### Tier 2: Needs CoinGecko `/coins/{id}` Endpoint
1. FDV/MC Ratio vs Top 10% Concentration
2. Market Cap Rank vs Nakamoto Coefficient
3. Token Age vs Price Performance (ATH %)
4. Max Drawdown vs Top 1% Concentration
5. Category Scatter: Holder Growth vs Price Performance

### Tier 3: Needs DeFiLlama Fees/Revenue Endpoints
1. Daily Revenue vs Gini Coefficient
2. Fee Revenue vs Holder Count
3. Revenue per Holder vs HHI

### Tier 4: Needs CoinGecko Community/Developer Data
1. Twitter Followers vs Holder Count
2. GitHub Commits vs Gini Coefficient
3. Developer Score vs Market Cap

### Tier 5: Needs Holder Time-Series Tracking
1. TVL/MC Ratio vs Holder Growth Rate
2. Volume/MC Ratio vs Holder Growth
3. Retention analysis plots

---

## API Endpoints to Implement

### CoinGecko: Full Coin Data
```typescript
// Add to src/lib/api/coingecko.ts
interface CoinFullData {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number;
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    fully_diluted_valuation: { usd: number };
    total_volume: { usd: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    ath: { usd: number };
    ath_change_percentage: { usd: number };
    ath_date: { usd: string };
    circulating_supply: number;
    total_supply: number;
  };
  community_data: {
    twitter_followers: number;
    reddit_subscribers: number;
    telegram_channel_user_count: number;
  };
  developer_data: {
    forks: number;
    stars: number;
    commit_count_4_weeks: number;
    pull_requests_merged: number;
  };
  coingecko_score: number;
  developer_score: number;
  community_score: number;
  liquidity_score: number;
}

async getCoinFullData(id: string): Promise<CoinFullData> {
  return this.fetch(`/coins/${id}`, {
    localization: 'false',
    tickers: 'false',
    community_data: 'true',
    developer_data: 'true',
  });
}
```

### DeFiLlama: Fees & Revenue
```typescript
// Add to src/lib/api/defillama.ts
interface ProtocolFees {
  total24h: number;
  total7d: number;
  total30d: number;
  dailyFees: Array<{ date: string; value: number }>;
}

interface ProtocolRevenue {
  total24h: number;
  total7d: number;
  total30d: number;
  dailyRevenue: Array<{ date: string; value: number }>;
  holdersRevenue?: number;
}

async getProtocolFees(protocol: string): Promise<ProtocolFees | null> {
  return this.fetch(`${LLAMA_API}/summary/fees/${protocol}`);
}

async getProtocolRevenue(protocol: string): Promise<ProtocolRevenue | null> {
  return this.fetch(`${LLAMA_API}/summary/revenue/${protocol}`);
}

async getAllRaises(): Promise<Array<{
  name: string;
  amount: number;
  round: string;
  date: string;
  leadInvestors: string[];
}>> {
  return this.fetch(`${LLAMA_API}/raises`);
}
```

---

## Visualization Guidelines

### Scatter Plot Best Practices
1. **Log scales** for market cap, TVL, volume, holder count
2. **Color coding** by token category (consistent across all charts)
3. **Size encoding** for third dimension (e.g., holder count as bubble size)
4. **Trend lines** with R² for correlation strength
5. **Quadrant labels** for actionable insights
6. **Interactive tooltips** with token details
7. **Filter controls** for category, time range

### Recommended Chart Library Features (Recharts)
- `ScatterChart` with `ZAxis` for bubble size
- `ReferenceLine` for quadrant divisions
- Custom tooltips with `TokenCard` preview
- Animated transitions between filtered states

### Color Palette (from existing theme)
```typescript
const CATEGORY_COLORS = {
  'metadao': '#10b981',      // Green
  'metadao-ico': '#059669',  // Darker green
  'futarchy-dao': '#3b82f6', // Blue
  'vc-backed': '#f59e0b',    // Amber
  'community': '#8b5cf6',    // Purple
};
```

---

## Data Refresh Strategy

| Data Type | Refresh Interval | Cache Duration |
|-----------|------------------|----------------|
| Prices | 1 minute | 30 seconds |
| Market data | 5 minutes | 2 minutes |
| Holder data | 1 hour | 30 minutes |
| Distribution metrics | 1 hour | 30 minutes |
| TVL | 15 minutes | 10 minutes |
| Fees/Revenue | 1 hour | 30 minutes |
| Community/Developer | 24 hours | 12 hours |

---

## Notes

### TokenTerminal API
The task mentioned TokenTerminal but no client exists in the codebase. TokenTerminal requires paid API access and provides:
- Protocol revenue metrics
- P/E and P/S ratios
- Active user counts
- Fee breakdowns

If TokenTerminal access is obtained, additional scatter plots become available:
- P/E Ratio vs Gini Coefficient
- Daily Active Users vs Holder Count
- Protocol Revenue vs Nakamoto Coefficient

### Codex vs CoinGecko Holder Data
Codex provides on-chain holder data for Solana tokens, which is more accurate than CoinGecko's estimates. Always prefer Codex for holder metrics.

### Missing Data Handling
Many protocols may not have:
- TVL (if not DeFi)
- Revenue/fees (if no protocol fees)
- Developer data (if closed source)

Scatter plots should handle missing data gracefully with:
- Distinct "no data" markers
- Filtering to show only tokens with complete data
- Clear labeling when data is unavailable
