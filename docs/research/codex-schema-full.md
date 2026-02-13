# Codex.io GraphQL Schema Documentation for Solana Tokens

This document provides comprehensive documentation of all available Codex.io GraphQL API queries relevant to Solana token analysis.

**API Endpoint:** `https://graph.codex.io/graphql`  
**WebSocket Endpoint:** `wss://graph.codex.io/graphql`  
**Schema URL:** `https://graph.codex.io/schema/latest.graphql`  
**Solana Network ID:** `1399811149`

> **Note:** Codex does not support introspection queries directly against the API. Schema information is obtained from official documentation and the published schema file.

---

## Table of Contents

1. [Token Queries](#token-queries)
2. [Holder & Wallet Queries](#holder--wallet-queries)
3. [Chart & Bar Data Queries](#chart--bar-data-queries)
4. [Pair & Pool Queries](#pair--pool-queries)
5. [Token Events Queries](#token-events-queries)
6. [Network Queries](#network-queries)
7. [Launchpad Queries](#launchpad-queries)
8. [NFT Queries](#nft-queries)
9. [Webhook & Subscription Queries](#webhook--subscription-queries)
10. [Example Queries for Solana](#example-queries-for-solana)

---

## Token Queries

### `token`
Returns detailed information about a single token.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | TokenInput! | Yes | Contains address and networkId |

**TokenInput Fields:**
- `address` (String!) - Token contract address
- `networkId` (Int!) - Network ID (1399811149 for Solana)

**Returns:** `EnhancedToken!`

**Key Return Fields:**
- `address` - Token contract address
- `name` - Token name
- `symbol` - Token symbol
- `totalSupply` - Total supply
- `holderCount` - Number of unique holders
- `decimals` - Token decimals
- `info` - Token metadata (logo, description, etc.)
- `createdAt` - Creation timestamp
- `creatorAddress` - Creator wallet address
- `createTransactionHash` - Creation transaction hash

**Solana Support:** ✅ Yes (networkId: 1399811149)

---

### `tokens`
Returns information about multiple tokens at once.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | TokensInput! | Yes | Contains array of token identifiers |

**Returns:** `[EnhancedToken]!`

**Limits:** Up to 100 tokens per request

**Solana Support:** ✅ Yes

---

### `filterTokens`
Returns a list of tokens based on various filter criteria. This is the most powerful token discovery endpoint.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| filters | TokenFilters | No | Filter conditions |
| rankings | TokenRankings | No | Sort order |
| limit | Int | No | Max results (default: 50, max: 200) |
| cursor | String | No | Pagination cursor |

**TokenFilters Fields:**
- `network` (Int) - Network ID to filter by
- `buyVolume24` (NumberFilter) - 24h buy volume filter
- `sellVolume24` (NumberFilter) - 24h sell volume filter
- `circulatingMarketCap` (NumberFilter) - Market cap filter
- `liquidity` (NumberFilter) - Liquidity filter
- `holders` (NumberFilter) - Holder count filter
- `txnCount24` (NumberFilter) - Transaction count filter
- `createdAt` (NumberFilter) - Creation time filter
- `potentialScam` (Boolean) - Include/exclude scam tokens
- `includeScams` (Boolean) - Include flagged scam tokens
- `phrase` (String) - Search by name/symbol (use $ prefix for exact match)
- `launchpad` (LaunchpadFilter) - Filter by launchpad

**TokenRankings:**
- `attribute` - Field to sort by (trendingScore24, volume24, liquidity, holders, etc.)
- `direction` - ASC or DESC

**Returns:** `TokenFilterConnection`

**Solana Support:** ✅ Yes

---

### `searchTokens`
Returns a list of tokens matching a query string.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | String! | Yes | Search query |
| networks | [Int!] | No | Filter by networks |

**Returns:** List of matching tokens

**Note:** For more powerful searches, use `filterTokens` instead.

**Solana Support:** ✅ Yes

---

### `tokenSparklines`
Returns sparkline price data for tokens.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | TokenSparklineInput! | Yes | Token identifiers |

**Returns:** `[TokenSparkline!]!`

**Note:** Only returns recent data. For historical sparklines, use `getBars` and extract close values.

**Solana Support:** ✅ Yes

---

## Holder & Wallet Queries

### `holders`
Returns list of wallets that hold a given token, ordered by holdings descending.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | HoldersInput! | Yes | Token and pagination info |

**HoldersInput Fields:**
- `tokenAddress` (String!) - Token contract address
- `networkId` (Int!) - Network ID
- `limit` (Int) - Max results to return
- `cursor` (String) - Pagination cursor

**Returns:** `HoldersResponse!`

**HoldersResponse Fields:**
- `count` - Total unique holder count
- `items` - Array of holder data
  - `address` - Wallet address
  - `balance` - Token balance (raw)
  - `percentOwned` - Percentage of supply owned

**Solana Support:** ✅ Yes

---

### `balances`
Returns list of token balances for a wallet.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | BalancesInput! | Yes | Wallet address and filters |

**BalancesInput Fields:**
- `walletAddress` (String!) - Wallet to query
- `networkIds` ([Int!]) - Filter by networks
- `cursor` (String) - Pagination cursor

**Returns:** `BalancesResponse!`

**Note:** 
- Requires Growth or Enterprise plan
- Balances are only indexed/updated after a swap is made
- Native token balances only available on networks with traces enabled

**Solana Support:** ✅ Yes (limited - indexed on swap activity)

---

### `filterWallets`
Filter and discover wallets based on various criteria.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| filters | WalletFilters | No | Filter conditions |
| rankings | WalletRankings | No | Sort order |
| limit | Int | No | Max results |
| cursor | String | No | Pagination cursor |

**Returns:** `WalletFilterConnection!`

**Solana Support:** ✅ Yes

---

### `filterTokenWallets`
Filter wallets holding a specific token.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| filters | TokenWalletFilters | No | Filter conditions |
| rankings | TokenWalletRankings | No | Sort order |

**Returns:** `TokenWalletFilterConnection!`

**Solana Support:** ✅ Yes

---

### `detailedWalletStats`
Returns detailed statistics for a specific wallet.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | DetailedWalletStatsInput! | Yes | Wallet address and options |

**Returns:** `DetailedWalletStats`

**Key Fields:**
- Network breakdown of activity
- Trading statistics
- Token holdings summary

**Solana Support:** ✅ Yes

---

### `primeHolders`
Returns premium holder data for a token.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | PrimeHoldersInput! | Yes | Token identifier |

**Returns:** `PrimeHolders!`

**Note:** May require higher tier plan.

**Solana Support:** ✅ Yes

---

## Chart & Bar Data Queries

### `getBars`
Returns OHLCV bar chart data for tracking token price changes over time.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbol | String! | Yes | Pair address:networkId format |
| from | Int! | Yes | Start Unix timestamp |
| to | Int! | Yes | End Unix timestamp |
| resolution | String! | Yes | Bar resolution (1, 5, 15, 30, 60, 240, 1D, 1W) |
| quoteToken | QuoteToken | No | Quote token (token0 or token1) |
| currencyCode | String | No | Currency for price (default: USD) |

**Returns:** `BarsResponse`

**BarsResponse Fields:**
- `o` - Array of open prices
- `h` - Array of high prices
- `l` - Array of low prices
- `c` - Array of close prices
- `v` - Array of volumes
- `volume` - Volume in quote currency
- `s` - Status (ok/error)
- `t` - Array of timestamps

**Resolution Options:**
- `1` - 1 minute
- `5` - 5 minutes
- `15` - 15 minutes
- `30` - 30 minutes
- `60` - 1 hour
- `240` - 4 hours
- `1D` - 1 day
- `1W` - 1 week

**Solana Support:** ✅ Yes

**Example Symbol Format:** `pairAddress:1399811149`

---

### `getDetailedPairStats`
Returns bucketed statistics for a token within a pair.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| pairAddress | String! | Yes | Pair address |
| networkId | Int! | Yes | Network ID |
| tokenOfInterest | TokenOfInterest | No | Which token in pair |
| statsType | TokenPairStatisticsType | No | Type of stats |
| duration | DetailedPairStatsDuration | No | Time window |
| bucketCount | Int | No | Number of buckets |

**Returns:** `DetailedPairStats`

**Key Fields:**
- `currentValue` - Current metric value
- `previousValue` - Previous period value
- `percentChange` - Change percentage
- Bucketed data arrays for charting

**Duration Options:**
- hour, day, week, month, year

**Solana Support:** ✅ Yes

---

### `chartUrls`
Returns embeddable chart URLs for tokens.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | ChartUrlsInput | No | Chart configuration |

**Returns:** `ChartUrlsResponse`

**Solana Support:** ✅ Yes

---

### `getTokenPrices`
Returns real-time or historical prices for tokens.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| inputs | [GetPriceInput!]! | Yes | Array of price requests |

**GetPriceInput Fields:**
- `address` (String!) - Token address
- `networkId` (Int!) - Network ID
- `timestamp` (Int) - Historical timestamp (optional)
- `blockNumber` (Int) - Specific block (optional)

**Returns:** `[Price!]!`

**Note:** Provides weighted price across all pools. Individual pool prices may vary.

**Solana Support:** ✅ Yes

---

## Pair & Pool Queries

### `filterPairs`
Returns a list of pairs based on filter criteria.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| filters | PairFilters | No | Filter conditions |
| rankings | PairRankings | No | Sort order |
| limit | Int | No | Max results |
| cursor | String | No | Pagination cursor |

**PairFilters Fields:**
- `network` (Int) - Network ID
- `tokenAddress` (String) - Token in the pair
- `exchangeId` (String) - Specific exchange
- `volume24` (NumberFilter) - Volume filter
- `liquidity` (NumberFilter) - Liquidity filter
- `createdAt` (NumberFilter) - Creation time filter

**Returns:** `PairFilterConnection`

**Solana Support:** ✅ Yes

---

### `pair`
Returns metadata for a specific pair.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | PairInput! | Yes | Pair identifier |

**PairInput Fields:**
- `address` (String!) - Pair address
- `networkId` (Int!) - Network ID

**Returns:** `PairMetadata!`

**Key Fields:**
- `address` - Pair address
- `token0` - First token info
- `token1` - Second token info
- `exchange` - Exchange metadata
- `liquidity` - Liquidity data
- `lockedLiquidity` - Locked liquidity breakdown

**Solana Support:** ✅ Yes

---

### `pairs`
Returns metadata for multiple pairs.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | PairsInput! | Yes | Array of pair identifiers |

**Returns:** `[Pair]!`

**Solana Support:** ✅ Yes

---

### `listPairsWithMetadataForToken`
Lists all pairs containing a specific token with full metadata.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tokenAddress | String! | Yes | Token address |
| networkId | Int! | Yes | Network ID |

**Returns:** Array of pair metadata

**Note:** Use this to find all pools for a token, then filter by volume.

**Solana Support:** ✅ Yes

---

### `getLatestPairs` (DEPRECATED)
Get list of the latest pairs deployed.

**Note:** Use `filterPairs` with `createdAt: DESC` sort instead.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| networkIds | [Int!] | No | Filter by networks |
| limit | Int | No | Max results |
| cursor | String | No | Pagination cursor |

**Returns:** `LatestPairConnection`

**Solana Support:** ✅ Yes

---

## Token Events Queries

### `getTokenEvents`
Returns swap/trade events for a token.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | TokenEventsQueryInput! | Yes | Event query parameters |
| cursor | String | No | Pagination cursor |
| limit | Int | No | Max results (max: 200) |

**TokenEventsQueryInput Fields:**
- `address` (String!) - Token address
- `networkId` (Int!) - Network ID
- `from` (Int) - Start timestamp
- `to` (Int) - End timestamp
- `maker` (String) - Filter by maker wallet
- `eventDisplayType` (EventDisplayType) - Buy/Sell filter

**Returns:** `TokenEventsResponse`

**Key Event Fields:**
- `timestamp` - Event timestamp
- `blockNumber` - Block number
- `transactionHash` - Transaction hash
- `maker` - Wallet that initiated
- `token0` / `token1` - Token amounts
- `priceUsd` - USD price at time of trade
- `labels` - Event labels (sandwich, washtrade, etc.)

**Note:** Looks at top pair by default. Use `listPairsWithMetadataForToken` to find specific pools.

**Pagination:** Use `cursor` parameter for more than 200 events.

**Solana Support:** ✅ Yes

---

### `getTokenEventsForMaker`
Returns all swap events for a specific wallet address.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | TokenEventsForMakerInput! | Yes | Query parameters |

**Input Fields:**
- `makerAddress` (String!) - Wallet address
- `networkId` (Int!) - Network ID
- `tokenAddress` (String) - Optional token filter
- `cursor` (String) - Pagination cursor

**Returns:** `TokenEventsForMakerResponse`

**Use Case:** Calculate wallet PnL by summing buys/sells and comparing with current balance.

**Solana Support:** ✅ Yes

---

### `getEventLabels`
Returns metadata for event labels.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| cursor | String | No | Pagination cursor |

**Returns:** `EventLabelConnection`

**Label Types:**
- `sandwich` - Sandwich attack
- `washtrade` - Wash trading

**Solana Support:** ✅ Yes

---

## Network Queries

### `getNetworks`
Returns list of all supported networks.

**Arguments:** None

**Returns:** `[Network!]!`

**Network Fields:**
- `id` - Network ID
- `name` - Network name
- `shortName` - Short name
- `nativeToken` - Native token info
- `status` - Network status

**Solana Network:**
```json
{
  "id": 1399811149,
  "name": "Solana",
  "shortName": "solana"
}
```

---

### `getNetworkStats`
Returns aggregated statistics for a network.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| networkId | Int! | Yes | Network ID |

**Returns:** `GetNetworkStatsResponse`

**Solana Support:** ✅ Yes

---

### `filterNetworkWallets`
Filter wallets on a specific network.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| filters | NetworkWalletFilters | No | Filter conditions |
| rankings | NetworkWalletRankings | No | Sort order |

**Returns:** `NetworkWalletFilterConnection!`

**Solana Support:** ✅ Yes

---

## Launchpad Queries

### `filterLaunchpadTokens`
Filter tokens launched on specific launchpads.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| filters | LaunchpadTokenFilters | No | Filter conditions |
| rankings | LaunchpadTokenRankings | No | Sort order |
| limit | Int | No | Max results |
| cursor | String | No | Pagination cursor |

**LaunchpadTokenFilters Fields:**
- `network` (Int) - Network ID
- `launchpad` (String) - Launchpad identifier (e.g., "pumpfun")
- `status` (LaunchpadStatus) - Token status
- `graduationPercent` (NumberFilter) - Progress filter
- `createdAt` (NumberFilter) - Creation time filter

**Launchpad Statuses:**
- `New` - Just created
- `Completing` - In bonding curve
- `Completed` - Bonding curve complete
- `Migrating` - Migrating to DEX
- `Migrated` - On DEX

**Note:** Launchpads like Zora, Base, Clanker without bonding curves will only show 'New' status.

**Solana Support:** ✅ Yes (pump.fun, etc.)

---

### `getLatestTokens` (DEPRECATED)
Get list of newly created tokens.

**Note:** Use `filterTokens` with `createdAt: DESC` filter instead.

**Solana Support:** ✅ Yes

---

## NFT Queries

Codex also provides NFT-related queries. While primarily EVM-focused, some may support Solana NFTs.

### `filterNftCollections`
Filter NFT collections by various criteria.

**Returns:** `NftCollectionFilterConnection`

### `getNftCollectionMetadata`
Get metadata for an NFT collection.

**Returns:** `NftCollectionMetadataResponse`

### `getNftAssets`
Get NFT assets within a collection.

**Returns:** `NftAssetsResponse`

### `nftHolders`
Get holders of an NFT collection.

**Returns:** `NftHoldersResponse!`

---

## Webhook & Subscription Queries

### Subscriptions (WebSocket)

#### `onPricesUpdated`
Live-streamed price updates for multiple tokens.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| inputs | [PriceUpdateInput!]! | Yes | Tokens to subscribe to |

**Limits:** Up to 25 tokens per subscription. Create multiple subscriptions for more.

**Solana Support:** ✅ Yes

---

#### `onBarsUpdated`
Real-time bar chart updates.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| symbols | [String!]! | Yes | Pair symbols to subscribe to |
| resolution | String! | Yes | Bar resolution |
| quoteToken | QuoteToken | No | Quote token |

**Use Case:** Fetch initial bars with `getBars`, then subscribe for real-time updates.

**Solana Support:** ✅ Yes

---

#### `onUnconfirmedBarsUpdated`
Unconfirmed (pending) bar updates.

**Returns:** `UnconfirmedBarsUpdatedResponse`

**Solana Support:** ✅ Yes

---

#### `onHoldersUpdated`
Real-time holder count updates.

**Note:** Available for Enterprise plans only.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | HoldersUpdatedInput! | Yes | Token identifier |

**Returns:** `HoldersUpdatedResponse`

**Solana Support:** ✅ Yes (Enterprise)

---

#### `onLaunchpadTokenEvent`
Real-time launchpad token events.

**Event Types:**
- `Deployed` - Immediate notification (minimal latency, may lack metadata)
- `Created` - After metadata fetch (3-4s latency, complete info)

**Solana Support:** ✅ Yes

---

#### `onEventsCreated`
Real-time swap/trade events.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | EventsCreatedInput! | Yes | Event subscription config |

**Solana Support:** ✅ Yes

---

### Webhook Management

#### `getWebhooks`
Returns list of configured webhooks.

**Returns:** `GetWebhooksResponse`

#### `createWebhooks`
Create new webhook subscriptions.

**Returns:** `CreateWebhooksResult`

#### `deleteWebhooks`
Delete webhook subscriptions.

**Returns:** `DeleteWebhooksResult`

**Plan Limits:**
- Growth: 300 websocket connections, unlimited webhooks

---

## API Authentication Queries

### `apiToken`
Get information about a specific API token.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| token | String! | Yes | API token to query |

**Returns:** `ApiToken!`

---

### `apiTokens`
Get all API tokens for account.

**Returns:** `[ApiToken!]!`

---

## Community Queries

### `communityNotes`
Get community-gathered proposals and notes for an asset.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | CommunityNotesInput! | Yes | Asset identifier |

**Returns:** `CommunityNotesResponse!`

**Solana Support:** ✅ Yes

---

## Example Queries for Solana

### Get Token Information (JTO)
```graphql
query GetJtoToken {
  token(input: {
    address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"
    networkId: 1399811149
  }) {
    address
    name
    symbol
    totalSupply
    holderCount
    decimals
    info {
      imageSmallUrl
      description
    }
    createdAt
    creatorAddress
  }
}
```

### Get Top Holders
```graphql
query GetJtoHolders {
  holders(input: {
    tokenAddress: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"
    networkId: 1399811149
    limit: 100
  }) {
    count
    items {
      address
      balance
      percentOwned
    }
  }
}
```

### Filter Trending Solana Tokens
```graphql
query TrendingSolanaTokens {
  filterTokens(
    filters: {
      network: 1399811149
      buyVolume24: {gt: 5000}
      circulatingMarketCap: {gt: 1000000, lt: 20000000}
    }
    rankings: {attribute: trendingScore24, direction: DESC}
    limit: 25
  ) {
    results {
      buyVolume24
      sellVolume24
      circulatingMarketCap
      createdAt
      holders
      liquidity
      token {
        info {
          address
          name
          symbol
        }
        createdAt
        creatorAddress
        createTransactionHash
      }
      txnCount24
      walletAgeAvg
      walletAgeStd
    }
  }
}
```

### Get OHLCV Bar Data
```graphql
query GetBars {
  getBars(
    symbol: "PAIR_ADDRESS:1399811149"
    from: 1678743827
    to: 1678744027
    resolution: "60"
    quoteToken: token1
  ) {
    o
    h
    l
    c
    v
    volume
    s
    t
  }
}
```

### Get Token Events
```graphql
query GetRecentTrades {
  getTokenEvents(
    query: {
      address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"
      networkId: 1399811149
    }
    limit: 50
  ) {
    items {
      timestamp
      blockNumber
      transactionHash
      maker
      priceUsd
      labels {
        type
      }
    }
    cursor
  }
}
```

### Get Detailed Pair Stats
```graphql
query GetPairStats {
  getDetailedPairStats(
    pairAddress: "PAIR_ADDRESS"
    networkId: 1399811149
    tokenOfInterest: token0
    duration: day
    bucketCount: 24
  ) {
    currentValue
    previousValue
    percentChange
  }
}
```

### Get Wallet Balances
```graphql
query GetWalletBalances {
  balances(input: {
    walletAddress: "WALLET_ADDRESS"
    networkIds: [1399811149]
  }) {
    items {
      tokenAddress
      balance
      token {
        name
        symbol
      }
    }
  }
}
```

### Get All Supported Networks
```graphql
query GetNetworks {
  getNetworks {
    id
    name
    shortName
    nativeToken {
      address
      symbol
      name
    }
  }
}
```

---

## Important Notes for Solana

1. **Network ID:** Always use `1399811149` for Solana mainnet
2. **Native Token:** SOL is not directly supported; use wrapped SOL (WSOL)
3. **Token Addresses:** Use the mint address (base58 encoded)
4. **Pair Format:** For `getBars`, use format `pairAddress:1399811149`
5. **Holder Data:** Indexed after swap activity occurs
6. **Launchpads:** pump.fun and other Solana launchpads are supported

## Rate Limits & Best Practices

- Default rate limit: 30 requests per second (varies by plan)
- Use pagination (`cursor`) for large result sets
- Batch token queries when possible (up to 100 tokens)
- Use `filterTokens` instead of deprecated `searchTokens`
- For real-time data, prefer WebSocket subscriptions over polling
- Cache static data (token metadata) to reduce API calls

## Plan Requirements

| Feature | Free | Growth | Enterprise |
|---------|------|--------|------------|
| Basic queries | ✅ | ✅ | ✅ |
| `balances` | ❌ | ✅ | ✅ |
| `onHoldersUpdated` | ❌ | ❌ | ✅ |
| WebSocket connections | 10 | 300 | Custom |
| Webhooks | Limited | Unlimited | Unlimited |

---

## Related Resources

- **API Explorer:** https://explorer.codex.io
- **Schema File:** https://graph.codex.io/schema/latest.graphql
- **SDK:** @codex-data/sdk (npm)
- **Live Data:** https://defined.fi (powered by Codex)

---

*Document generated from Codex.io official documentation. Last updated: February 2026*
