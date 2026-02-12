# Codex.io Holder Time-Series API Research

**Date:** February 2026  
**Token Tested:** META (METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m)  
**Network:** Solana (networkId: 1399811149)

---

## Executive Summary

Codex.io provides **current-state** holder data but **does not offer historical holder time-series**. To build holder trend analysis (count over time, distribution changes, etc.), we must implement our own snapshot system.

---

## What IS Available

### 1. Token Info with Current Holder Count

```graphql
query($address: String!, $networkId: Int!) {
  token(input: { address: $address, networkId: $networkId }) {
    address
    name
    symbol
    totalSupply
    holderCount  # Current holder count only
  }
}
```

**Notes:**
- Returns real-time holder count
- No historical data, no delta/change fields
- Available on all plans

### 2. Top Holders List (`holders` query)

```graphql
query($address: String!, $networkId: Int!) {
  holders(input: { 
    tokenAddress: $address, 
    networkId: $networkId, 
    limit: 100 
  }) {
    count       # Total unique holders
    items {
      address
      balance
      percentOwned
    }
    cursor      # For pagination
  }
}
```

**Notes:**
- **Requires Growth or Enterprise plan**
- Returns wallets ordered by holdings descending
- Supports cursor-based pagination for fetching all holders
- No balance history or change fields per holder

### 3. Top 10 Holder Percentage

Available via `getTokenPrices`:

```graphql
getTokenPrices(inputs: [{ address: $address, networkId: $networkId }]) {
  top10HoldersPercent
}
```

### 4. Real-Time Holder Updates (`onHoldersUpdated`)

```graphql
subscription {
  onHoldersUpdated(input: { tokenAddress: $address, networkId: $networkId }) {
    count
    items {
      address
      balance
      percentOwned
    }
  }
}
```

**Notes:**
- **Enterprise plan only**
- Live-streams holder list changes
- Can also poll the `holders` endpoint as alternative

### 5. `filterTokens` with Holder Counts

```graphql
filterTokens(
  filters: { network: 1399811149 }
) {
  results {
    holders          # Current holder count
    token { info { address name symbol } }
  }
}
```

**Notes:**
- Useful for bulk queries across multiple tokens
- Still only current-state data

---

## What is NOT Available

| Feature | Status | Notes |
|---------|--------|-------|
| Holder count history | ❌ Not available | No `holderCountHistory` field |
| Holder count at timestamp | ❌ Not available | No `tokenHoldersAtTime` query |
| Daily holder snapshots | ❌ Not available | Must poll ourselves |
| New holders per day | ❌ Not available | No delta tracking |
| Exiting holders per day | ❌ Not available | Must compute from diffs |
| Holder balance changes | ❌ Not available | No `balanceChange24h` field |
| Balance distribution buckets | ❌ Not available | No `holderDistribution` query |
| Historical holder rankings | ❌ Not available | Rankings are real-time only |

### Tested Queries That Failed (Not in Schema)

- `holderCountHistory` - Does not exist
- `tokenStats` - Does not exist
- `filterTokenHolders` - Does not exist  
- `holderBalanceChanges` - Does not exist
- `tokenHoldersAtTime` - Does not exist
- `holderDistribution` - Does not exist
- `tokenAnalytics` - Does not exist

---

## Proposed Snapshot Strategy

Since Codex doesn't provide historical holder data, we need to build our own snapshot system.

### Data to Capture Per Snapshot

```typescript
interface HolderSnapshot {
  tokenAddress: string;
  networkId: number;
  timestamp: number;
  
  // Aggregate metrics
  totalHolders: number;
  top10HoldersPercent: number;
  
  // Top holder balances (for concentration tracking)
  topHolders: Array<{
    address: string;
    balance: string;
    percentOwned: number;
    rank: number;
  }>;
  
  // Distribution buckets (computed locally)
  distribution: {
    whales: number;      // >1% of supply
    large: number;       // 0.1-1%
    medium: number;      // 0.01-0.1%
    small: number;       // <0.01%
  };
}
```

### Polling Frequency Recommendations

| Metric | Frequency | Rationale |
|--------|-----------|-----------|
| Total holder count | Every 4 hours | Changes slowly, high API cost |
| Top 100 holders | Daily | Concentration analysis |
| Full holder list | Weekly | For Gini/distribution calcs |

### Estimated API Usage

For 10 tokens with the above strategy:
- Holder count: 10 × 6/day = 60 requests/day
- Top 100 holders: 10 × 1/day = 10 requests/day  
- Full holder list: 10 × ~5 pages × 1/week = ~7 requests/day avg

**Total: ~77 requests/day** (well under free tier limits)

### Storage Schema Suggestion

```sql
CREATE TABLE holder_snapshots (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(44) NOT NULL,
  network_id INTEGER NOT NULL,
  snapshot_at TIMESTAMP NOT NULL,
  total_holders INTEGER NOT NULL,
  top10_percent DECIMAL(5,2),
  gini_coefficient DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(token_address, network_id, snapshot_at)
);

CREATE TABLE holder_balances (
  id SERIAL PRIMARY KEY,
  snapshot_id INTEGER REFERENCES holder_snapshots(id),
  holder_address VARCHAR(44) NOT NULL,
  balance NUMERIC(78,0) NOT NULL,
  percent_owned DECIMAL(10,6),
  rank INTEGER
);
```

### Computing Derived Metrics

From snapshots, we can compute:

1. **Holder count trend**: `holders[t] - holders[t-1]`
2. **Net new holders per day**: Requires set difference between snapshots
3. **Concentration changes**: Track top10% over time
4. **Gini coefficient trend**: Compute from full holder distribution
5. **Whale movements**: Track large balance changes in top holders

---

## Implementation Recommendations

### Phase 1: Basic Snapshots (Week 1)
- Set up cron job for 4-hourly holder count polling
- Store in simple database table
- Display holder count trend chart

### Phase 2: Distribution Analysis (Week 2)
- Add daily top-100 holder snapshots
- Compute and store Gini coefficient
- Add concentration trend visualization

### Phase 3: Advanced Analytics (Week 3+)
- Weekly full holder list capture
- New/exiting holder computation
- Whale wallet tracking alerts

---

## Alternative Data Sources

If Codex holder data is insufficient, consider:

1. **Helius** (Solana-specific)
   - Has `getTokenAccounts` with balance history on some plans
   - More Solana-native, may have better coverage

2. **SolanaFM**
   - Token holder analytics
   - May have historical data

3. **Direct RPC**
   - Use `getTokenLargestAccounts` for snapshots
   - No rate limiting concerns with own node
   - Full control over data collection

---

## Cost Analysis

| Plan | Price | Holder Access | Notes |
|------|-------|---------------|-------|
| Free | $0 | ❌ No | Limited endpoints |
| Growth | $350/mo | ✅ Yes | `holders` query |
| Enterprise | Custom | ✅ Yes + WS | `onHoldersUpdated` subscription |

For our use case, **Growth plan is sufficient** since:
- We're polling, not streaming
- We only need hourly/daily snapshots
- WebSocket holder updates aren't necessary

---

## Conclusion

Codex.io is a reliable source for **real-time holder data** but lacks any historical time-series capabilities. To build holder trend analytics, we must:

1. **Poll regularly** using the `holders` and `token { holderCount }` queries
2. **Store snapshots** in our own database
3. **Compute trends** from the delta between snapshots

This approach gives us full control over data granularity and retention while staying within reasonable API usage limits.
