# Codex.io API: Wallet-Level Enrichment Research

This document outlines how to use the Codex.io API for wallet-level enrichment including smart money detection, PnL analysis, and holder persona classification.

## Table of Contents
1. [Current Implementation Status](#current-implementation-status)
2. [Per-Wallet Buy/Sell Timelines](#per-wallet-buysell-timelines)
3. [Smart Money Detection](#smart-money-detection)
4. [Holder Segmentation](#holder-segmentation)
5. [Event Labels Reference](#event-labels-reference)
6. [Rate Limits & Pagination](#rate-limits--pagination)
7. [Batch Query Strategies](#batch-query-strategies)
8. [Missing Endpoints to Implement](#missing-endpoints-to-implement)
9. [Advanced Analytics](#advanced-analytics)
10. [Implementation Recommendations](#implementation-recommendations)

---

## Current Implementation Status

Our existing `CodexClient` (src/lib/api/codex.ts) has these relevant methods:

| Method | Purpose | Rate Cost |
|--------|---------|-----------|
| `getTokenEvents()` | Token trading events (all makers) | 1 request |
| `getWalletStats()` | Overall wallet PnL stats | 1 request |
| `filterTokenWallets()` | Filter wallets by balance/percent | 1 request |
| `getHolders()` | Paginated holder list | 1 request per page |
| `getTokenInfo()` | Token metadata incl. holder count | 1 request |

**Missing endpoints we need to add:**
- `getTokenEventsForMaker()` - Per-wallet trading events
- `filterWallets()` - Global wallet discovery by PnL/activity
- `detailedWalletStats()` - Comprehensive wallet metrics
- `walletChart()` - Time-series wallet performance
- `balances()` - Current wallet holdings across tokens
- `backfillWalletAggregates()` - Trigger wallet stats backfill

---

## Per-Wallet Buy/Sell Timelines

### Method: `getTokenEventsForMaker`

This endpoint returns trading events for a specific wallet address, enabling us to build complete buy/sell timelines.

### GraphQL Query

```graphql
query GetWalletEvents($query: MakerEventsQueryInput!, $limit: Int, $cursor: String) {
  getTokenEventsForMaker(query: $query, limit: $limit, cursor: $cursor) {
    items {
      address                    # Token address
      timestamp                  # Unix timestamp
      eventDisplayType           # "Buy" or "Sell"
      eventType                  # "Swap", "Mint", "Burn"
      transactionHash
      token0Address
      token1Address
      token0ValueBase
      token1ValueBase
      baseTokenPrice
      data {
        amount0                  # Negative = received, Positive = spent
        amount1                  # Negative = received, Positive = spent
        priceUsd
        priceUsdTotal
      }
    }
    cursor
  }
}
```

### Variables

```json
{
  "query": {
    "maker": "WALLET_ADDRESS",
    "networkId": 1399811149,                    // Solana
    "tokenAddress": "TOKEN_MINT_ADDRESS",       // Optional: filter to specific token
    "eventType": "Swap",                        // Optional: Swap, Mint, Burn
    "minPriceUsd": 1                            // Optional: filter small trades
  },
  "limit": 100,
  "cursor": null
}
```

### API Calls Needed

For a single wallet analyzing one token:
- **1 request** per 100 events (pagination required for active traders)

For analyzing a holder across 88 tokens:
- **88 requests** minimum (one per token)
- More if wallets have >100 events per token

### Computing Hold Durations

```typescript
interface WalletTradeTimeline {
  tokenAddress: string;
  walletAddress: string;
  firstBuyTimestamp: number | null;
  lastSellTimestamp: number | null;
  currentHoldDurationDays: number;
  totalBuys: number;
  totalSells: number;
  avgHoldTimeBetweenTrades: number;
  stillHolding: boolean;
}

function computeHoldDuration(events: CodexMakerEvent[]): WalletTradeTimeline {
  const buys = events.filter(e => e.eventDisplayType === "Buy");
  const sells = events.filter(e => e.eventDisplayType === "Sell");
  
  const firstBuy = buys.length > 0 ? Math.min(...buys.map(b => b.timestamp)) : null;
  const lastSell = sells.length > 0 ? Math.max(...sells.map(s => s.timestamp)) : null;
  
  const stillHolding = buys.length > sells.length || 
                       (lastSell !== null && firstBuy !== null && firstBuy > lastSell);
  
  const now = Math.floor(Date.now() / 1000);
  const holdDuration = firstBuy ? (now - firstBuy) / 86400 : 0;
  
  return {
    tokenAddress: events[0]?.address ?? "",
    walletAddress: events[0]?.maker ?? "",
    firstBuyTimestamp: firstBuy,
    lastSellTimestamp: lastSell,
    currentHoldDurationDays: holdDuration,
    totalBuys: buys.length,
    totalSells: sells.length,
    avgHoldTimeBetweenTrades: computeAvgHoldTime(events),
    stillHolding,
  };
}
```

### Data Freshness

- Events are indexed in **< 1 second** after on-chain confirmation
- Historical data goes back to token creation
- Multi-hop transactions show intermediate swaps (use `transactionHash` to dedupe)

---

## Smart Money Detection

### Primary Method: `filterWallets`

> **Note:** Requires Growth or Enterprise plan ($350+/month)

This endpoint allows filtering wallets globally by PnL, volume, win rate, and trading activity.

### GraphQL Query

```graphql
query FilterSmartMoney($filters: WalletFilterInput, $rankings: [WalletRanking!], $limit: Int) {
  filterWallets(filters: $filters, rankings: $rankings, limit: $limit) {
    results {
      address
      labels                     # ["Sniper", "Early Bird", etc.]
      
      # 30-day metrics (also available: 1d, 7d, 1y)
      pnlUsd30d
      pnlPercent30d
      winRate30d
      volume30d
      swaps30d
      uniqueTokens30d
      avgProfitUsd30d
      avgSwapUsd30d
      
      # Bot/scam detection
      scammerScore
      botScore
    }
    count
  }
}
```

### Smart Money Classification Criteria

Based on Codex's built-in wallet labels:

| Label | Criteria | Persona Mapping |
|-------|----------|-----------------|
| **Wealthy (High)** | Holds $10M+ in assets | Whale + Diamond Hands |
| **Wealthy (Medium)** | Holds $5M+ in assets | Whale |
| **Wealthy (Low)** | Holds $1M+ in assets | Large Shark |
| **Sniper** | Profits $3k+ from tokens bought within 1 hour of launch | Flipper/Trader |
| **Early Bird** | Profits $5k+ from tokens 1hr-2days old | Smart Money |
| **Second Wave** | Profits $7.5k+ from established tokens (2+ days old) | Smart Money |
| **Scammer/Bot** | Suspicious trading behavior | Exclude from analysis |

### Filter Examples

**Find profitable wallets holding our tokens:**

```json
{
  "filters": {
    "pnlUsd30d": { "gte": 1000 },
    "winRate30d": { "gte": 0.5 },
    "swaps30d": { "gte": 10 },
    "scammerScore": { "lte": 0.3 },
    "botScore": { "lte": 0.3 },
    "networkId": 1399811149
  },
  "rankings": [
    { "attribute": "pnlUsd30d", "direction": "DESC" }
  ],
  "limit": 100
}
```

### Secondary Method: `detailedWalletStats`

For deep-dive into specific wallets:

```graphql
query WalletDeepDive($walletAddress: String!, $networkId: Int!) {
  detailedWalletStats(walletAddress: $walletAddress, networkId: $networkId) {
    walletAddress
    
    # Performance metrics
    pnlUsd1d
    pnlUsd7d
    pnlUsd30d
    pnlUsd1y
    
    pnlPercent1d
    pnlPercent7d
    pnlPercent30d
    pnlPercent1y
    
    winRate1d
    winRate7d
    winRate30d
    winRate1y
    
    # Activity metrics
    volume1d
    volume7d
    volume30d
    volume1y
    
    swaps1d
    swaps7d
    swaps30d
    swaps1y
    
    uniqueTokens1d
    uniqueTokens7d
    uniqueTokens30d
    uniqueTokens1y
    
    # Averages
    avgProfitUsd30d
    avgSwapUsd30d
    
    # Labels and scores
    labels
    scammerScore
    botScore
  }
}
```

### Smart Money Classification Algorithm

```typescript
interface SmartMoneyScore {
  score: number;          // 0-100
  isSmartMoney: boolean;
  reasons: string[];
  persona: HolderPersona;
}

type HolderPersona = 
  | "smart_whale"      // High PnL + large holdings
  | "smart_trader"     // High win rate, frequent trades
  | "diamond_hands"    // Long hold duration, positive PnL
  | "accumulator"      // Consistent buying over time
  | "sniper"           // Early entry, quick exits
  | "dumb_money"       // Negative PnL, panic sells
  | "bot"              // High bot score
  | "unknown";

function classifyWallet(stats: DetailedWalletStats): SmartMoneyScore {
  let score = 50; // Baseline
  const reasons: string[] = [];
  
  // PnL contribution (40% weight)
  if (stats.pnlPercent30d > 100) { score += 20; reasons.push("100%+ 30d returns"); }
  else if (stats.pnlPercent30d > 50) { score += 15; reasons.push("50%+ 30d returns"); }
  else if (stats.pnlPercent30d > 20) { score += 10; reasons.push("20%+ 30d returns"); }
  else if (stats.pnlPercent30d < -20) { score -= 15; reasons.push("Significant losses"); }
  
  // Win rate contribution (30% weight)
  if (stats.winRate30d > 0.7) { score += 15; reasons.push("70%+ win rate"); }
  else if (stats.winRate30d > 0.5) { score += 10; reasons.push("50%+ win rate"); }
  else if (stats.winRate30d < 0.3) { score -= 10; reasons.push("Low win rate"); }
  
  // Activity consistency (20% weight)
  if (stats.swaps30d > 100) { score += 10; reasons.push("Active trader"); }
  if (stats.uniqueTokens30d > 20) { score += 5; reasons.push("Diverse portfolio"); }
  
  // Label bonuses
  if (stats.labels?.includes("Early Bird")) { score += 10; reasons.push("Early Bird label"); }
  if (stats.labels?.includes("Sniper")) { score += 5; reasons.push("Sniper label"); }
  if (stats.labels?.includes("Wealthy")) { score += 5; reasons.push("Wealthy label"); }
  
  // Penalties
  if (stats.botScore > 0.7) { score -= 30; reasons.push("High bot score"); }
  if (stats.scammerScore > 0.5) { score -= 40; reasons.push("Potential scammer"); }
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    score,
    isSmartMoney: score >= 70,
    reasons,
    persona: determinePersona(stats, score),
  };
}

function determinePersona(stats: DetailedWalletStats, score: number): HolderPersona {
  if (stats.botScore > 0.7) return "bot";
  if (stats.scammerScore > 0.5) return "bot";
  
  const hasWealthyLabel = stats.labels?.some(l => l.includes("Wealthy"));
  const hasEarlyBird = stats.labels?.includes("Early Bird");
  const hasSniper = stats.labels?.includes("Sniper");
  
  if (score >= 80 && hasWealthyLabel) return "smart_whale";
  if (score >= 70 && hasSniper) return "sniper";
  if (score >= 70 && hasEarlyBird) return "smart_trader";
  if (score >= 60 && stats.swaps30d < 10 && stats.pnlPercent30d > 0) return "diamond_hands";
  if (score >= 60) return "accumulator";
  if (stats.pnlPercent30d < -30 && stats.swaps30d > 20) return "dumb_money";
  
  return "unknown";
}
```

### Rate Limit Cost

- `filterWallets`: 1 request per query
- `detailedWalletStats`: 1 request per wallet
- For 1000 holders: **1000 requests** for full stats

---

## Holder Segmentation

### Using `filterTokenWallets`

Our existing method segments holders by balance percentage. Here's how to use it with real thresholds:

### Segmentation Thresholds (Based on % of Supply)

| Category | % of Supply | Typical Count | Characteristics |
|----------|-------------|---------------|-----------------|
| **Whale** | ≥ 1% | 5-20 | Market movers, governance power |
| **Shark** | 0.1% - 1% | 20-100 | Significant influence |
| **Dolphin** | 0.01% - 0.1% | 100-500 | Active community members |
| **Fish** | < 0.01% | 500+ | General retail |

### Query Examples

**Get all whales (≥1% supply):**

```graphql
query GetWhales($input: FilterTokenWalletsInput!) {
  filterTokenWallets(input: $input) {
    results {
      address
      balance
      percentOwned
    }
  }
}
```

```json
{
  "input": {
    "tokenAddress": "META_TOKEN_ADDRESS",
    "networkId": 1399811149,
    "percentOwned": { "gte": 0.01 }
  }
}
```

**Get sharks (0.1% - 1%):**

```json
{
  "input": {
    "tokenAddress": "META_TOKEN_ADDRESS",
    "networkId": 1399811149,
    "percentOwned": { "gte": 0.001, "lt": 0.01 }
  }
}
```

### Enriching with Smart Money Data

After getting holder segments, cross-reference with wallet stats:

```typescript
interface EnrichedHolder {
  address: string;
  balance: number;
  percentOwned: number;
  category: WalletCategory;        // whale, shark, dolphin, fish
  persona: HolderPersona;          // smart_whale, diamond_hands, etc.
  smartMoneyScore: number;
  pnl30d: number;
  winRate30d: number;
  firstBuyTimestamp: number | null;
  holdDurationDays: number;
  isActive: boolean;               // Traded in last 30 days
}

async function enrichHolders(
  holders: CodexTokenHolder[],
  tokenAddress: string
): Promise<EnrichedHolder[]> {
  const enriched: EnrichedHolder[] = [];
  
  for (const holder of holders) {
    // Get wallet stats (1 API call)
    const stats = await codex.getDetailedWalletStats(holder.address);
    
    // Get trading timeline for this token (1+ API calls)
    const events = await codex.getTokenEventsForMaker({
      maker: holder.address,
      tokenAddress,
      networkId: SOLANA_NETWORK_ID,
    });
    
    const timeline = computeHoldDuration(events);
    const classification = classifyWallet(stats);
    
    enriched.push({
      address: holder.address,
      balance: parseFloat(holder.balance),
      percentOwned: holder.percentOwned,
      category: categorizeByPercent(holder.percentOwned),
      persona: classification.persona,
      smartMoneyScore: classification.score,
      pnl30d: stats.pnlUsd30d,
      winRate30d: stats.winRate30d,
      firstBuyTimestamp: timeline.firstBuyTimestamp,
      holdDurationDays: timeline.currentHoldDurationDays,
      isActive: stats.swaps30d > 0,
    });
  }
  
  return enriched;
}
```

---

## Event Labels Reference

### `eventDisplayType` Values

| Value | Meaning | Detection |
|-------|---------|-----------|
| `"Buy"` | Wallet received the token | Primary perspective for non-native token |
| `"Sell"` | Wallet sold the token | Primary perspective for non-native token |

### `eventType` Values

| Value | Description |
|-------|-------------|
| `"Swap"` | DEX trade |
| `"Mint"` | Token minting (LP tokens, etc.) |
| `"Burn"` | Token burning |

### `labels` Array (Event-Level)

| Label | Meaning |
|-------|---------|
| `"sandwich"` | MEV sandwich attack detected |
| `"washtrade"` | Potential wash trading |

### Amount Sign Convention

From `data.amount0` and `data.amount1`:
- **Negative amount** = Token received (INTO wallet)
- **Positive amount** = Token spent (OUT of wallet)

```typescript
function determineBuySell(event: CodexMakerEvent): "buy" | "sell" {
  // Method 1: Use eventDisplayType (recommended)
  return event.eventDisplayType.toLowerCase() as "buy" | "sell";
  
  // Method 2: Parse amounts (for verification)
  const amount0 = parseFloat(event.data.amount0);
  const amount1 = parseFloat(event.data.amount1);
  
  // If target token (amount0) is negative, we received it = buy
  return amount0 < 0 ? "buy" : "sell";
}
```

---

## Rate Limits & Pagination

### Codex Pricing Tiers

| Plan | Monthly Requests | Price | Rate Limit |
|------|------------------|-------|------------|
| Free | 10,000 | $0 | ~1 req/sec |
| Growth | 1,000,000 | $350 | ~10 req/sec |
| Enterprise | Custom | Custom | Custom |

**Key limits:**
- Tokens query: max 100 tokens per request
- filterTokens: max 200 tokens per call  
- getTokenEvents: max 200 events per request (use pagination)
- Overage: Charged at plan rate ($0.00035/request for Growth)

### Our Current Rate Limiter

```typescript
// src/lib/api/codex.ts
private limiter = new RateLimiter(30, 0.5); // 30 burst, 0.5/sec refill
```

This is conservative (~1800 req/hour). For bulk operations, consider:

```typescript
// Aggressive limiter for bulk jobs
const bulkLimiter = new RateLimiter(50, 5); // 50 burst, 5/sec refill
```

### Pagination Strategy

```typescript
async function getAllTokenEvents(
  tokenAddress: string,
  maker: string
): Promise<CodexMakerEvent[]> {
  const allEvents: CodexMakerEvent[] = [];
  let cursor: string | null = null;
  
  do {
    const response = await codex.getTokenEventsForMaker({
      tokenAddress,
      maker,
      networkId: SOLANA_NETWORK_ID,
      limit: 200,  // Max per request
      cursor,
    });
    
    allEvents.push(...response.items);
    cursor = response.cursor;
    
    // Respect rate limits
    await delay(200); // 5 req/sec max
    
  } while (cursor && allEvents.length < 10000); // Safety limit
  
  return allEvents;
}
```

### Cost Estimation for Full Analysis

**For 88 tokens with 1000 holders each:**

| Operation | Calls per Token | Total Calls | Est. Cost |
|-----------|-----------------|-------------|-----------|
| Get holders | 10 (1000/100) | 880 | $0.31 |
| Wallet stats | 1000 | 88,000 | $30.80 |
| Events per wallet | 1-5 avg | 176,000 | $61.60 |
| **Total** | | ~265,000 | **~$93** |

**Optimized approach (top 100 holders per token):**

| Operation | Calls per Token | Total Calls | Est. Cost |
|-----------|-----------------|-------------|-----------|
| Get holders | 1 | 88 | $0.03 |
| Wallet stats | 100 | 8,800 | $3.08 |
| Events per wallet | 2 avg | 17,600 | $6.16 |
| **Total** | | ~26,500 | **~$9.30** |

---

## Batch Query Strategies

### Batching Token Queries

Use `getTokensBatch` for metadata:

```typescript
const tokens = await codex.getTokensBatch(
  tokenAddresses.slice(0, 100).map(address => ({ address, networkId: SOLANA_NETWORK_ID }))
);
```

### Parallel Processing with Concurrency Limit

```typescript
import pLimit from 'p-limit';

const limit = pLimit(5); // 5 concurrent requests

async function enrichAllHolders(holders: string[]): Promise<WalletStats[]> {
  const tasks = holders.map(address => 
    limit(() => codex.getDetailedWalletStats(address))
  );
  
  return Promise.all(tasks);
}
```

### Caching Strategy

```typescript
const CACHE_TTL = {
  walletStats: 3600,      // 1 hour
  tokenEvents: 300,       // 5 minutes
  holders: 600,           // 10 minutes
  tokenInfo: 86400,       // 24 hours
};

class CachedCodexClient {
  private cache: Map<string, { data: unknown; expires: number }> = new Map();
  
  async getWalletStats(address: string): Promise<WalletStats> {
    const key = `wallet:${address}`;
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data as WalletStats;
    }
    
    const data = await this.client.getDetailedWalletStats(address);
    this.cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL.walletStats * 1000,
    });
    
    return data;
  }
}
```

---

## Missing Endpoints to Implement

### 1. `getTokenEventsForMaker` (HIGH PRIORITY)

```typescript
async getTokenEventsForMaker(
  query: MakerEventsQuery,
  limit = 100,
  cursor?: string
): Promise<MakerEventsResponse> {
  const data = await this.query<{ getTokenEventsForMaker: MakerEventsResponse }>(
    `query($query: MakerEventsQueryInput!, $limit: Int, $cursor: String) {
      getTokenEventsForMaker(query: $query, limit: $limit, cursor: $cursor) {
        items {
          address
          timestamp
          eventDisplayType
          eventType
          transactionHash
          token0Address
          token1Address
          token0ValueBase
          token1ValueBase
          baseTokenPrice
          data {
            amount0
            amount1
            priceUsd
            priceUsdTotal
          }
        }
        cursor
      }
    }`,
    { query, limit, cursor }
  );
  return data.getTokenEventsForMaker;
}
```

### 2. `filterWallets` (REQUIRES GROWTH PLAN)

```typescript
async filterWallets(
  filters: WalletFilters,
  rankings?: WalletRanking[],
  limit = 100
): Promise<FilterWalletsResponse> {
  const data = await this.query<{ filterWallets: FilterWalletsResponse }>(
    `query($filters: WalletFilterInput, $rankings: [WalletRanking!], $limit: Int) {
      filterWallets(filters: $filters, rankings: $rankings, limit: $limit) {
        results {
          address
          labels
          pnlUsd30d
          pnlPercent30d
          winRate30d
          volume30d
          swaps30d
          uniqueTokens30d
          scammerScore
          botScore
        }
        count
      }
    }`,
    { filters, rankings, limit }
  );
  return data.filterWallets;
}
```

### 3. `detailedWalletStats` (Enhanced)

Our current `getWalletStats` is limited. Enhance it:

```typescript
async getDetailedWalletStats(
  walletAddress: string,
  networkId = SOLANA_NETWORK_ID
): Promise<DetailedWalletStats> {
  const data = await this.query<{ detailedWalletStats: DetailedWalletStats }>(
    `query($walletAddress: String!, $networkId: Int!) {
      detailedWalletStats(walletAddress: $walletAddress, networkId: $networkId) {
        walletAddress
        networkId
        
        # Multi-timeframe PnL
        pnlUsd1d
        pnlUsd7d
        pnlUsd30d
        pnlUsd1y
        
        pnlPercent1d
        pnlPercent7d
        pnlPercent30d
        pnlPercent1y
        
        # Win rates
        winRate1d
        winRate7d
        winRate30d
        winRate1y
        
        # Activity
        volume1d
        volume7d
        volume30d
        volume1y
        
        swaps1d
        swaps7d
        swaps30d
        swaps1y
        
        uniqueTokens30d
        
        avgProfitUsd30d
        avgSwapUsd30d
        
        # Labels and scoring
        labels
        scammerScore
        botScore
        
        # Timestamps
        firstTransactionTimestamp
        lastTransactionTimestamp
      }
    }`,
    { walletAddress, networkId }
  );
  return data.detailedWalletStats;
}
```

### 4. `walletChart` (Time-Series)

```typescript
async getWalletChart(
  walletAddress: string,
  networkId: number,
  timeframe: "1D" | "7D" | "30D" | "120D" = "30D"
): Promise<WalletChartData> {
  const data = await this.query<{ walletChart: WalletChartData }>(
    `query($walletAddress: String!, $networkId: Int!, $timeframe: String!) {
      walletChart(walletAddress: $walletAddress, networkId: $networkId, timeframe: $timeframe) {
        points {
          timestamp
          portfolioValueUsd
          pnlUsd
          pnlPercent
        }
      }
    }`,
    { walletAddress, networkId, timeframe }
  );
  return data.walletChart;
}
```

### 5. `balances` (Current Holdings)

```typescript
async getWalletBalances(
  walletAddress: string,
  networkIds?: number[]
): Promise<WalletBalance[]> {
  const data = await this.query<{ balances: { items: WalletBalance[] } }>(
    `query($walletAddress: String!, $networkIds: [Int!]) {
      balances(walletAddress: $walletAddress, networkIds: $networkIds) {
        items {
          tokenAddress
          networkId
          balance
          balanceUsd
          tokenName
          tokenSymbol
        }
      }
    }`,
    { walletAddress, networkIds }
  );
  return data.balances.items;
}
```

---

## Advanced Analytics

### Historical Holder Counts Over Time

**Available via:** `getDetailedTokenStats` with bucket counts

Codex doesn't provide direct historical holder count snapshots, but we can:

1. **Track daily deltas** using our own snapshots:
   ```typescript
   // Store daily holder counts
   interface HolderSnapshot {
     tokenId: string;
     timestamp: number;
     holderCount: number;
     newHolders24h: number;
     lostHolders24h: number;
   }
   ```

2. **Infer from events:**
   ```typescript
   async function getHistoricalHolderTrend(
     tokenAddress: string,
     days: number
   ): Promise<{ date: string; estimatedHolders: number }[]> {
     // Get all events and count unique addresses by date
     const events = await getAllTokenEvents(tokenAddress);
     
     const holdersByDate = new Map<string, Set<string>>();
     const knownHolders = new Set<string>();
     
     for (const event of events.sort((a, b) => a.timestamp - b.timestamp)) {
       const date = new Date(event.timestamp * 1000).toISOString().split('T')[0];
       
       if (event.eventDisplayType === "Buy") {
         knownHolders.add(event.maker);
       }
       // Note: Can't reliably detect full exits without balance data
       
       holdersByDate.set(date, new Set(knownHolders));
     }
     
     return Array.from(holdersByDate.entries()).map(([date, holders]) => ({
       date,
       estimatedHolders: holders.size,
     }));
   }
   ```

### Detecting First Buy Timestamp

```typescript
async function getFirstBuyTimestamp(
  walletAddress: string,
  tokenAddress: string
): Promise<number | null> {
  const events = await codex.getTokenEventsForMaker({
    maker: walletAddress,
    tokenAddress,
    networkId: SOLANA_NETWORK_ID,
  }, 1); // Just need earliest
  
  const buys = events.items.filter(e => e.eventDisplayType === "Buy");
  if (buys.length === 0) return null;
  
  return Math.min(...buys.map(b => b.timestamp));
}
```

### Computing Token Velocity

Token velocity = how fast tokens change hands.

```typescript
interface TokenVelocity {
  tokenAddress: string;
  period: string;
  totalVolume: number;
  circulatingSupply: number;
  velocity: number;  // volume / circulating supply
  avgHoldTime: number;  // 1 / velocity (in periods)
}

async function computeVelocity(
  tokenAddress: string,
  days: number = 30
): Promise<TokenVelocity> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - (days * 86400);
  
  const events = await codex.getTokenEvents(
    tokenAddress,
    SOLANA_NETWORK_ID,
    from,
    now,
    200
  );
  
  const totalVolume = events.reduce((sum, e) => 
    sum + parseFloat(e.data?.priceUsdTotal || "0"), 0
  );
  
  const tokenInfo = await codex.getTokenInfo(tokenAddress);
  const circulatingSupply = parseFloat(tokenInfo?.totalSupply || "0");
  
  const velocity = circulatingSupply > 0 ? totalVolume / circulatingSupply : 0;
  
  return {
    tokenAddress,
    period: `${days}d`,
    totalVolume,
    circulatingSupply,
    velocity,
    avgHoldTime: velocity > 0 ? days / velocity : Infinity,
  };
}
```

---

## Implementation Recommendations

### Phase 1: Core Enrichment (Week 1)

1. **Add `getTokenEventsForMaker`** to CodexClient
   - Essential for buy/sell timelines
   - 1 API call per wallet-token pair

2. **Enhance `getWalletStats`** to full `detailedWalletStats`
   - Already partially implemented
   - Add multi-timeframe metrics and labels

3. **Create caching layer**
   - Redis or in-memory cache
   - TTLs: walletStats=1hr, events=5min

### Phase 2: Smart Money Detection (Week 2)

1. **Implement classification algorithm**
   - Based on PnL, win rate, labels
   - Map to HolderPersona types

2. **Add batch enrichment pipeline**
   - Process holders in parallel (limit: 5)
   - Prioritize whales and sharks

3. **Create smart money leaderboard**
   - Cross-token analysis
   - Track smart money movements

### Phase 3: Advanced Analytics (Week 3)

1. **Add `filterWallets`** (requires Growth plan)
   - Global wallet discovery
   - Find smart money not in our holder lists

2. **Implement velocity metrics**
   - Track token turnover
   - Identify accumulation/distribution phases

3. **Build historical tracking**
   - Daily snapshots of holder composition
   - Trend analysis over time

### Rate Limit Budget

| Priority | Operation | Daily Budget | Monthly Cost |
|----------|-----------|--------------|--------------|
| High | Top 50 holders enrichment | 4,400 | $46 |
| Medium | Full holder analysis (weekly) | 26,500/7 | $40 |
| Low | Global smart money scan | 1,000 | $10 |
| **Total** | | ~8,200/day | **~$96/mo** |

### Error Handling

```typescript
async function safeEnrichWallet(address: string): Promise<EnrichedWallet | null> {
  try {
    const [stats, events] = await Promise.all([
      codex.getDetailedWalletStats(address).catch(() => null),
      codex.getTokenEventsForMaker({ maker: address }).catch(() => ({ items: [] })),
    ]);
    
    if (!stats) {
      // Wallet may not have sufficient history
      return {
        address,
        persona: "unknown",
        smartMoneyScore: 0,
        hasStats: false,
      };
    }
    
    return enrichFromStats(stats, events);
  } catch (error) {
    console.error(`Failed to enrich ${address}:`, error);
    return null;
  }
}
```

---

## Appendix: Type Definitions

```typescript
// Add to src/types/codex.ts

export interface MakerEventsQuery {
  maker: string;
  networkId: number;
  tokenAddress?: string;
  eventType?: "Swap" | "Mint" | "Burn";
  minPriceUsd?: number;
}

export interface CodexMakerEvent {
  address: string;
  timestamp: number;
  eventDisplayType: "Buy" | "Sell";
  eventType: string;
  transactionHash: string;
  token0Address: string;
  token1Address: string;
  token0ValueBase: string;
  token1ValueBase: string;
  baseTokenPrice: string;
  data: {
    amount0: string;
    amount1: string;
    priceUsd: string;
    priceUsdTotal: string;
  };
}

export interface MakerEventsResponse {
  items: CodexMakerEvent[];
  cursor: string | null;
}

export interface DetailedWalletStats {
  walletAddress: string;
  networkId: number;
  
  pnlUsd1d: number;
  pnlUsd7d: number;
  pnlUsd30d: number;
  pnlUsd1y: number;
  
  pnlPercent1d: number;
  pnlPercent7d: number;
  pnlPercent30d: number;
  pnlPercent1y: number;
  
  winRate1d: number;
  winRate7d: number;
  winRate30d: number;
  winRate1y: number;
  
  volume1d: number;
  volume7d: number;
  volume30d: number;
  volume1y: number;
  
  swaps1d: number;
  swaps7d: number;
  swaps30d: number;
  swaps1y: number;
  
  uniqueTokens30d: number;
  avgProfitUsd30d: number;
  avgSwapUsd30d: number;
  
  labels: string[];
  scammerScore: number;
  botScore: number;
  
  firstTransactionTimestamp: number;
  lastTransactionTimestamp: number;
}

export interface WalletFilters {
  pnlUsd30d?: { gte?: number; lte?: number };
  pnlPercent30d?: { gte?: number; lte?: number };
  winRate30d?: { gte?: number; lte?: number };
  volume30d?: { gte?: number; lte?: number };
  swaps30d?: { gte?: number; lte?: number };
  scammerScore?: { lte?: number };
  botScore?: { lte?: number };
  networkId?: number;
  includeLabels?: string[];
  excludeLabels?: string[];
}

export interface WalletRanking {
  attribute: string;
  direction: "ASC" | "DESC";
}

export type HolderPersona =
  | "smart_whale"
  | "smart_trader"
  | "diamond_hands"
  | "accumulator"
  | "sniper"
  | "dumb_money"
  | "bot"
  | "unknown";
```

---

## References

- [Codex API Documentation](https://docs.codex.io/)
- [Codex Wallets Recipe](https://docs.codex.io/recipes/wallets)
- [getTokenEventsForMaker Reference](https://docs.codex.io/api-reference/queries/gettokeneventsformaker)
- [filterWallets Reference](https://docs.codex.io/api-reference/queries/filterwallets)
- [Codex GraphQL Explorer](https://explorer.codex.io/)
- [Codex Pricing](https://www.codex.io/pricing)
