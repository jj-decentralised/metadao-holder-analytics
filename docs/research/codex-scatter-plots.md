# Codex.io API Research: Data Points for Scatter Plots & Cross-Token Analysis

This document catalogs all available data points from the Codex GraphQL API and maps them to potential scatter plots and correlation analyses for comparing MetaDAO futarchy tokens vs VC-backed and community tokens.

## Executive Summary

The Codex.io GraphQL API provides comprehensive DeFi data across multiple dimensions:
- **Token-level metrics**: holder counts, supply, liquidity, volume, price, age, creator info
- **Holder-level data**: balances, percentages, wallet age, first/last activity
- **Pair/Pool statistics**: volume, buys/sells, unique traders, liquidity, fees
- **Wallet analytics**: PnL, win rates, swap counts, trading patterns (Growth plan required)
- **Time-series data**: OHLCV bars at multiple resolutions, sparklines
- **Advanced filtering**: ranking by trending score, filtering by metrics, MEV filtering

---

## 1. Token-Level Data Points

### Core Token Info (via `token`, `filterTokens`, `getTokensBatch`)

| Field | Type | Description | Scatter Plot Ideas |
|-------|------|-------------|-------------------|
| `holderCount` | Integer | Total unique holders | **Holder Count vs Gini**: Does more holders = more equal distribution? |
| `totalSupply` | String | Total token supply | Supply vs Market Cap |
| `circulatingMarketCap` | String | Market cap based on circulating supply | **Market Cap vs Holder Count**: Size vs decentralization |
| `liquidity` | String | Total USD liquidity across pools | **Liquidity vs Holder Concentration**: More liquidity = less whale dominance? |
| `volume24` | String | 24h trading volume | **Volume vs Holder Turnover**: High volume = changing hands? |
| `buyVolume24` | String | 24h buy volume in USD | **Buy/Sell Ratio vs Price Change**: Pressure correlation |
| `sellVolume24` | String | 24h sell volume in USD | Sell pressure analysis |
| `priceUsd` | Float | Current price | **Price vs Top 10 Holders %**: Whale correlation |
| `createdAt` | Timestamp | Token creation date | **Age vs Nakamoto Coefficient**: Older = more decentralized? |
| `creatorAddress` | String | Token creator wallet | Creator holding analysis |
| `txnCount24` | Integer | 24h transaction count | **Transaction Count vs Holder Growth** |
| `walletAgeAvg` | Float | Average wallet age of holders (seconds) | **Avg Wallet Age vs Gini**: Diamond hands = equality? |
| `walletAgeStd` | Float | Std deviation of wallet ages | Holder maturity distribution |
| `trendingScore24` | Float | Trending score (for rankings) | Trending vs fundamentals |

### Token Filters Available (for discovery/comparison)

```graphql
filters: {
  network: [Int]              # Filter by blockchain
  buyVolume24: {gte, lte}     # Buy volume range
  sellVolume24: {gte, lte}    # Sell volume range  
  holders: {gte, lte}         # Holder count range
  liquidity: {gte, lte}       # Liquidity range
  createdAt: {gte, lte}       # Creation time range
  volume24: {gte, lte}        # Total volume range
  priceUsd: {gte, lte}        # Price range
  circulatingMarketCap: {gte, lte}  # Market cap range
}
```

### Bundlers/Snipers/Insiders Data (New - since Nov 2025)

| Field | Description | Scatter Plot Ideas |
|-------|-------------|-------------------|
| `sniperCount` | Wallets that bought within 4 seconds of first swap | **Sniper % vs Long-term Gini**: Early bots vs distribution |
| `bundlerCount` | Coordinated buying (4+ buys same block) | **Bundler Activity vs Holder Retention** |
| `insiderCount` | Wallets funded by creator or receiving direct transfers | **Insider % vs 30-day Price Performance** |
| `devHeldPercentage` | % held by developer/creator | **Dev Allocation vs Community Growth** |
| `sniperHeldPercentage` | % currently held by snipers | Sniper retention analysis |
| `bundlerHeldPercentage` | % held by bundlers | Coordinated holding patterns |
| `insiderHeldPercentage` | % held by insiders | **Insider Holdings vs Gini Coefficient** |

**Key Insight for MetaDAO**: Compare insider/sniper activity between fair-launch futarchy tokens vs VC tokens with scheduled unlocks.

---

## 2. Holder-Level Data Points

### Holders Query (`holders`)

| Field | Type | Description | Scatter Plot Ideas |
|-------|------|-------------|-------------------|
| `balance` | String | Raw token balance | Distribution analysis |
| `balanceV2` | String | Decimal-adjusted balance | Holder size categories |
| `balanceUsd` | String | Balance in USD | **Balance Distribution vs Token Category** |
| `percentOwned` | Float | Percentage of supply owned | Build Gini coefficient directly! |
| `firstHeldAt` | Timestamp | When wallet first acquired | **Holder Tenure vs Balance**: Early = large? |
| `walletAddress` | String | Holder's wallet address | Cross-token holder analysis |
| `count` | Integer | Total unique holders | Confirmation of holder count |

### Holder Sorting Options
- `BALANCE` (default) - Largest holders first
- `DATE` - When wallets first acquired the token

### Key Metric: `top10HoldersPercent`
Returns percentage of total supply held by top 10 wallets - direct measure of concentration!

**Scatter Plot**: **Top 10 Holders % vs Token Category** (MetaDAO vs VC vs Community)

---

## 3. Pair/Pool Data Points

### Detailed Pair Stats (`getDetailedPairStats`)

Returns bucketed time-series data with metrics across multiple timeframes: 5min, 15min, 1h, 4h, 12h, 1d, 7d, 30d

#### USD Metrics (statsUsd)
| Field | Description | Scatter Plot Ideas |
|-------|-------------|-------------------|
| `volume` | Total volume in USD | **Volume/Liquidity Ratio vs Holder Turnover** |
| `buyVolume` | Buy-side volume | **Buy Pressure vs Next-Period Price Change** |
| `sellVolume` | Sell-side volume | Sell pressure correlation |
| `open` | Opening price | Price action analysis |
| `highest` | Period high | Volatility measurement |
| `lowest` | Period low | **Volatility vs Holder Concentration** |
| `close` | Closing price | Returns calculation |
| `liquidity` | Pool liquidity over time | **Liquidity Changes vs Holder Changes** |

#### Non-Currency Metrics (statsNonCurrency)
| Field | Description | Scatter Plot Ideas |
|-------|-------------|-------------------|
| `transactions` | Total transaction count | Activity measurement |
| `buys` | Number of buy transactions | **Buys vs Sells Ratio vs Price Trend** |
| `sells` | Number of sell transactions | Selling pressure |
| `traders` | Unique trading wallets | **Unique Traders vs Holder Count Growth** |
| `buyers` | Unique buying wallets | **New Buyers vs Price Appreciation** |
| `sellers` | Unique selling wallets | Holder exit analysis |

#### Stats Types
- `FILTERED`: Removes MEV events - shows "organic" volume (recommended for analysis)
- `UNFILTERED`: Includes all activity including MEV

### Pair Metadata (`listPairsWithMetadataForToken`)

| Field | Description | Use Case |
|-------|-------------|----------|
| `pairAddress` | Pool contract address | Identify main trading pool |
| `exchange` | DEX name (Raydium, Orca, etc.) | DEX distribution analysis |
| `liquidity` | Current liquidity | Multi-pool liquidity aggregation |
| `volume24` | 24h volume for this pair | Volume distribution |
| `fee` | Pool fee tier | Fee tier analysis |
| `token0`, `token1` | Pair tokens | Quote token analysis |

### Liquidity Locks (`liquidityLocks`, `liquidityMetadata`)

| Field | Description | Scatter Plot Ideas |
|-------|-------------|-------------------|
| `lockedLiquidity` | Amount locked | **Locked Liquidity % vs Holder Confidence** |
| `lockPlatform` | Where locked (Team.Finance, etc.) | Lock platform preferences |
| `unlockDate` | When unlocked | Unlock schedule vs price |

---

## 4. Wallet Analytics (Growth Plan Required)

### Filter Wallets (`filterWallets`)

Discover wallets based on trading performance across timeframes: 1d, 1w, 30d, 1y

| Field | Description | Scatter Plot Ideas |
|-------|-------------|-------------------|
| `volumeUsd{1d,1w,30d,1y}` | Trading volume | Volume by wallet tier |
| `realizedProfitUsd{...}` | Realized PnL | **Whale PnL vs Token Performance** |
| `averageProfitUsdPerTrade{...}` | Avg profit per trade | Trading efficiency |
| `averageSwapAmountUsd{...}` | Avg trade size | Whale vs retail analysis |
| `realizedProfitPercentage{...}` | ROI percentage | **Top Holder ROI vs Token Category** |
| `swaps{...}` | Number of swaps | Activity levels |
| `uniqueTokens{...}` | Tokens traded | Diversification |
| `winRate{...}` | Win rate percentage | **Win Rate vs Position Size** |
| `firstTransactionAt` | First activity | Wallet age |
| `lastTransactionAt` | Last activity | Recency |
| `labels` | Wallet labels | Sniper/Bot identification |
| `scammerScore` | Scam likelihood | Filter bad actors |
| `botScore` | Bot likelihood | Separate bots from humans |

### Detailed Wallet Stats (`detailedWalletStats`)

Per-wallet breakdown with windowed stats:
- `statsDay1`, `statsWeek1`, `statsDay30`, `statsYear1`
- Each window includes: volume, PnL, wins, losses, unique tokens

### Wallet Labels Available
- **Wealthy (low/medium/high)**: $1M+ / $5M+ / $10M+ holdings
- **Sniper**: Profits $3k+ from tokens bought within 1 hour of launch
- **Early Bird**: Profits $5k+ from tokens 1 hour to 2 days old
- **Second Wave**: Profits $7.5k+ from established tokens (2+ days)
- **Scammer or Bot**: Suspicious trading behavior

### Filter Token Wallets (`filterTokenWallets`)

Get wallets holding a specific token with filters:

| Filter | Description | Use Case |
|--------|-------------|----------|
| `balance: {gte, lte}` | Token balance range | Find whales/retail |
| `percentOwned: {gte, lte}` | % ownership range | Concentration tiers |

---

## 5. Time-Series Data

### OHLCV Bars (`getBars`, `getTokenBars`)

| Resolution | Period | Use Case |
|------------|--------|----------|
| `1` | 1 minute | High-frequency analysis |
| `5` | 5 minutes | Short-term patterns |
| `15` | 15 minutes | Intraday |
| `30` | 30 minutes | Session analysis |
| `60` | 1 hour | Hourly trends |
| `240` | 4 hours | Medium-term |
| `720` | 12 hours | Half-day |
| `1D` | 1 day | Daily analysis |
| `7D` | 1 week | Weekly trends |

**Fields per bar**:
- `o[]` - Open prices
- `h[]` - High prices
- `l[]` - Low prices
- `c[]` - Close prices
- `t[]` - Timestamps
- `volume[]` - Volume

**Scatter Plot**: **30-day Volatility vs Gini Change** - Does volatility redistribute ownership?

### Sparklines (`tokenSparklines`)
24-hour price sparkline array for quick visualization.

---

## 6. Token Events (`getTokenEvents`, `getTokenEventsForMaker`)

| Field | Description | Scatter Plot Ideas |
|-------|-------------|-------------------|
| `timestamp` | Event time | Time-based analysis |
| `blockNumber` | Block number | Block-level patterns |
| `transactionHash` | Transaction ID | Trace specific trades |
| `maker` | Wallet that initiated | Identify repeat traders |
| `priceUsd` | Execution price | Slippage analysis |
| `labels` | Event labels | Filter by type |

**Use Case**: Track specific wallet behavior over time, calculate holder-specific PnL.

---

## 7. Scatter Plot & Correlation Ideas

### Primary Decentralization Metrics

#### 1. Holder Count vs Gini Coefficient
- **X-Axis**: `holderCount` (from `filterTokens`)
- **Y-Axis**: Calculated Gini from holder distribution
- **Question**: Does more holders = more equal distribution?
- **Hypothesis**: MetaDAO tokens with fair launches should show better Gini for similar holder counts

#### 2. Liquidity vs Holder Concentration  
- **X-Axis**: `liquidity` (USD)
- **Y-Axis**: `top10HoldersPercent`
- **Question**: Does higher liquidity correlate with less whale dominance?
- **Category coloring**: MetaDAO vs VC vs Community

#### 3. Token Age vs Nakamoto Coefficient
- **X-Axis**: Days since `createdAt`
- **Y-Axis**: Nakamoto coefficient (min holders for 51%)
- **Question**: Do tokens decentralize over time?
- **Compare**: Rate of decentralization by category

#### 4. Buy Pressure vs Price Change
- **X-Axis**: `buyVolume24` / `sellVolume24` ratio
- **Y-Axis**: 24h price change from `getDetailedPairStats`
- **Question**: How efficiently does buy pressure translate to price?

#### 5. Whale % vs Retail Holder Growth
- **X-Axis**: Top 10 holders percentage
- **Y-Axis**: New holder count (change over 7d)
- **Question**: Do whales scare away retail?

#### 6. Volume/Liquidity Ratio vs Holder Turnover
- **X-Axis**: `volume24` / `liquidity`
- **Y-Axis**: Change in holder addresses (churn)
- **Question**: High turnover = changing hands rapidly?

#### 7. Creator/Dev Allocation vs Long-term Gini Trend
- **X-Axis**: `devHeldPercentage` or from tokenomics data
- **Y-Axis**: Change in Gini over 30 days
- **Question**: Do high dev allocations predict centralization?

#### 8. Sniper Activity vs Distribution Quality
- **X-Axis**: `sniperHeldPercentage`
- **Y-Axis**: Gini coefficient
- **Question**: Do sniper-heavy launches stay centralized?

#### 9. Unique Traders vs Holder Count
- **X-Axis**: `traders` (unique wallets) from pair stats
- **Y-Axis**: `holderCount`
- **Question**: Trading activity vs holding behavior

#### 10. Average Wallet Age vs Token Stability
- **X-Axis**: `walletAgeAvg`
- **Y-Axis**: 30-day price volatility
- **Question**: Diamond hands = stability?

### Cross-Token Category Comparisons

#### MetaDAO Futarchy Tokens vs Others
| Metric to Compare | Expected MetaDAO Advantage | API Source |
|-------------------|---------------------------|------------|
| Gini Coefficient | Lower (more equal) | Calculate from `holders` |
| `top10HoldersPercent` | Lower | `holders` response |
| `devHeldPercentage` | Lower (0% for META) | `filterTokens` |
| `insiderHeldPercentage` | Lower | `filterTokens` |
| Holder Growth Rate | Competitive | Time-series `holderCount` |
| `walletAgeAvg` | Higher (committed holders) | `filterTokens` |

---

## 8. Implementation Recommendations

### Data Collection Strategy

1. **Daily Snapshot Job**
   - Call `filterTokens` for all 88 tokens with full field set
   - Store: holderCount, liquidity, volume24, priceUsd, top metrics
   
2. **Holder Distribution Analysis** (Rate-limited)
   - Call `holders` with pagination for each token
   - Calculate Gini coefficient and Nakamoto coefficient locally
   - Store distribution curves
   
3. **Trading Activity**
   - Use `getDetailedPairStats` with `duration: day1` for activity metrics
   - Track buyers, sellers, traders counts
   
4. **Time-Series for Trends**
   - Use `getBars` with `1D` resolution for 90-day history
   - Calculate volatility metrics

### API Tier Requirements

| Feature | Free Tier | Growth Tier |
|---------|-----------|-------------|
| `filterTokens` | ✅ | ✅ |
| `holders` | ❌ | ✅ Required |
| `filterWallets` | ❌ | ✅ Required |
| `detailedWalletStats` | ❌ | ✅ Required |
| `getDetailedPairStats` | ✅ | ✅ |
| `getBars` | ✅ | ✅ |

**Recommendation**: Growth tier needed for full holder analysis. Minimum for scatter plots: Growth tier.

### Rate Limiting Strategy

Existing client uses: `RateLimiter(30, 0.5)` - 30 requests per 0.5 second
- Codex typical response: 60-150ms
- Use batch endpoints where available (`getTokensBatch`, `getTokenPricesBatch`)
- Implement cursor-based pagination for holders

---

## 9. Example Queries for Key Data Points

### Get Token with Full Metrics
```graphql
query {
  filterTokens(
    filters: {
      network: 1399811149  # Solana
    }
    rankings: {attribute: trendingScore24, direction: DESC}
    limit: 100
  ) {
    results {
      token {
        info { address name symbol }
        createdAt
        creatorAddress
      }
      holders
      liquidity
      volume24
      buyVolume24
      sellVolume24
      circulatingMarketCap
      txnCount24
      walletAgeAvg
      walletAgeStd
      sniperCount
      bundlerCount
      insiderCount
      devHeldPercentage
      sniperHeldPercentage
      bundlerHeldPercentage
      insiderHeldPercentage
    }
  }
}
```

### Get Holder Distribution
```graphql
query {
  holders(input: {
    tokenId: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m:1399811149"
    limit: 200
  }) {
    count
    top10HoldersPercent
    items {
      address
      balance
      percentOwned
      firstHeldAt
    }
    cursor
  }
}
```

### Get Pair Activity Metrics
```graphql
query {
  getDetailedPairStats(
    pairAddress: "PAIR_ADDRESS"
    networkId: 1399811149
    duration: day1
    statsType: FILTERED
  ) {
    statsNonCurrency {
      buys { currentValue previousValue change }
      sells { currentValue previousValue change }
      buyers { currentValue previousValue change }
      sellers { currentValue previousValue change }
      traders { currentValue }
    }
    statsUsd {
      volume { currentValue }
      buyVolume { currentValue }
      sellVolume { currentValue }
      liquidity { currentValue }
    }
  }
}
```

---

## 10. Gaps & Future Considerations

### Data Not Available from Codex
- **On-chain governance votes**: Need separate indexer
- **Token unlock schedules**: Need to fetch from tokenomics sources
- **Team wallet identification**: Manual mapping required
- **Cross-chain holder overlap**: Requires multi-chain queries

### Recommended Additional Data Sources
- **DeFiLlama**: TVL data, protocol revenue
- **Token Terminal**: Revenue metrics, P/E ratios
- **Manual tokenomics**: Team/VC allocations from docs

### Future Codex Features to Watch
- Enhanced insider detection
- Cross-chain wallet linking
- Historical holder snapshots
- Governance integration

---

## Conclusion

The Codex.io API provides excellent coverage for building comprehensive scatter plot analyses comparing token categories. Key advantages:

1. **Complete holder data** with `top10HoldersPercent` built-in
2. **Rich trading metrics** separating buyers/sellers/traders
3. **Sniper/bundler/insider detection** for launch quality analysis
4. **Time-series support** at multiple resolutions
5. **MEV filtering** for clean organic activity data

For the MetaDAO analytics project, the combination of `filterTokens` (for token-level metrics) + `holders` (for distribution analysis) + `getDetailedPairStats` (for trading activity) provides all necessary data for the proposed scatter plots comparing futarchy token distribution vs VC and community tokens.

**Next Steps**:
1. Upgrade to Codex Growth tier for holder access
2. Implement daily data collection jobs
3. Build Gini/Nakamoto calculation utilities
4. Create visualization components for each scatter plot
