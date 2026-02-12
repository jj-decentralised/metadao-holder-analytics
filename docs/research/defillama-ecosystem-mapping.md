# DeFiLlama Solana Ecosystem Mapping for Token Enrichment

## Overview

This document provides a comprehensive analysis of DeFiLlama's API capabilities for enriching our token analytics with ecosystem-level data. DeFiLlama aggregates TVL, fees, revenue, yields, and stablecoin data across 100+ chains and thousands of protocols.

## 1. DeFiLlama API Exploration

### Base URLs

| API Domain | Base URL | Purpose |
|------------|----------|---------|
| Main API | `https://api.llama.fi` | TVL data, protocols |
| Pro API | `https://pro-api.llama.fi` | Advanced endpoints (requires API key) |
| Coins API | `https://coins.llama.fi` | Token prices |
| Stablecoins API | `https://stablecoins.llama.fi` | Stablecoin data |
| Yields API | `https://yields.llama.fi` | Yield farming data |

### Core Free Endpoints

#### GET /protocols
Lists all protocols with current TVL.

```json
{
  "id": "2269",
  "name": "Protocol Name",
  "symbol": "TOKEN",
  "category": "Lending",
  "chains": ["Solana", "Ethereum"],
  "tvl": 1500000000,
  "change_1h": 0.5,
  "change_1d": 2.3,
  "change_7d": -1.2,
  "mcap": 1500000000
}
```

**Solana Protocol Count**: Based on DeFiLlama data, there are **200+ Solana protocols** tracked with TVL data.

**Filtering for Solana**: Filter by checking if `"Solana"` is in the `chains` array.

#### GET /protocol/{slug}
Detailed protocol data including historical TVL.

**Response fields relevant for token enrichment:**
- `name`, `symbol`, `category`, `description`
- `chains[]` - Which chains the protocol operates on
- `tvl[]` - Historical TVL timeseries
- `chainTvls` - TVL breakdown by chain
- `currentChainTvls` - Current TVL per chain
- `mcap` - Market cap if token exists
- `raises[]` - Funding rounds with date, amount, round type
- `twitter`, `url`, `logo` - Social/branding data

#### GET /tvl/{protocol}
Simple current TVL for a protocol (number only).

#### GET /v2/historicalChainTvl/{chain}
Historical TVL for a specific chain (e.g., `Solana`).

#### GET /charts/{chain}
TVL charts data for a chain.

#### GET /chains
List all chains with current TVL.

### Metadata Per Protocol

DeFiLlama provides rich metadata:

| Field | Description | Data Quality |
|-------|-------------|--------------|
| `name` | Protocol name | ✅ High |
| `symbol` | Token symbol | ✅ High (if token exists) |
| `category` | DEX, Lending, etc. | ✅ High |
| `chains[]` | Supported chains | ✅ High |
| `tvl` | Current TVL | ✅ High (hourly updates) |
| `mcap` | Market cap | ⚠️ Medium (not always available) |
| `raises[]` | Funding rounds | ⚠️ Medium (community-submitted) |
| `description` | Protocol description | ✅ High |
| `twitter` | Twitter handle | ✅ High |
| `gecko_id` | CoinGecko ID | ⚠️ Medium |

## 2. Protocol-to-Token Mapping

### Our Tracked Tokens → DeFiLlama Protocols

| Token | Symbol | DeFiLlama Slug | Has Protocol Page |
|-------|--------|----------------|-------------------|
| Jito | JTO | `jito` | ✅ Yes |
| Jupiter | JUP | `jupiter` | ✅ Yes |
| Raydium | RAY | `raydium` | ✅ Yes |
| Orca | ORCA | `orca` | ✅ Yes |
| Pyth | PYTH | `pyth-network` | ✅ Yes |
| MetaDAO | META | `metadao` | ⚠️ May not exist |
| Helium | HNT | `helium` | ✅ Yes |
| Tensor | TNSR | `tensor` | ✅ Yes |
| Wormhole | W | `wormhole` | ✅ Yes |
| Render | RENDER | N/A (not DeFi) | ❌ No |
| Bonk | BONK | N/A (meme token) | ❌ No |

### Token Discovery Opportunities

DeFiLlama can help discover:

1. **New Solana DeFi protocols** - Filter `/protocols` by Solana chain
2. **Protocols with tokens** - Check `symbol` field is non-null
3. **High-TVL protocols without tokens** - Potential airdrop candidates
4. **Recently launched protocols** - Sort by TVL growth

### Protocol Categories on Solana

Based on DeFiLlama categorization:
- **DEXes**: Jupiter, Raydium, Orca, Lifinity
- **Liquid Staking**: Marinade, Jito, Sanctum
- **Lending**: Marginfi, Kamino, Solend
- **Derivatives**: Drift, Zeta Markets
- **Yield Aggregators**: Meteora, Kamino
- **NFT**: Tensor, Magic Eden

## 3. Yield/Revenue Data

### Fees & Revenue Endpoints

#### GET /overview/fees
Protocol fees aggregated data.

#### GET /overview/fees/{chain}
Fees data filtered by chain (e.g., `/overview/fees/Solana`).

**Response structure:**
```json
{
  "protocols": [{
    "name": "Protocol Name",
    "slug": "protocol-slug",
    "fees24h": 234567,
    "fees7d": 1645234,
    "fees30d": 6500000,
    "revenue24h": 123456,
    "revenue7d": 864192,
    "mcap": 1500000000
  }]
}
```

### Top Solana Fee Generators (indicative)

1. **Pump.fun** - ~$2.8M daily fees
2. **Raydium** - High volume DEX
3. **Jupiter** - ~$1.1M daily fees
4. **Jito** - MEV infrastructure

### Revenue vs Token Performance Correlation

Potential analysis opportunities:
- **P/F Ratio**: Protocol mcap / 30d fees (DeFiLlama provides this)
- **Revenue trends** vs token price trends
- **Fee growth** as leading indicator for token appreciation

### Yields API (Pro Tier - 🔒)

**GET /yields/pools** - Requires API key

Returns yield pools with:
```json
{
  "pool": "uuid",
  "chain": "Solana",
  "project": "raydium",
  "symbol": "SOL-USDC",
  "tvlUsd": 50000000,
  "apy": 15.5,
  "apyBase": 10.5,
  "apyReward": 5.0,
  "rewardTokens": ["RAY"],
  "il7d": 0.5
}
```

**Free Alternative**: Scrape from https://defillama.com/yields?chain=Solana

## 4. Chain-Level Data

### Solana TVL Trends

**Endpoint**: `GET /v2/historicalChainTvl/Solana`

Returns daily TVL snapshots for Solana ecosystem.

### Available Metrics

| Metric | Endpoint | Update Frequency |
|--------|----------|------------------|
| Chain TVL | `/v2/historicalChainTvl/Solana` | Hourly |
| Protocol Rankings | `/protocols` filtered | Hourly |
| DEX Volume | `/overview/dexs/Solana` | Daily |
| Fees/Revenue | `/overview/fees/Solana` | Daily |

### Protocol Dominance Analysis

Can calculate from `/protocols`:
- Top 10 protocols as % of total Solana TVL
- Category breakdown (DEX vs Lending vs LST)
- New entrants by filtering for recent TVL growth

### New Protocol Launches

No direct "launch date" field, but can infer from:
1. First appearance in historical TVL data
2. `raises[]` array with dates
3. TVL going from 0 to non-zero

## 5. Stablecoin and Flow Data

### Stablecoin Endpoints

#### GET /stablecoins
Lists all stablecoins with circulating amounts per chain.

```json
{
  "id": "1",
  "name": "Tether",
  "symbol": "USDT",
  "gecko_id": "tether",
  "pegType": "peggedUSD",
  "pegMechanism": "fiat-backed",
  "circulating": {
    "peggedUSD": 120000000000
  },
  "chains": ["Solana", "Ethereum", "Tron", ...]
}
```

#### GET /stablecoincharts/{chain}
Historical stablecoin supply on a specific chain.

**For Solana**: `GET /stablecoincharts/Solana`

#### GET /stablecoin/{stablecoinId}
Detailed stablecoin data with chain breakdown.

### Capital Flow Indicators

Stablecoin data can indicate:

1. **Capital Inflows**: Increasing stablecoin supply on Solana
2. **Capital Outflows**: Decreasing stablecoin supply
3. **Relative positioning**: Solana stablecoin share vs other chains

### Key Stablecoins on Solana

| Stablecoin | Symbol | Primary Use |
|------------|--------|-------------|
| USDC | USDC | Primary trading pair |
| USDT | USDT | Secondary trading |
| PYUSD | PYUSD | PayPal native |
| UXD | UXD | Native Solana algo-stable |

### Bridge Flow Data

**Endpoint**: `/bridges` endpoints (Pro API)

Can track cross-chain flows to/from Solana via:
- Wormhole bridge volume
- Portal bridge volume
- Native bridge inflows

## 6. Data Quality Assessment

### Strengths

| Aspect | Quality | Notes |
|--------|---------|-------|
| TVL Accuracy | ✅ Excellent | On-chain verification, hourly updates |
| Protocol Coverage | ✅ Excellent | 200+ Solana protocols |
| Historical Data | ✅ Excellent | Multi-year history available |
| Fee/Revenue | ✅ Good | Daily updates, protocol-specific adapters |
| API Reliability | ✅ Good | High uptime, reasonable rate limits |

### Limitations

| Aspect | Quality | Notes |
|--------|---------|-------|
| Token Discovery | ⚠️ Limited | Only DeFi protocols, not all tokens |
| Real-time Data | ⚠️ Limited | Hourly updates, not real-time |
| Yield Data | ⚠️ Pro-only | Free tier limited |
| mcap Data | ⚠️ Incomplete | Not all protocols have mcap |
| Raises/Funding | ⚠️ Community | User-submitted, may be incomplete |

### Rate Limits

- Free tier: ~300 requests/5 minutes
- Pro tier: 1000 requests/minute
- Recommendation: Implement local caching with 1-hour TTL

## 7. Implementation Recommendations

### Immediate Integration (Free Tier)

1. **Enhance token metadata**
   - Add DeFiLlama slug to TokenMetadata type
   - Fetch protocol data for matched tokens
   - Display TVL alongside holder metrics

2. **Protocol discovery**
   - Periodic fetch of `/protocols` filtered by Solana
   - Cross-reference with our token list
   - Alert on new high-TVL protocols

3. **Chain health indicators**
   - Track Solana TVL trends
   - Compare protocol rankings over time

### Future Integration (Pro Tier)

1. **Yield analytics**
   - Compare staking yields across protocols
   - Track APY trends for our tokens

2. **Fee/Revenue correlation**
   - Build P/F ratio analytics
   - Correlate fee growth with token performance

3. **Capital flow analysis**
   - Stablecoin inflow/outflow dashboard
   - Bridge volume monitoring

### Code Changes Required

```typescript
// src/data/tokens.ts - Add DeFiLlama slugs
export const METADAO_TOKENS: TokenMetadata[] = [
  {
    id: "meta",
    // ... existing fields
    defillamaSlug: "metadao", // NEW
  },
];

// src/lib/api/defillama.ts - Add new methods
async getSolanaProtocols(): Promise<Protocol[]> {
  const all = await this.listProtocols();
  return all.filter(p => p.chains?.includes("Solana"));
}

async getProtocolFees(slug: string): Promise<FeeData> {
  return this.fetch(`${LLAMA_API}/summary/fees/${slug}`);
}

async getSolanaStablecoins(): Promise<StablecoinData> {
  return this.fetch(`${STABLECOINS_API}/stablecoincharts/Solana`);
}
```

## 8. Summary of Useful Endpoints

### Free Tier Endpoints

| Endpoint | Use Case | Priority |
|----------|----------|----------|
| `GET /protocols` | Protocol discovery | High |
| `GET /protocol/{slug}` | Token enrichment | High |
| `GET /v2/historicalChainTvl/Solana` | Ecosystem health | Medium |
| `GET /stablecoincharts/Solana` | Capital flows | Medium |
| `GET /overview/fees/Solana` | Fee rankings | Medium |
| `GET /chains` | Cross-chain comparison | Low |

### Pro Tier Endpoints (Future)

| Endpoint | Use Case | Value |
|----------|----------|-------|
| `GET /yields/pools` | Yield comparison | High |
| `GET /api/inflows/{protocol}` | Capital flow analysis | High |
| `GET /yields/chart/{pool}` | Historical APY | Medium |

## Appendix: Response Shape Reference

### Protocol Object (Full)
```json
{
  "id": "123",
  "name": "Jupiter",
  "symbol": "JUP",
  "slug": "jupiter",
  "category": "Dexes",
  "chains": ["Solana"],
  "tvl": 500000000,
  "chainTvls": {
    "Solana": 500000000
  },
  "change_1h": 0.1,
  "change_1d": 2.5,
  "change_7d": -1.0,
  "mcap": 1500000000,
  "twitter": "JupiterExchange",
  "url": "https://jup.ag",
  "description": "The best swap aggregator on Solana",
  "raises": [
    {
      "date": "2024-01-15",
      "amount": 10000000,
      "round": "Series A"
    }
  ]
}
```

### Stablecoin Chain Data
```json
{
  "date": 1700000000,
  "totalCirculatingUSD": {
    "peggedUSD": 3500000000
  },
  "totalMintedUSD": {
    "peggedUSD": 3600000000
  },
  "totalBridgedToUSD": {
    "peggedUSD": 3400000000
  }
}
```

---

*Last updated: 2026-02-12*
*Data source: DeFiLlama API (https://api.llama.fi)*
