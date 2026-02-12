# Codex.io Historical Trading Bar Data for Solana Tokens

> Research documentation for Codex.io's `getBars` and related APIs for fetching OHLCV data.

## Overview

Codex.io provides a GraphQL API for fetching historical trading bar (OHLCV) data for tokens across multiple blockchain networks including Solana. This document covers the `getBars` query which is the primary method for fetching candlestick/bar chart data.

**API Endpoint:** `https://graph.codex.io/graphql`

**Solana Network ID:** `1399811149`

## Authentication

Codex.io requires API authentication for all queries. An API key must be provided in the `Authorization` header.

```typescript
const headers = {
  "Content-Type": "application/json",
  "Authorization": "YOUR_API_KEY"
};
```

**Note:** Without an API key, all queries return `400: Bad Request`.

## getBars vs getTokenBars

There are two approaches for fetching bar data:

| Mode | Use Case | Symbol Format |
|------|----------|---------------|
| **POOL (default)** | Price data for a specific trading pair | `{pairAddress}:{networkId}` |
| **TOKEN** | Aggregate price data across all trading pairs (weighted by liquidity) | `{tokenAddress}:{networkId}` |

The `symbolType` parameter controls this behavior:
- `symbolType: POOL` (default) - Use pair address
- `symbolType: TOKEN` - Use token address for aggregated data

## Bar Data Fields

Each bar returned contains:

| Field | Type | Description |
|-------|------|-------------|
| `o` | Float | Open price (USD) |
| `h` | Float | High price (USD) |
| `l` | Float | Low price (USD) |
| `c` | Float | Close price (USD) |
| `t` | Int | Unix timestamp (seconds) |
| `volume` | String | Trading volume in USD (high precision string) |
| `s` | String | Status: `"ok"` for successful data, `"no_data"` for empty responses |

**Important:** Use `volume` instead of `v`. The `v` field is deprecated due to integer overflow issues with large volumes.

## Available Resolutions

The following time resolutions are supported:

| Resolution | Description |
|------------|-------------|
| `"1"` | 1 minute |
| `"5"` | 5 minutes |
| `"15"` | 15 minutes |
| `"30"` | 30 minutes |
| `"60"` | 1 hour |
| `"240"` | 4 hours |
| `"720"` | 12 hours |
| `"1D"` | 1 day |
| `"7D"` | 7 days |

**Note:** Resolutions under 1 minute are not supported and may return incorrect values.

## Query Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `symbol` | String | Format: `{address}:{networkId}` |
| `resolution` | String | Time resolution (see above) |
| `from` | Int | Start timestamp (Unix seconds) |
| `to` | Int | End timestamp (Unix seconds) |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbolType` | Enum | `POOL` | `POOL` or `TOKEN` |
| `quoteToken` | Enum | auto | `token0` or `token1` - which token is the quote |
| `removeLeadingNullValues` | Boolean | false | Skip bars with null values at start |
| `countback` | Int | - | Max number of bars to return (max 1500) |

## Maximum Historical Range

- **Maximum bars per request:** 1500 (using `countback: 1500`)
- **Historical depth:** Varies by token - data available from when trading began
- **Tip:** Use `from: 0` with `countback: 1500` to fetch maximum available history

## Example Queries

### 1. Fetch Bars for a Specific Pair (POOL mode)

```graphql
query GetPairBars($symbol: String!, $from: Int!, $to: Int!) {
  getBars(
    symbol: $symbol
    resolution: "1D"
    from: $from
    to: $to
  ) {
    o
    h
    l
    c
    t
    volume
    s
  }
}
```

Variables:
```json
{
  "symbol": "PAIR_ADDRESS:1399811149",
  "from": 1704067200,
  "to": 1706745600
}
```

### 2. Fetch Aggregate Token Bars (TOKEN mode)

```graphql
query GetTokenBars($symbol: String!, $from: Int!, $to: Int!) {
  getBars(
    symbol: $symbol
    resolution: "1D"
    from: $from
    to: $to
    symbolType: TOKEN
  ) {
    o
    h
    l
    c
    t
    volume
    s
  }
}
```

Variables:
```json
{
  "symbol": "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m:1399811149",
  "from": 1704067200,
  "to": 1706745600
}
```

### 3. Practical Example: 30 Days of Daily META Bars

```graphql
query Get30DayMetaBars {
  getBars(
    symbol: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m:1399811149"
    resolution: "1D"
    from: 1736640000
    to: 1739232000
    symbolType: TOKEN
    removeLeadingNullValues: true
  ) {
    o
    h
    l
    c
    t
    volume
    s
  }
}
```

### 4. Finding Pairs for a Token

Before using POOL mode, you need to find the pair address:

```graphql
query FilterPairs($tokenAddress: String!, $networkId: Int!) {
  filterPairs(
    filters: { tokenAddress: $tokenAddress, network: [$networkId] }
    limit: 10
    rankings: { attribute: liquidity, direction: DESC }
  ) {
    results {
      pair {
        address
        token0
        token1
      }
      exchange { name }
    }
  }
}
```

## Example Response Format

```json
{
  "data": {
    "getBars": [
      {
        "o": 15.2341,
        "h": 16.8923,
        "l": 14.9012,
        "c": 16.5432,
        "t": 1704067200,
        "volume": "1234567.89",
        "s": "ok"
      },
      {
        "o": 16.5432,
        "h": 17.1234,
        "l": 15.8901,
        "c": 16.9876,
        "t": 1704153600,
        "volume": "987654.32",
        "s": "ok"
      }
    ]
  }
}
```

## Volume Data

### Volume in USD

The `volume` field returns trading volume in USD as a high-precision string to avoid integer overflow.

### Volume Breakdown

Codex does not provide buyer vs seller volume breakdown directly in the `getBars` query. For detailed trade-level data including buy/sell direction, use `getTokenEvents` or `getDetailedPairStats`.

### Aggregate vs Pair Volume

- **POOL mode:** Volume for that specific pair only
- **TOKEN mode:** Aggregate volume across all pairs for the token

## Rate Limits

Codex.io pricing and rate limits:

- **Starter plan:** $350/month for 1M requests
- **Growth plan:** Up to 10M monthly requests
- **Enterprise:** Custom plans available

Each API call counts as one request. WebSocket subscriptions may have different pricing arrangements.

## Real-Time Updates

For real-time chart updates, combine `getBars` with WebSocket subscription:

```graphql
subscription OnBarsUpdated($pairId: String) {
  onBarsUpdated(pairId: $pairId, quoteToken: token1) {
    networkId
    pairAddress
    timestamp
    aggregates {
      r1 {  # 1-minute resolution
        t
        usd { o h l c volume }
      }
      r1D { # Daily resolution
        t
        usd { o h l c volume }
      }
    }
  }
}
```

## TypeScript Implementation

See `scripts/test-codex-bars.ts` for a complete TypeScript implementation example.

Basic client structure:

```typescript
const CODEX_URL = "https://graph.codex.io/graphql";
const SOLANA_NETWORK_ID = 1399811149;

async function getBars(
  tokenAddress: string,
  resolution: string,
  from: number,
  to: number
): Promise<Bar[]> {
  const symbol = `${tokenAddress}:${SOLANA_NETWORK_ID}`;
  
  const response = await fetch(CODEX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": process.env.CODEX_API_KEY || ""
    },
    body: JSON.stringify({
      query: `
        query GetBars($symbol: String!, $resolution: String!, $from: Int!, $to: Int!) {
          getBars(
            symbol: $symbol
            resolution: $resolution
            from: $from
            to: $to
            symbolType: TOKEN
          ) {
            o h l c t volume s
          }
        }
      `,
      variables: { symbol, resolution, from, to }
    })
  });
  
  const json = await response.json();
  return json.data?.getBars ?? [];
}
```

## Test Tokens

| Token | Address |
|-------|---------|
| META | `METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m` |
| JTO | `jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL` |
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` |

## Common Issues

1. **400 Bad Request:** API key is missing or invalid
2. **Missing data at token launch:** Codex only indexes tokens after trading begins
3. **Incorrect base token:** Use `quoteToken: token0` or `token1` to specify quote token, or omit to auto-detect
4. **Large volume overflow:** Always use `volume` (string) instead of `v` (deprecated integer)

## References

- [Codex.io Documentation](https://docs.codex.io)
- [getBars API Reference](https://docs.codex.io/api-reference/queries/getbars)
- [Chart Data Overview](https://docs.codex.io/reference/getbars)
- [Real-time WebSockets](https://docs.codex.io/reference/onbarsupdated)
