# Revenue Data Sources Research

This document outlines the research findings for integrating protocol revenue data into the MetaDAO Holder Analytics platform using TokenTerminal and DeFiLlama APIs.

## Table of Contents
- [TokenTerminal API](#tokenterminal-api)
- [DeFiLlama Fees/Revenue API](#defillama-feesrevenue-api)
- [Token Mapping](#token-mapping)
- [Comparison & Recommendations](#comparison--recommendations)
- [TypeScript Client Design](#typescript-client-design)

---

## TokenTerminal API

### Overview
TokenTerminal provides standardized financial metrics for blockchain projects through a REST API.

**Base URL:** `https://api.tokenterminal.com`

**Authentication:** Bearer token via `Authorization` header
```
Authorization: Bearer <TOKENTERMINAL_API_KEY>
```

### Rate Limits
- **1,000 requests per minute** (increased from 60 in recent updates)
- HTTP 429 response when exceeded

### Key Endpoints

#### 1. List All Projects
```
GET /v2/projects
```
Returns all available projects with their metadata and available metrics.

#### 2. Get Project Metric Availability
```
GET /v2/projects/{project_id}
```
Returns which metrics are available for a specific project.

#### 3. Get Historical Metrics for a Project
```
GET /v2/projects/{project_id}/metrics
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `metric_ids` | string[] | Comma-separated list: `fees,revenue,tvl,user_dau` |
| `chain_ids` | string[] | Filter by chain: `ethereum,solana` |
| `start` | date | Start date (YYYY-MM-DD) |
| `end` | date | End date (YYYY-MM-DD) |
| `order_direction` | string | `asc` or `desc` (default: `desc`) |
| `aggregate_by` | string | Granularity level (e.g., by chain) |

**Response Structure:**
```json
{
  "data": [
    {
      "timestamp": "2024-01-15",
      "project_name": "Jupiter",
      "project_id": "jupiter",
      "chain": "solana",
      "fees": 1234567.89,
      "revenue": 123456.78,
      "tvl": 500000000.00
    }
  ],
  "errors": []
}
```

#### 4. Get Metric Aggregations
```
GET /v2/projects/{project_id}/metrics/aggregations
```
Returns aggregated metrics (sums, averages) over time periods.

#### 5. Get Financial Statement
```
GET /v2/projects/{project_id}/financial-statement
```
Returns income statement with fees, revenue, expenses, and earnings.

### Available Metrics

| Metric ID | Description |
|-----------|-------------|
| `fees` | Total fees paid by users (top-line, "Gross Revenue") |
| `revenue` | Portion retained by protocol (after LP/supply-side payments) |
| `earnings` | Net value after all expenses (cost of revenue, incentives, opex) |
| `cost_of_revenue` | Expenses to third-party service providers |
| `tvl` | Total Value Locked |
| `user_dau` | Daily Active Users |
| `user_mau` | Monthly Active Users |
| `market_cap_circulating` | Circulating market cap |
| `market_cap_fully_diluted` | Fully diluted market cap |
| `price` | Token price |
| `volume` | Trading volume |
| `token_incentives` | Token incentives distributed |
| `gmv` | Gross Merchandise Value |
| `active_loans` | Active loans (lending protocols) |

### Time Granularity
- **Daily data** is the primary granularity
- Can aggregate to weekly/monthly using `aggregate_by` parameter
- Historical data depth varies by project (typically 1-3+ years)

---

## DeFiLlama Fees/Revenue API

### Overview
DeFiLlama provides free, open-source DeFi data including fees and revenue metrics.

**Base URL:** `https://api.llama.fi`

**Authentication:** No authentication required for basic endpoints. Pro API (`https://pro-api.llama.fi`) requires API key for higher limits.

### Rate Limits
- Free tier: Reasonable limits (undocumented, but typically sufficient for moderate use)
- Pro tier: 1,000 requests/minute, 1M calls/month

### Key Endpoints

#### 1. Fees Overview (All Protocols)
```
GET /overview/fees
```

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `excludeTotalDataChart` | Exclude aggregated chart data |
| `excludeTotalDataChartBreakdown` | Exclude breakdown chart |
| `dataType` | `dailyFees`, `dailyRevenue`, or `dailyHoldersRevenue` |

**Response includes:**
- `totalFees24h` / `totalRevenue24h`
- `change_1d`, `change_7d`
- `protocols[]` array with individual protocol data

#### 2. Fees by Chain
```
GET /overview/fees/{chain}
```
Example: `GET /overview/fees/Solana`

Returns protocols filtered by specific chain.

#### 3. Protocol Fee Summary
```
GET /summary/fees/{protocol}
```
Example: `GET /summary/fees/jupiter`

**Response Structure:**
```json
{
  "id": "parent#jupiter",
  "name": "Jupiter",
  "chains": ["Solana"],
  "gecko_id": "jupiter-exchange-solana",
  "total24h": 1234567,
  "total7d": 8765432,
  "total30d": 35000000,
  "totalAllTime": 500000000,
  "childProtocols": [
    {
      "name": "Jupiter Aggregator",
      "module": "jupiter",
      "total24h": 7959
    },
    {
      "name": "Jupiter Perpetual Exchange",
      "module": "jupiter-perpetual",
      "total24h": 1210840
    }
  ],
  "totalDataChart": [[timestamp, value], ...],
  "totalDataChartBreakdown": {...}
}
```

### Metric Definitions (DeFiLlama)

| Metric | Description |
|--------|-------------|
| **Fees** | Total amount paid by users (equivalent to "Gross Revenue" in traditional business) |
| **Revenue** | Portion collected by protocol for treasury/team/token holders (after LP payouts) |
| **Holders Revenue** | Subset of revenue distributed to token holders (buybacks, burns, staking rewards) |

---

## Token Mapping

### Solana Tokens with Revenue Data

| Token | TokenTerminal ID | DeFiLlama Module | Has Fees Data | Has Revenue Data |
|-------|------------------|------------------|---------------|------------------|
| **Jupiter (JUP)** | `jupiter` | `jupiter`, `jupiter-perpetual`, `jupiter-dca` | ✅ Yes | ✅ Yes |
| **Raydium (RAY)** | `raydium` | `raydium` | ✅ Yes | ✅ Yes |
| **Orca (ORCA)** | `orca` | `orca` | ✅ Yes | ✅ Yes |
| **Drift (DRIFT)** | `drift` | `drift-protocol-derivatives`, `drift-staked-sol` | ✅ Yes | ✅ Yes |
| **Jito (JTO)** | `jito` | `jito-staked-sol`, `jito-mev-tips`, `jito` | ✅ Yes | ✅ Yes |
| **Marinade (MNDE)** | `marinade-finance` | `marinade-liquid-staking`, `marinade-native` | ✅ Yes | ✅ Yes |
| **Kamino (KMNO)** | `kamino` | `kamino-liquidity`, `kamino-lending` | ✅ Yes | ✅ Yes |
| **Helium (HNT)** | `helium` | `helium` | ✅ Yes | ⚠️ Limited |
| **Render (RENDER)** | ❌ Not found | ❌ Not found | ❌ No | ❌ No |

### DeFiLlama Protocol IDs (Solana)

```typescript
const DEFILLAMA_SOLANA_PROTOCOLS = {
  jupiter: {
    parent: 'parent#jupiter',
    modules: ['jupiter', 'jupiter-perpetual', 'jupiter-dca', 'jupiter-staked-sol', 'jup-ape', 'jup-studio', 'jupiter-lend', 'jupiter-prediction'],
    totalAllTime: 1566000000 // Combined across all products
  },
  raydium: {
    parent: 'parent#raydium',
    modules: ['raydium'],
    totalAllTime: 1375877116
  },
  orca: {
    parent: 'parent#orca',
    modules: ['orca'],
    totalAllTime: 201735668
  },
  drift: {
    parent: 'parent#drift',
    modules: ['drift-protocol-derivatives', 'drift-staked-sol'],
    totalAllTime: 58803552
  },
  jito: {
    parent: 'parent#jito',
    modules: ['jito-staked-sol', 'jito-mev-tips', 'jito'],
    totalAllTime: 1530352970
  },
  marinade: {
    parent: 'parent#marinade-finance',
    modules: ['marinade-liquid-staking', 'marinade-native', 'marinade-select'],
    totalAllTime: 239664386
  },
  kamino: {
    parent: 'parent#kamino-finance',
    modules: ['kamino-liquidity', 'kamino-lending'],
    totalAllTime: 209795557
  },
  helium: {
    parent: null,
    modules: ['helium'],
    totalAllTime: 12666283
  }
};
```

---

## Comparison & Recommendations

### TokenTerminal vs DeFiLlama

| Aspect | TokenTerminal | DeFiLlama |
|--------|---------------|-----------|
| **Authentication** | API key required | Free (no auth for basic) |
| **Cost** | Paid subscription | Free / $300/mo Pro |
| **Rate Limits** | 1,000/min | Higher for free tier |
| **Data Quality** | Highly curated, standardized | Community-maintained |
| **Historical Depth** | Extensive (years) | Extensive (years) |
| **Metric Granularity** | Daily, can aggregate | Daily, can aggregate |
| **Financial Statements** | ✅ Full P&L | ❌ Limited |
| **Coverage** | ~300 projects | ~700+ protocols |
| **Solana Support** | Good | Excellent |

### Recommendation

**Primary Source: DeFiLlama**
- Free and no authentication needed for basic use
- Excellent Solana coverage
- Provides both fees and revenue breakdowns
- Real-time data updates

**Secondary Source: TokenTerminal**
- Use when deeper financial analysis is needed (P&L, earnings)
- More standardized metrics comparable across sectors
- Better for institutional-grade analysis

### Caching Strategy

```typescript
// Recommended cache TTLs
const CACHE_TTL = {
  // Overview data (changes less frequently)
  feesOverview: 5 * 60 * 1000,      // 5 minutes
  
  // Protocol summary (moderate update frequency)
  protocolSummary: 10 * 60 * 1000,  // 10 minutes
  
  // Historical data (rarely changes for past dates)
  historicalData: 60 * 60 * 1000,   // 1 hour
  
  // All-time totals (aggregate, slow changing)
  allTimeTotals: 30 * 60 * 1000,    // 30 minutes
};
```

---

## TypeScript Client Design

### DeFiLlama Client

```typescript
// src/lib/api/defillama.ts

export interface DefiLlamaProtocolFees {
  id: string;
  name: string;
  chains: string[];
  total24h: number | null;
  total7d: number | null;
  total30d: number | null;
  totalAllTime: number | null;
  change_1d: number | null;
  change_7d: number | null;
  dailyRevenue: number | null;
  totalDataChart: [number, number][];
  methodology: Record<string, string>;
}

export interface DefiLlamaFeesOverview {
  totalFees24h: number;
  totalRevenue24h: number;
  change_1d: number;
  protocols: DefiLlamaProtocolFees[];
}

const DEFILLAMA_BASE_URL = 'https://api.llama.fi';

class DefiLlamaClient {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  
  private async fetchWithCache<T>(
    endpoint: string,
    ttl: number
  ): Promise<T> {
    const cached = this.cache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
    
    const response = await fetch(`${DEFILLAMA_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`DeFiLlama API error: ${response.status}`);
    }
    
    const data = await response.json();
    this.cache.set(endpoint, { data, timestamp: Date.now() });
    return data;
  }
  
  /**
   * Get fees overview for all protocols
   */
  async getFeesOverview(chain?: string): Promise<DefiLlamaFeesOverview> {
    const endpoint = chain 
      ? `/overview/fees/${chain}`
      : '/overview/fees';
    return this.fetchWithCache(endpoint, 5 * 60 * 1000);
  }
  
  /**
   * Get detailed fees for a specific protocol
   */
  async getProtocolFees(protocol: string): Promise<DefiLlamaProtocolFees> {
    return this.fetchWithCache(
      `/summary/fees/${protocol}`,
      10 * 60 * 1000
    );
  }
  
  /**
   * Get Solana protocols with fees data
   */
  async getSolanaProtocolFees(): Promise<DefiLlamaProtocolFees[]> {
    const overview = await this.getFeesOverview();
    return overview.protocols.filter(p => 
      p.chains.includes('Solana')
    );
  }
}

export const defiLlamaClient = new DefiLlamaClient();
```

### TokenTerminal Client

```typescript
// src/lib/api/tokenterminal.ts

export interface TokenTerminalMetricData {
  timestamp: string;
  project_name: string;
  project_id: string;
  chain: string;
  fees?: number;
  revenue?: number;
  earnings?: number;
  tvl?: number;
  user_dau?: number;
}

export interface TokenTerminalProjectMetrics {
  data: TokenTerminalMetricData[];
  errors: { code: string; field: string; value: string }[];
}

const TOKENTERMINAL_BASE_URL = 'https://api.tokenterminal.com';

class TokenTerminalClient {
  private apiKey: string;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async fetchWithCache<T>(
    endpoint: string,
    ttl: number
  ): Promise<T> {
    const cached = this.cache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
    
    const response = await fetch(`${TOKENTERMINAL_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 429) {
      throw new Error('TokenTerminal rate limit exceeded');
    }
    
    if (!response.ok) {
      throw new Error(`TokenTerminal API error: ${response.status}`);
    }
    
    const data = await response.json();
    this.cache.set(endpoint, { data, timestamp: Date.now() });
    return data;
  }
  
  /**
   * Get all available projects
   */
  async getProjects(): Promise<{ data: { project_id: string; name: string }[] }> {
    return this.fetchWithCache('/v2/projects', 60 * 60 * 1000);
  }
  
  /**
   * Get metric availability for a project
   */
  async getMetricAvailability(projectId: string): Promise<unknown> {
    return this.fetchWithCache(
      `/v2/projects/${projectId}`,
      60 * 60 * 1000
    );
  }
  
  /**
   * Get historical metrics for a project
   */
  async getProtocolMetrics(
    projectId: string,
    options: {
      metrics?: string[];
      startDate?: string;
      endDate?: string;
      chain?: string;
    } = {}
  ): Promise<TokenTerminalProjectMetrics> {
    const params = new URLSearchParams();
    
    if (options.metrics?.length) {
      params.set('metric_ids', options.metrics.join(','));
    }
    if (options.startDate) {
      params.set('start', options.startDate);
    }
    if (options.endDate) {
      params.set('end', options.endDate);
    }
    if (options.chain) {
      params.set('chain_ids', options.chain);
    }
    
    const queryString = params.toString();
    const endpoint = `/v2/projects/${projectId}/metrics${queryString ? `?${queryString}` : ''}`;
    
    return this.fetchWithCache(endpoint, 10 * 60 * 1000);
  }
  
  /**
   * Get revenue data for a protocol
   */
  async getProtocolRevenue(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TokenTerminalProjectMetrics> {
    return this.getProtocolMetrics(projectId, {
      metrics: ['revenue'],
      startDate,
      endDate,
    });
  }
  
  /**
   * Get fees data for a protocol
   */
  async getProtocolFees(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TokenTerminalProjectMetrics> {
    return this.getProtocolMetrics(projectId, {
      metrics: ['fees'],
      startDate,
      endDate,
    });
  }
}

// Create client instance (use env var for API key)
export const tokenTerminalClient = new TokenTerminalClient(
  process.env.TOKENTERMINAL_API_KEY || ''
);
```

### Combined Revenue Service

```typescript
// src/lib/services/revenueService.ts

import { defiLlamaClient } from '../api/defillama';
import { tokenTerminalClient } from '../api/tokenterminal';

export interface ProtocolRevenue {
  protocol: string;
  tokenSymbol: string;
  fees24h: number | null;
  revenue24h: number | null;
  fees30d: number | null;
  feesAllTime: number | null;
  change1d: number | null;
  change7d: number | null;
  source: 'defillama' | 'tokenterminal';
}

// Mapping of our tokens to data source IDs
const TOKEN_MAPPING = {
  JUP: { defillama: 'jupiter', tokenterminal: 'jupiter' },
  RAY: { defillama: 'raydium', tokenterminal: 'raydium' },
  ORCA: { defillama: 'orca', tokenterminal: 'orca' },
  DRIFT: { defillama: 'drift', tokenterminal: 'drift' },
  JTO: { defillama: 'jito', tokenterminal: 'jito' },
  MNDE: { defillama: 'marinade-finance', tokenterminal: 'marinade-finance' },
  KMNO: { defillama: 'kamino-finance', tokenterminal: 'kamino' },
  HNT: { defillama: 'helium', tokenterminal: 'helium' },
  RENDER: { defillama: null, tokenterminal: null }, // Not available
} as const;

export class RevenueService {
  /**
   * Get revenue data for a token from DeFiLlama (primary source)
   */
  async getTokenRevenue(tokenSymbol: string): Promise<ProtocolRevenue | null> {
    const mapping = TOKEN_MAPPING[tokenSymbol as keyof typeof TOKEN_MAPPING];
    if (!mapping?.defillama) {
      return null;
    }
    
    try {
      const data = await defiLlamaClient.getProtocolFees(mapping.defillama);
      
      return {
        protocol: data.name,
        tokenSymbol,
        fees24h: data.total24h,
        revenue24h: data.dailyRevenue,
        fees30d: data.total30d,
        feesAllTime: data.totalAllTime,
        change1d: data.change_1d,
        change7d: data.change_7d,
        source: 'defillama',
      };
    } catch (error) {
      console.error(`Failed to fetch revenue for ${tokenSymbol}:`, error);
      return null;
    }
  }
  
  /**
   * Get revenue data for all supported tokens
   */
  async getAllTokenRevenue(): Promise<ProtocolRevenue[]> {
    const results: ProtocolRevenue[] = [];
    
    for (const [symbol, mapping] of Object.entries(TOKEN_MAPPING)) {
      if (mapping.defillama) {
        const revenue = await this.getTokenRevenue(symbol);
        if (revenue) {
          results.push(revenue);
        }
      }
    }
    
    return results;
  }
}

export const revenueService = new RevenueService();
```

---

## API Response Examples

### DeFiLlama `/summary/fees/jupiter`
```json
{
  "id": "parent#jupiter",
  "name": "Jupiter",
  "chains": ["Solana"],
  "gecko_id": "jupiter-exchange-solana",
  "symbol": "JUP",
  "childProtocols": [
    {
      "name": "Jupiter Aggregator",
      "total24h": 7959,
      "totalAllTime": 159854153
    },
    {
      "name": "Jupiter Perpetual Exchange", 
      "total24h": 1210840,
      "totalAllTime": 1293646697
    },
    {
      "name": "Jupiter DCA",
      "total24h": 5713,
      "totalAllTime": 16531228
    }
  ]
}
```

### TokenTerminal `/v2/projects/jupiter/metrics?metric_ids=fees,revenue`
```json
{
  "data": [
    {
      "timestamp": "2024-01-15",
      "project_name": "Jupiter",
      "project_id": "jupiter",
      "chain": "solana",
      "fees": 1567890.12,
      "revenue": 156789.01
    }
  ],
  "errors": []
}
```

---

## Next Steps

1. **Implement DeFiLlama client** as primary data source (free, good coverage)
2. **Add TokenTerminal client** for enhanced metrics when needed
3. **Create API routes** to expose revenue data to frontend
4. **Add caching layer** using Redis or in-memory cache
5. **Build UI components** for revenue display (cards, charts)
6. **Set up background jobs** for periodic data refresh

## References

- [TokenTerminal API Docs](https://docs.tokenterminal.com/reference/api-reference)
- [DeFiLlama API Docs](https://defillama.com/docs/api)
- [DeFiLlama Data Definitions](https://defillama.com/data-definitions)
