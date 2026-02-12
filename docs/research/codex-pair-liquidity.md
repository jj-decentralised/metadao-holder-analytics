# Codex.io DEX Pair and Liquidity Data Research

## Overview

This document summarizes research on Codex.io's GraphQL API capabilities for Solana DEX pair and liquidity data, conducted for the MetaDAO Holder Analytics project.

**API Endpoint:** `https://graph.codex.io/graphql`
**Solana Network ID:** `1399811149`
**Documentation:** [docs.codex.io](https://docs.codex.io)
**Explorer:** [explorer.codex.io](https://explorer.codex.io)

## Authentication

- All queries require a valid API key passed in the `Authorization` header
- Free tier available with rate limits
- Enterprise plans available for higher volume
- Short-lived API tokens supported for browser-based applications

## 1. Pair/Pool Queries

### Get All Trading Pairs for a Token

**Query:** `listPairsWithMetadataForToken`

Retrieves all trading pairs where a specific token is involved.

```graphql path=null start=null
query ListPairs($tokenAddress: String!, $networkId: Int!) {
  listPairsWithMetadataForToken(
    tokenAddress: $tokenAddress
    networkId: $networkId
    limit: 20
  ) {
    pairs {
      address
      exchangeHash      # DEX identifier (Raydium, Orca, etc.)
      fee               # Pool fee percentage
      token0            # First token address
      token1            # Second token address
      pooled {
        token0          # Amount of token0 pooled
        token1          # Amount of token1 pooled
      }
      price             # Current price
      priceChange24     # 24h price change
      volume24          # 24h volume in USD
      liquidity         # Current liquidity in USD
    }
  }
}
```

**Supported DEXs on Solana:**
- Raydium (AMM & CLMM)
- Orca (Whirlpools)
- Jupiter (Aggregator routes)
- Meteora
- Phoenix
- Lifinity
- OpenBook

### Filter Pairs by Criteria

**Query:** `filterPairs`

Filter and discover trading pairs across the network.

```graphql path=null start=null
query FilterPairs {
  filterPairs(
    filters: { network: 1399811149 }
    limit: 10
  ) {
    count
    results {
      pair {
        address
        exchangeHash
        token0
        token1
      }
      liquidity
      volume24
      txnCount24
      buyCount24
      sellCount24
      priceChange24
    }
  }
}
```

**Available Filters:**
- `network` - Network ID (int, not array)
- `exchangeHash` - Filter by specific DEX
- `liquidity` - Min/max liquidity thresholds
- `volume24` - 24h volume thresholds
- `createdAt` - Pair creation timestamp

### Pair Creation Timestamps

Pair creation dates are available via:
- `filterTokens` → `createdAt` field
- `getLatestPairs` for newest pairs
- `filterPairs` with `createdAt` filter

## 2. Liquidity Data

### Detailed Pair Statistics

**Query:** `getDetailedPairStats`

Returns comprehensive bucketed stats for a token within a pair.

```graphql path=null start=null
query GetDetailedPairStats($pairAddress: String!, $networkId: Int!) {
  getDetailedPairStats(
    pairAddress: $pairAddress
    networkId: $networkId
    tokenOfInterest: token0  # enum: token0 | token1
    statsType: FILTERED      # FILTERED excludes MEV
  ) {
    stats_day1 {
      statsUsd {
        close { currentValue previousValue }
        high { currentValue previousValue }
        low { currentValue previousValue }
        volume { currentValue previousValue change }
        liquidity { currentValue previousValue change }
      }
      transactions {
        buys
        sells
        total
      }
      uniqueWallets {
        buyers
        sellers
        total
      }
    }
    stats_week1 { ... }
    stats_month1 { ... }
    statsNonCurrency {
      holders
    }
  }
}
```

**Time Windows Available:**
- `stats_day1` - 24 hours
- `stats_week1` - 7 days
- `stats_month1` - 30 days

### TVL Per Pair Over Time

Historical liquidity data is available through:
- `getDetailedPairStats` for current snapshots
- `getBars` for historical OHLCV with liquidity

**Limitations:**
- No dedicated historical TVL endpoint
- Must aggregate from OHLCV bars or detailed stats
- Real-time TVL via WebSocket: `onPairMetadataUpdated`

### LP Count

**Not directly available.** The API provides:
- Total `holders` count for tokens
- `uniqueWallets` (buyers/sellers) in detailed stats
- No specific LP provider count

**Workaround:** Use `holders` query on LP token address if applicable.

### Price Impact Estimates

**Not available as a dedicated endpoint.** Price impact can be estimated by:
- Using `pooled` amounts from pair metadata
- Calculating based on liquidity depth
- No built-in slippage or price impact calculator

## 3. Event/Transaction Data

### Recent Swaps/Trades

**Query:** `getTokenEvents`

```graphql path=null start=null
query GetTokenEvents {
  getTokenEvents(
    query: {
      address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
      networkId: 1399811149
    }
    limit: 100
  ) {
    cursor
    items {
      eventType
      timestamp
      maker           # Wallet address
      transactionHash
      baseTokenPrice
      data {
        ... on SwapEventData {
          amount0
          amount1
          priceUsd
          priceUsdTotal
          type         # buy | sell
        }
      }
    }
  }
}
```

**Important Notes:**
- Returns events for the **top pair** by default
- Use `listPairsWithMetadataForToken` to find other pairs
- Maximum 200 events per request (use cursor pagination)

### Trade Size Distribution

**Available via `getTokenEvents`:**
- Each swap includes `priceUsdTotal` (trade size in USD)
- `type` field indicates buy vs sell
- Aggregate client-side to analyze distribution

**Example Analysis:**
- Small retail: trades < $100
- Medium: $100-$10,000
- Large/Whale: > $10,000

### Buy vs Sell Pressure

**Available in `getDetailedPairStats`:**

```graphql path=null start=null
stats_day1 {
  transactions {
    buys      # Number of buy transactions
    sells     # Number of sell transactions
    total
  }
  uniqueWallets {
    buyers    # Unique buyer wallets
    sellers   # Unique seller wallets
  }
}
```

**Also available:**
- `buyVolume24` / `sellVolume24` in `filterTokens`
- `buyCount24` / `sellCount24` in `filterPairs`

## 4. Token Discovery

### Search/Filter for New Solana Tokens

**Query:** `filterTokens`

```graphql path=null start=null
query FilterNewTokens {
  filterTokens(
    filters: {
      network: 1399811149
      createdAt: { gt: 1707523200 }  # Unix timestamp
      volume24: { gt: 1000 }
      liquidity: { gt: 10000 }
    }
    rankings: { attribute: createdAt, direction: DESC }
    limit: 25
  ) {
    count
    results {
      createdAt
      volume24
      liquidity
      holders
      token {
        address
        name
        symbol
        createdAt
        creatorAddress
        createTransactionHash
      }
    }
  }
}
```

### Find Tokens by Creation Date

Filter options:
- `createdAt: { gt: timestamp }` - Created after
- `createdAt: { lt: timestamp }` - Created before
- `createdAt: { gte: timestamp, lte: timestamp }` - Date range

### Filter by Volume Thresholds

**Available Filter Fields:**
- `volume24` - 24h total volume
- `buyVolume24` - 24h buy volume
- `sellVolume24` - 24h sell volume
- `txnCount24` - Transaction count
- `liquidity` - Current liquidity
- `marketCap` - Market capitalization
- `circulatingMarketCap` - With circulating supply
- `holders` - Holder count
- `trendingScore24` - Trending score

**Ranking Attributes:**
- `trendingScore24` (recommended for discovery)
- `volume24`
- `liquidity`
- `marketCap`
- `createdAt`
- `holders`

### Latest Pairs (New Pools)

**Query:** `getLatestPairs`

```graphql path=null start=null
query GetLatestPairs {
  getLatestPairs(
    limit: 20
    networkFilter: [1399811149]
  ) {
    cursor
    items {
      address
      exchangeHash
      networkId
      token0 {
        address
        name
        symbol
      }
      token1 {
        address
        name
        symbol
      }
      liquidity
      initialPriceUsd
    }
  }
}
```

## 5. OHLCV Data

**Query:** `getBars`

```graphql path=null start=null
query GetBars {
  getBars(
    symbol: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:1399811149"
    from: 1704067200       # Unix timestamp
    to: 1707000000
    resolution: "1D"       # 1, 5, 15, 30, 60, 240, 1D, 1W
    currencyCode: "USD"
    quoteToken: token0
  ) {
    t          # Timestamp array
    o          # Open prices
    h          # High prices
    l          # Low prices
    c          # Close prices
    v          # Volume
    liquidity  # Liquidity per bar
    buyers
    sellers
    transactions
    buyVolume
    sellVolume
  }
}
```

**Resolutions:** `1, 5, 15, 30, 60, 240, 1D, 1W`

## 6. Holder Data

**Query:** `holders`

```graphql path=null start=null
query GetHolders($input: HoldersInput!) {
  holders(input: $input) {
    count
    items {
      address
      balance
    }
  }
}

# Variables
{
  "input": {
    "tokenId": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:1399811149",
    "limit": 100
  }
}
```

**Note:** `tokenId` format is `ADDRESS:NETWORK_ID`

## 7. WebSocket Subscriptions

Real-time updates available via GraphQL subscriptions:

- `onPricesUpdated` - Price updates (max 25 tokens)
- `onBarsUpdated` - OHLCV bar updates
- `onPairMetadataUpdated` - Pair stats updates (enterprise)
- `onHoldersUpdated` - Holder updates (enterprise)

## Summary: Capability Matrix

| Feature | Available | Query | Notes |
|---------|-----------|-------|-------|
| Trading pairs per token | ✅ | `listPairsWithMetadataForToken` | All DEXs tracked |
| DEX identification | ✅ | `exchangeHash` field | Raydium, Orca, Jupiter, etc. |
| Liquidity per pair | ✅ | `liquidity` field | Real-time USD value |
| Pair creation timestamps | ✅ | `createdAt` field | Available in multiple queries |
| TVL over time | ⚠️ | `getBars` | Via OHLCV bars, not dedicated |
| LP count | ❌ | - | Not available |
| Price impact estimates | ❌ | - | Must calculate from pooled amounts |
| Recent swaps/trades | ✅ | `getTokenEvents` | Full transaction data |
| Trade size distribution | ⚠️ | `getTokenEvents` | Aggregate client-side |
| Buy/sell pressure | ✅ | `getDetailedPairStats` | Buys/sells counts + volume |
| New token search | ✅ | `filterTokens` | By creation date, volume, etc. |
| Volume thresholds | ✅ | `filterTokens` | Multiple volume filters |
| Token discovery | ✅ | `getLatestPairs` | Newly created pairs |

## Recommendations for Implementation

### High Priority Endpoints

1. **`filterTokens`** - Token discovery with volume/liquidity filters
2. **`listPairsWithMetadataForToken`** - DEX pairs for tracked tokens
3. **`getDetailedPairStats`** - Buy/sell pressure analysis
4. **`getTokenEvents`** - Trade flow analysis

### Rate Limiting

Current implementation uses conservative limits (30 requests/sec with 0.5s delay). Codex recommends:
- Free tier: ~100 requests/min
- Growth plans: Higher limits
- Use batching where possible

### Sample Integration

See `/scripts/test-codex-api-final.ts` for working query examples.

## Test Scripts

The following test scripts were created during this research:

- `scripts/test-codex-api.ts` - Initial exploration
- `scripts/test-codex-api-v2.ts` - Refined queries
- `scripts/test-codex-api-v3.ts` - Further refinements
- `scripts/test-codex-api-final.ts` - Final documented queries
- `scripts/codex-api-results.json` - Test results output

## References

- [Codex API Documentation](https://docs.codex.io)
- [Codex GraphQL Explorer](https://explorer.codex.io)
- [filterTokens Reference](https://docs.codex.io/api-reference/queries/filtertokens)
- [getDetailedPairStats Reference](https://docs.codex.io/reference/getdetailedpairstats)
- [Codex FAQ](https://docs.codex.io/extra/faq)

---

*Research conducted: February 2026*
*Last updated: February 2026*
