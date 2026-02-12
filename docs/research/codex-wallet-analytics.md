# Codex.io Wallet Analytics Research

## Overview

This document summarizes findings from researching Codex.io's wallet-level analytics capabilities for whale tracking, holder overlap analysis, and PnL tracking on Solana.

**Research Date:** February 2026  
**Codex API Endpoint:** `https://graph.codex.io/graphql`  
**Solana Network ID:** `1399811149`

---

## 1. Wallet/Address Queries

### 1.1 Token Holdings per Wallet

**Query: `balances`**
- **Availability:** Growth and Enterprise plans only
- **Capability:** Returns list of token balances that a wallet holds
- **Use Case:** Look up all tokens held by a specific wallet

```graphql
query GetWalletBalances($walletAddress: String!, $networkId: Int!) {
  balances(input: {
    walletAddress: $walletAddress
    networkId: $networkId
  }) {
    items {
      tokenAddress
      balance
      shiftedBalance
      tokenInfo {
        name
        symbol
        decimals
      }
      usdValue
    }
  }
}
```

**Findings:**
- ✅ Can look up all tokens held by a wallet
- ✅ Includes USD values for each holding
- ⚠️ Requires Growth plan ($350/month minimum)

### 1.2 Wallet Trading History

**Query: `getTokenEventsForMaker`**
- **Capability:** Returns all swap/trade events for a specific wallet (maker)
- **Use Case:** Track wallet trading history, buy/sell activity

```graphql
query GetWalletTrades($walletAddress: String!, $networkId: Int!) {
  getTokenEventsForMaker(input: {
    maker: $walletAddress
    networkId: $networkId
    limit: 100
  }) {
    items {
      timestamp
      transactionHash
      eventType
      tokenAddress
      amount
      priceUsd
      pair {
        token0
        token1
      }
    }
    cursor
  }
}
```

**Findings:**
- ✅ Can get complete trading history per wallet
- ✅ Includes timestamps for first/last activity (via ordering)
- ✅ Includes price at time of trade for PnL calculations

### 1.3 Wallet PnL (Profit/Loss)

**Status:** No dedicated endpoint. Must be computed manually.

**Recommended Approach (from Codex docs):**
1. Use `getTokenEventsForMaker` to get all buy/sell events
2. Use `balances` to get current holdings
3. Sum up buys and sells, use balance to calculate unrealized PnL

```typescript
// Pseudo-code for PnL calculation
async function calculateWalletPnL(wallet: string, tokenAddress: string) {
  const events = await codex.getTokenEventsForMaker({
    maker: wallet,
    tokenAddress: tokenAddress
  });
  
  const balances = await codex.balances({ walletAddress: wallet });
  
  let totalBuyCost = 0;
  let totalSellRevenue = 0;
  
  events.forEach(event => {
    if (event.eventType === 'buy') {
      totalBuyCost += event.amount * event.priceUsd;
    } else if (event.eventType === 'sell') {
      totalSellRevenue += event.amount * event.priceUsd;
    }
  });
  
  const currentBalance = balances.find(b => b.tokenAddress === tokenAddress);
  const unrealizedValue = currentBalance?.usdValue || 0;
  
  return {
    realizedPnL: totalSellRevenue - totalBuyCost,
    unrealizedPnL: unrealizedValue,
    totalPnL: totalSellRevenue + unrealizedValue - totalBuyCost
  };
}
```

**Findings:**
- ⚠️ No direct PnL endpoint
- ✅ All data needed for PnL calculation is available
- ✅ `walletChart` endpoint provides pre-computed PnL graphs (Growth+ plans)

---

## 2. Whale Detection Patterns

### 2.1 Top Holders Query

**Query: `holders`**
- **Availability:** Growth and Enterprise plans only
- **Capability:** Returns top holders for a token, ordered by holdings descending

```graphql
query GetTopHolders($tokenAddress: String!, $networkId: Int!) {
  holders(input: {
    tokenAddress: $tokenAddress
    networkId: $networkId
    limit: 50
  }) {
    count  # Total unique holder count
    items {
      address
      balance
      shiftedBalance
      percentOwned
    }
  }
}
```

**Implementation for META, JTO, JUP, PYTH:**

```typescript
const TOKENS = {
  META: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
};

async function getTopHoldersForAllTokens() {
  const results: Record<string, HolderData[]> = {};
  
  for (const [name, address] of Object.entries(TOKENS)) {
    const response = await codex.holders({
      tokenAddress: address,
      networkId: 1399811149,
      limit: 50
    });
    results[name] = response.items;
  }
  
  return results;
}
```

### 2.2 Cross-Token Whale Overlap

**Query Strategy:**
1. Fetch top N holders for each token
2. Build address sets per token
3. Compute set intersections

```typescript
async function findWhaleOverlap(tokenAddresses: string[], limit = 50) {
  const holderSets: Record<string, Set<string>> = {};
  
  // Fetch holders for each token
  for (const [name, address] of Object.entries(tokenAddresses)) {
    const holders = await codex.holders({
      tokenAddress: address,
      networkId: 1399811149,
      limit
    });
    holderSets[name] = new Set(holders.items.map(h => h.address));
  }
  
  // Compute pairwise overlaps
  const overlaps: Record<string, string[]> = {};
  const tokens = Object.keys(holderSets);
  
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const key = `${tokens[i]}_${tokens[j]}`;
      const intersection = [...holderSets[tokens[i]]]
        .filter(addr => holderSets[tokens[j]].has(addr));
      overlaps[key] = intersection;
    }
  }
  
  return overlaps;
}
```

**Findings:**
- ✅ Can identify whales that appear across multiple tokens
- ✅ `holders` endpoint provides ordered list by holdings
- ⚠️ Limited to 50 holders per query; pagination available for more

### 2.3 Exchange vs Individual Wallet Identification

**Query: `filterWallets`**
- **Availability:** Growth and Enterprise plans
- **Capability:** Filter wallets by labels including exchange identification

```graphql
query FilterWallets($networkId: Int!, $labels: [WalletLabel!]) {
  filterWallets(input: {
    networkIds: [$networkId]
    labels: $labels
  }) {
    items {
      address
      labels
      stats {
        totalVolume
        totalTrades
      }
    }
  }
}
```

**Available Wallet Labels:**
- `WEALTHY_LOW`: Holds $1M+ in assets
- `WEALTHY_MEDIUM`: Holds $5M+ in assets  
- `WEALTHY_HIGH`: Holds $10M+ in assets
- `SNIPER`: Profits $3k+ from tokens bought within 1 hour of launch
- `EARLY_BIRD`: Profits $5k+ from tokens 1 hour to 2 days old
- `SECOND_WAVE`: Profits $7.5k+ from established tokens (2+ days old)
- `SCAMMER_OR_BOT`: Suspicious trading behavior

**Exchange Identification Strategy:**

Since Codex doesn't have a dedicated "exchange" label, use heuristics:

```typescript
// Known Solana exchange wallets
const KNOWN_EXCHANGES: Record<string, string[]> = {
  "Binance": ["5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"],
  "Coinbase": ["H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS"],
  "Kraken": ["..."],
  "OKX": ["..."],
};

function isExchangeWallet(address: string): string | null {
  for (const [exchange, addresses] of Object.entries(KNOWN_EXCHANGES)) {
    if (addresses.includes(address)) return exchange;
  }
  return null;
}

async function classifyTopHolders(tokenAddress: string) {
  const holders = await codex.holders({
    tokenAddress,
    networkId: 1399811149,
    limit: 100
  });
  
  return holders.items.map(h => ({
    ...h,
    exchange: isExchangeWallet(h.address),
    type: isExchangeWallet(h.address) ? 'exchange' : 'individual'
  }));
}
```

**Findings:**
- ⚠️ No built-in exchange wallet label
- ✅ Can maintain a known-exchange address list
- ✅ Can use wallet labels to identify whale behavior patterns
- 💡 Consider: High transaction volume + stable large balance = likely exchange

---

## 3. Wallet Activity Queries

### 3.1 Token Transfers In/Out

**Query: `getTokenEvents`**
- Filter by wallet address to see all transfers involving that wallet

```graphql
query GetWalletTransfers($tokenAddress: String!, $maker: String!, $networkId: Int!) {
  getTokenEvents(input: {
    tokenAddress: $tokenAddress
    networkId: $networkId
    maker: $maker
    limit: 200
  }) {
    items {
      timestamp
      transactionHash
      eventType  # buy, sell, transfer
      maker
      amount
      priceUsd
    }
    cursor
  }
}
```

### 3.2 Buy/Sell Activity Per Wallet

Use `getTokenEventsForMaker` to get all trading activity:

```typescript
interface WalletTradeActivity {
  totalBuys: number;
  totalSells: number;
  buyVolume: number;
  sellVolume: number;
  netPosition: number;
}

async function getWalletTradeActivity(
  walletAddress: string,
  tokenAddress: string
): Promise<WalletTradeActivity> {
  const events = await codex.getTokenEventsForMaker({
    maker: walletAddress,
    tokenAddress: tokenAddress,
    networkId: 1399811149,
    limit: 1000
  });
  
  let totalBuys = 0, totalSells = 0;
  let buyVolume = 0, sellVolume = 0;
  
  events.items.forEach(e => {
    if (e.eventType === 'buy') {
      totalBuys++;
      buyVolume += parseFloat(e.amount);
    } else if (e.eventType === 'sell') {
      totalSells++;
      sellVolume += parseFloat(e.amount);
    }
  });
  
  return {
    totalBuys,
    totalSells,
    buyVolume,
    sellVolume,
    netPosition: buyVolume - sellVolume
  };
}
```

### 3.3 First and Last Activity Timestamps

```typescript
async function getWalletActivityTimestamps(walletAddress: string) {
  // Get oldest events (ascending order)
  const oldestEvents = await codex.getTokenEventsForMaker({
    maker: walletAddress,
    networkId: 1399811149,
    limit: 1,
    // Sort by timestamp ascending
  });
  
  // Get newest events (descending order)  
  const newestEvents = await codex.getTokenEventsForMaker({
    maker: walletAddress,
    networkId: 1399811149,
    limit: 1,
    // Sort by timestamp descending
  });
  
  return {
    firstActivity: oldestEvents.items[0]?.timestamp,
    lastActivity: newestEvents.items[0]?.timestamp
  };
}
```

**Findings:**
- ✅ Can track all token transfers for a wallet
- ✅ Can compute buy/sell ratios
- ✅ Can determine first and last activity timestamps
- ⚠️ Note: Codex only tracks swap events, not direct transfers (per docs)

---

## 4. Cross-Token Holder Overlap Analysis

### 4.1 Find Wallets Holding Multiple Tokens

**Query Strategy: Intersection Approach**

```typescript
async function findMultiTokenHolders(tokenAddresses: string[]) {
  // Fetch all holders for each token
  const holderMaps: Map<string, Map<string, number>> = new Map();
  
  for (const token of tokenAddresses) {
    const holders = await codex.holders({
      tokenAddress: token,
      networkId: 1399811149,
      limit: 200  // Get more for better coverage
    });
    
    const map = new Map<string, number>();
    holders.items.forEach(h => {
      map.set(h.address, h.percentOwned);
    });
    holderMaps.set(token, map);
  }
  
  // Find wallets that appear in ALL token holder lists
  const firstToken = tokenAddresses[0];
  const candidates = [...(holderMaps.get(firstToken)?.keys() || [])];
  
  const multiHolders = candidates.filter(addr => 
    tokenAddresses.every(token => holderMaps.get(token)?.has(addr))
  );
  
  return multiHolders.map(addr => ({
    address: addr,
    holdings: Object.fromEntries(
      tokenAddresses.map(token => [token, holderMaps.get(token)?.get(addr)])
    )
  }));
}

// Example: Find wallets holding both META and JTO
const overlap = await findMultiTokenHolders([
  "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"
]);
```

### 4.2 Holder Overlap Matrix

**Strategy for Computing Overlap Percentage:**

```typescript
interface OverlapMatrix {
  tokens: string[];
  matrix: number[][];  // Percentage overlap
  rawCounts: number[][];
}

async function computeHolderOverlapMatrix(
  tokens: Record<string, string>  // {name: address}
): Promise<OverlapMatrix> {
  const tokenNames = Object.keys(tokens);
  const holderSets: Record<string, Set<string>> = {};
  const holderCounts: Record<string, number> = {};
  
  // Fetch all holders
  for (const [name, address] of Object.entries(tokens)) {
    const response = await codex.holders({
      tokenAddress: address,
      networkId: 1399811149,
      limit: 200
    });
    holderSets[name] = new Set(response.items.map(h => h.address));
    holderCounts[name] = response.count;  // Total holder count
  }
  
  // Build overlap matrix
  const n = tokenNames.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  const rawCounts: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 100;
        rawCounts[i][j] = holderSets[tokenNames[i]].size;
      } else {
        const intersection = [...holderSets[tokenNames[i]]]
          .filter(addr => holderSets[tokenNames[j]].has(addr));
        rawCounts[i][j] = intersection.length;
        // Percentage of token i holders who also hold token j
        matrix[i][j] = (intersection.length / holderSets[tokenNames[i]].size) * 100;
      }
    }
  }
  
  return { tokens: tokenNames, matrix, rawCounts };
}
```

**Example Output:**
```
          META    JTO     JUP     PYTH
META      100%    12%     8%      5%
JTO       15%     100%    22%     18%
JUP       3%      10%     100%    25%
PYTH      2%      8%      15%     100%
```

### 4.3 MetaDAO Token Holder Overlap

**Query: What percentage of META holders also hold other MetaDAO tokens?**

```typescript
const METADAO_TOKENS = {
  META: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
  FUTURE: "FUTURETnhzFApq2TiZiNbWLQDXMx4nWNpFtQCRKzEdvk",
  DEAN: "Ds52CDgqdWbTWsua1hgT3AuSSy4FNx2Sf6fDJVxEFSpa",
};

async function analyzeMetaDAOOverlap() {
  const metaHolders = await codex.holders({
    tokenAddress: METADAO_TOKENS.META,
    networkId: 1399811149,
    limit: 200
  });
  
  const metaAddresses = new Set(metaHolders.items.map(h => h.address));
  
  const results: Record<string, number> = {};
  
  for (const [name, address] of Object.entries(METADAO_TOKENS)) {
    if (name === 'META') continue;
    
    const otherHolders = await codex.holders({
      tokenAddress: address,
      networkId: 1399811149,
      limit: 200
    });
    
    const overlap = otherHolders.items.filter(h => metaAddresses.has(h.address));
    results[name] = (overlap.length / metaAddresses.size) * 100;
  }
  
  return results;  // { FUTURE: 45%, DEAN: 32% }
}
```

---

## 5. Plan Requirements Summary

| Feature | Free | Growth ($350/mo) | Enterprise |
|---------|------|------------------|------------|
| `holders` (top holders) | ❌ | ✅ | ✅ |
| `balances` (wallet holdings) | ❌ | ✅ | ✅ |
| `filterWallets` | ❌ | ✅ | ✅ |
| `getTokenEvents` | ✅ | ✅ | ✅ |
| `getTokenEventsForMaker` | ✅ | ✅ | ✅ |
| `walletChart` (PnL graphs) | ❌ | ✅ | ✅ |
| `onHoldersUpdated` (websocket) | ❌ | ❌ | ✅ |

**Recommendation:** Growth plan is required for comprehensive holder analytics.

---

## 6. Implementation Recommendations

### 6.1 Extend `CodexClient` Class

Add the following methods to `src/lib/api/codex.ts`:

```typescript
// New wallet analytics methods to add
export class CodexClient {
  // ... existing methods ...

  /** Get wallet token balances (Growth+ plan) */
  async getWalletBalances(walletAddress: string, networkId = 1399811149) {
    return this.query<{ balances: BalancesResponse }>(
      `query($address: String!, $networkId: Int!) {
        balances(input: { walletAddress: $address, networkId: $networkId }) {
          items {
            tokenAddress
            balance
            shiftedBalance
            usdValue
            tokenInfo { name symbol decimals }
          }
        }
      }`,
      { address: walletAddress, networkId }
    );
  }

  /** Get trading events for a specific wallet/maker */
  async getWalletTrades(
    walletAddress: string, 
    tokenAddress?: string,
    limit = 100,
    networkId = 1399811149
  ) {
    return this.query<{ getTokenEventsForMaker: TokenEventsResponse }>(
      `query($maker: String!, $tokenAddress: String, $networkId: Int!, $limit: Int) {
        getTokenEventsForMaker(input: {
          maker: $maker
          tokenAddress: $tokenAddress
          networkId: $networkId
          limit: $limit
        }) {
          items {
            timestamp
            transactionHash
            eventType
            tokenAddress
            amount
            priceUsd
          }
          cursor
        }
      }`,
      { maker: walletAddress, tokenAddress, networkId, limit }
    );
  }

  /** Filter wallets by labels (Growth+ plan) */
  async filterWallets(labels: string[], networkId = 1399811149) {
    return this.query<{ filterWallets: WalletFilterResponse }>(
      `query($networkIds: [Int!]!, $labels: [WalletLabel!]) {
        filterWallets(input: {
          networkIds: $networkIds
          labels: $labels
        }) {
          items {
            address
            labels
          }
        }
      }`,
      { networkIds: [networkId], labels }
    );
  }
}
```

### 6.2 Create Holder Overlap Analysis Module

Create `src/lib/analytics/holder-overlap.ts`:

```typescript
import { getCodexClient } from '../api/codex';

export interface OverlapResult {
  tokenA: string;
  tokenB: string;
  overlapCount: number;
  overlapPercentageOfA: number;
  overlapPercentageOfB: number;
  commonAddresses: string[];
}

export async function computeHolderOverlap(
  tokenAddresses: string[],
  limit = 100
): Promise<OverlapResult[]> {
  const client = getCodexClient();
  const results: OverlapResult[] = [];
  
  // Implementation...
  return results;
}
```

---

## 7. Limitations and Considerations

1. **Rate Limiting:** Codex has conservative rate limits. Use the existing `RateLimiter` class.

2. **Data Freshness:** Holder data is updated on swaps only, not direct transfers.

3. **Plan Costs:** Growth plan ($350/month) required for full wallet analytics.

4. **Pagination:** For >100 holders, use cursor-based pagination.

5. **Exchange Identification:** No built-in label; maintain known-addresses list.

6. **PnL Calculation:** Requires multiple API calls and manual computation.

---

## 8. Next Steps

1. [ ] Upgrade to Codex Growth plan for `holders` and `balances` access
2. [ ] Implement extended `CodexClient` methods
3. [ ] Build holder overlap matrix component
4. [ ] Create whale tracking dashboard
5. [ ] Set up exchange wallet database
6. [ ] Implement PnL calculation service

---

## References

- [Codex.io Documentation](https://docs.codex.io)
- [Codex Holders Endpoint](https://docs.codex.io/api-reference/queries/holders)
- [Codex Balances Endpoint](https://docs.codex.io/reference/balances)
- [Codex Wallet Recipes](https://docs.codex.io/recipes/wallets)
- [Codex FAQ - PnL Calculation](https://docs.codex.io/reference/frequently-asked-questions-faq)
- [Codex SDK (npm)](https://www.npmjs.com/package/@codex-data/sdk)
