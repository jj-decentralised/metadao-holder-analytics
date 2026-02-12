# CoinGecko API Data Depth & Coverage Research

**Date:** February 12, 2026
**Purpose:** Evaluate CoinGecko API suitability for MetaDAO holder analytics

## Executive Summary

| Feature | Availability | Notes |
|---------|-------------|-------|
| META price data | ✅ Available | ~180 days history (since Aug 2025) |
| META OHLCV | ✅ Available | 4-hour candles for 30 days |
| FUTURE/DEAN tokens | ❌ Not listed | Too small/new for CoinGecko |
| Holder data | ⚠️ Paid only | Requires Analyst plan ($129/mo) |
| Free tier rate limit | 5-15 calls/min | 10,000 calls/month cap |

## 1. MetaDAO (META) Token Data

### Token Identification
- **CoinGecko ID:** `meta-2-2` (NOT `meta-dao`)
- **Contract Address:** `METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta`
- **Platform:** Solana

### Search Endpoint
```
GET https://api.coingecko.com/api/v3/search?query=metadao
```

**Response:**
```json
{
  "coins": [
    {
      "id": "meta-2-2",
      "symbol": "META",
      "name": "MetaDAO"
    }
  ]
}
```

### Market Chart Data (365 days requested)
```
GET https://api.coingecko.com/api/v3/coins/meta-2-2/market_chart?vs_currency=usd&days=365
```

**Actual Results:**
- **Data points returned:** 182 (daily granularity)
- **Earliest date with data:** August 16, 2025
- **Latest date:** February 12, 2026 (real-time)
- **Total coverage:** ~180 days (NOT 365 days requested)

**Sample Price Data:**
```
First prices:
  2025-08-16: $0.805421
  2025-08-17: $0.805421
  2025-08-18: $0.727515

Latest prices:
  2026-02-11: $3.738098
  2026-02-12: $3.737236
  2026-02-12 19:43: $3.416082 (intraday)
```

**Volume Data Quality:**
- ✅ Consistent daily volume data
- ✅ Same number of data points as price
- Sample: $824,501 - $883,272 (24h volume range)

### OHLCV Data
```
GET https://api.coingecko.com/api/v3/coins/meta-2-2/ohlc?vs_currency=usd&days=30
```

**Results:**
- **Data points:** 180 (4-hour candles)
- **Granularity:** 4-hour intervals for 30-day request
- **Format:** `[timestamp, open, high, low, close]`

**Sample:**
```
2026-01-13 20:00: O=6.20 H=6.20 L=5.94 C=6.04
2026-01-14 00:00: O=6.05 H=6.15 L=5.89 C=5.99
...
2026-02-12 16:00: O=3.76 H=3.76 L=3.59 C=3.60
```

### Historical Snapshot
```
GET https://api.coingecko.com/api/v3/coins/meta-2-2/history?date=01-01-2026
```

**Results:** ✅ Works on free tier
```json
{
  "name": "MetaDAO",
  "market_data": {
    "current_price": { "usd": 7.15 },
    "market_cap": { "usd": 158699225 },
    "total_volume": { "usd": 2144758 }
  }
}
```

### Full Coin Data (includes community metrics)
```
GET https://api.coingecko.com/api/v3/coins/meta-2-2?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true
```

**Current Market Data:**
- Current Price: $3.42
- Market Cap: $77,495,757
- FDV: $77,495,757
- 24h Volume: $845,468
- Circulating Supply: 22,684,699
- Total Supply: 22,684,699

**Community Data (sparse):**
```json
{
  "facebook_likes": null,
  "reddit_average_posts_48h": 0.0,
  "reddit_average_comments_48h": 0.0,
  "reddit_subscribers": 0,
  "telegram_channel_user_count": null
}
```

**Developer Data (minimal):**
```json
{
  "forks": 0,
  "stars": 0,
  "subscribers": 0,
  "total_issues": 0,
  "commit_count_4_weeks": 0
}
```

**Tickers (18 exchanges):**
- LBank: META/USDT - $561,363 vol
- Meteora (DEX): META/USDC - $32,199 vol
- Orca (DEX): META/USDC - $3,130 vol

## 2. Small Token Coverage (FUTURE, DEAN)

### Search Results

| Token | Search Query | Result |
|-------|-------------|--------|
| FUTURE | `future` | ❌ Not found (different "Future Protocol" listed) |
| FUTURE | `FUTRWZXpssdzTBjhemiDNxqs` | ❌ No results |
| DEAN | `dean` | ❌ No results |
| DEAN | `dean_s_list` | ❌ No results |

**Conclusion:** FUTURE and DEAN tokens are NOT on CoinGecko. They're likely too small in market cap or too new to be listed.

### CoinGecko Listing Requirements
- Minimum market cap not publicly specified
- Must have trading activity on tracked exchanges
- Verification process required

### Alternative for Unlisted Tokens
For tokens not on CoinGecko main API, use **GeckoTerminal** (on-chain DEX data):
- Can query by contract address
- Covers any token with DEX pools
- **Requires paid API plan** for CoinGecko API access
- Direct GeckoTerminal API access may be limited

## 3. Historical Endpoints Analysis

### /coins/{id}/market_chart
```
GET /coins/meta-2-2/market_chart?vs_currency=usd&days={days}
```

| Days Param | Granularity | Free Tier |
|-----------|-------------|-----------|
| 1 | 5-minute | ✅ |
| 2-90 | Hourly | ✅ |
| 91-365 | Daily | ✅ |
| max | Daily (full history) | ❌ 401 Unauthorized |

### /coins/{id}/market_chart/range
```
GET /coins/meta-2-2/market_chart/range?vs_currency=usd&from={unix}&to={unix}
```
- **Free tier:** Tested with Sept-Oct 2025 range
- **Result:** 429 Too Many Requests (rate limited during testing)
- Allows custom date ranges when not rate limited

### /coins/{id}/history
```
GET /coins/meta-2-2/history?date=DD-MM-YYYY
```
- ✅ **Works on free tier**
- Returns snapshot for specific date
- Includes price, market cap, volume
- Date format: `DD-MM-YYYY`

## 4. Holder-Related Endpoints

### Does CoinGecko Provide Holder Data?

**Short answer:** Yes, but **PAID PLANS ONLY** (Analyst plan $129/mo+)

### Available Holder Endpoints (Paid)

1. **Token Info by Token Address** (includes holder count)
   ```
   GET /onchain/networks/{network}/tokens/{address}
   ```
   - Holder count
   - Distribution percentage
   - GT Score (GeckoTerminal score)

2. **Token Holders by Token Address** (top holders)
   ```
   GET /onchain/networks/{network}/tokens/{address}/holders
   ```
   - Top 50 holder addresses (40 for Solana)
   - Amount owned
   - Percentage of supply
   - Value in USD

3. **Historical Token Holder Chart**
   ```
   GET /onchain/networks/{network}/tokens/{address}/holders/chart
   ```
   - Historical holder count over time
   - 30-day chart data

### Free Tier Alternatives
- ❌ No direct holder data on free tier
- Community data (Reddit, Twitter, Telegram) available but sparse for META
- Must use Solana RPC or on-chain indexers directly

## 5. Rate Limits & Pricing

### Free Tier (Demo Plan)
| Metric | Limit |
|--------|-------|
| Rate Limit | 5-15 calls/min (dynamic) |
| Stable Rate | 30 calls/min (with Demo API key) |
| Monthly Cap | 10,000 calls |
| Data Update | 1-5 minute cache |
| WebSocket | ❌ Not available |

### Paid Plans

| Plan | Price | Rate Limit | Monthly Calls |
|------|-------|------------|---------------|
| Analyst | $129/mo | 500/min | 500,000 |
| Lite | ~$199/mo | 500/min | 1,000,000 |
| Pro | $499/mo | 500/min | 2,000,000 |
| Enterprise | $999+/mo | 1,000/min | Custom |

### Paid Plan Exclusive Features
- `days=max` for full historical data
- On-chain DEX data endpoints
- Top holder addresses
- Holder distribution data
- Historical holder charts
- WebSocket streaming (higher tiers)
- 30-second cache (vs 1-5 min free)

## 6. Useful Endpoints Summary

### Free Tier Endpoints for Our Use Case

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `/search` | Find token IDs | `?query=metadao` |
| `/coins/{id}` | Full coin data + community | `meta-2-2` |
| `/coins/{id}/market_chart` | Price/volume history | `?days=365` |
| `/coins/{id}/ohlc` | Candlestick data | `?days=30` |
| `/coins/{id}/history` | Daily snapshot | `?date=01-01-2026` |
| `/coins/{id}/tickers` | Exchange pairs | Trading pairs |
| `/coins/markets` | Bulk market data | Top coins by mcap |

### Paid Tier Endpoints (Holder Data)

| Endpoint | Purpose | Plan Required |
|----------|---------|---------------|
| `/onchain/networks/{net}/tokens/{addr}` | Token info + holder count | Analyst+ |
| `/onchain/networks/{net}/tokens/{addr}/holders` | Top holder addresses | Analyst+ |
| `/onchain/networks/{net}/tokens/{addr}/holders/chart` | Historical holder chart | Analyst+ |
| `/coins/{id}/market_chart?days=max` | Full price history | Analyst+ |
| `/coins/{id}/market_chart/range` | Custom date range | Works on free but limited |

## 7. Recommendations for MetaDAO Analytics

### What CoinGecko CAN Provide (Free)
1. META token price history (~180 days)
2. Daily volume data
3. 4-hour OHLCV candles (30 days)
4. Exchange/DEX trading pairs
5. Basic market metrics (mcap, supply, FDV)
6. Historical daily snapshots

### What CoinGecko CANNOT Provide (Free)
1. ❌ FUTURE and DEAN token data (not listed)
2. ❌ Holder counts or distribution
3. ❌ Top holder addresses
4. ❌ Full historical data (>365 days)
5. ❌ Real-time streaming data

### Alternative Data Sources Needed
1. **For holder data:** Use Solana RPC directly (getProgramAccounts) or Helius/Shyft
2. **For unlisted tokens:** Use DEX APIs (Jupiter, Raydium) or on-chain indexers
3. **For real-time:** WebSocket to Solana RPCs or exchange APIs

### Cost Analysis
| Approach | Monthly Cost | Coverage |
|----------|-------------|----------|
| CoinGecko Free | $0 | META only, no holders |
| CoinGecko Analyst | $129 | META + holders, still no FUTURE/DEAN |
| Helius (Solana RPC) | $49+ | All tokens, full holder data |
| Custom indexer | ~$50-200 | Full control |

**Recommendation:** For comprehensive holder analytics including unlisted tokens, supplement CoinGecko free tier with direct Solana RPC/indexer solutions.
