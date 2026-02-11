# Pipeline Caching Strategy

This document describes the caching layer implemented to reduce API rate limiting issues and improve page load performance.

## Overview

The caching system has two layers:

1. **In-memory LRU cache** (`src/lib/cache.ts`) - Server-side caching for API responses
2. **HTTP cache headers** (`src/lib/apiHelpers.ts`) - Browser/CDN caching via `Cache-Control` headers

## In-Memory Cache

### Implementation

A pure TypeScript LRU (Least Recently Used) cache with TTL (Time To Live) support:

- **No external dependencies** - Pure TypeScript implementation
- **Configurable size limits** - Prevents unbounded memory growth
- **Automatic expiration** - Entries expire based on TTL
- **Hit/miss tracking** - Metrics available via `/api/health`

### Cache Instances

| Cache | Max Size | Default TTL | Purpose |
|-------|----------|-------------|---------|
| `priceCache` | 50 | 5 minutes | Market chart data |
| `simplePriceCache` | 100 | 1 minute | Current price queries |
| `holdersCache` | 20 | 2 minutes | Holder statistics |

### Usage

```typescript
import { priceCache } from "@/lib/cache";

// Get or compute pattern
const data = await priceCache.getOrSet(
  "cache-key",
  async () => fetchExpensiveData(),
  300_000 // optional TTL override (5 min)
);
```

## HTTP Cache Headers

### Implementation

The `jsonWithCache` helper applies `Cache-Control` headers with `stale-while-revalidate`:

```typescript
import { jsonWithCache } from "@/lib/apiHelpers";

// Using preset
return jsonWithCache(data, "priceChart");

// Using custom options
return jsonWithCache(data, {
  maxAge: 60,
  staleWhileRevalidate: 300,
  isPublic: true,
});
```

### Presets

| Preset | max-age | stale-while-revalidate | Use Case |
|--------|---------|------------------------|----------|
| `priceChart` | 60s | 300s | Historical price data |
| `simplePrice` | 30s | 60s | Current price info |
| `holders` | 60s | 120s | Holder statistics |
| `metrics` | 120s | 300s | Computed metrics |
| `health` | 0s | 0s | Health checks |

### How stale-while-revalidate Works

1. **Fresh (0-60s)**: Response served from cache
2. **Stale (60-360s)**: Stale response served immediately; fresh copy fetched in background
3. **Expired (>360s)**: Client waits for fresh response

## TTL Configuration

### CoinGecko API

| Endpoint | In-Memory TTL | HTTP max-age | Rationale |
|----------|--------------|--------------|-----------|
| `/coins/{id}/market_chart` | 5 min | 60s | Historical data rarely changes |
| `/simple/price` | 1 min | 30s | Current prices need more freshness |

### Codex API

| Endpoint | In-Memory TTL | HTTP max-age | Rationale |
|----------|--------------|--------------|-----------|
| Token holders | 2 min | 60s | Holder data changes infrequently |

## Health Endpoint

`GET /api/health` returns cache performance metrics:

```json
{
  "status": "healthy",
  "uptime": {
    "seconds": 3600,
    "formatted": "1h 0m 0s"
  },
  "cache": {
    "overall": {
      "totalHits": 150,
      "totalMisses": 50,
      "hitRate": 0.75
    },
    "byType": {
      "priceCache": { "hits": 80, "misses": 20, ... },
      "simplePriceCache": { "hits": 50, "misses": 20, ... },
      "holdersCache": { "hits": 20, "misses": 10, ... }
    }
  },
  "api": {
    "coingecko": {
      "lastLatencyMs": 245,
      "totalCalls": 70,
      "totalErrors": 2,
      "errorRate": 0.028
    }
  },
  "timestamp": "2026-02-11T13:26:31Z"
}
```

### Health Status

- **healthy**: All systems nominal
- **degraded**: Error rate > 10% or latency > 5000ms
- **unhealthy**: Error rate > 50%

## Cache Invalidation

Currently, caches expire naturally via TTL. For manual invalidation:

```typescript
import { priceCache } from "@/lib/cache";

// Clear specific key
priceCache.delete("market:meta-dao:90:usd");

// Clear all entries
priceCache.clear();

// Remove expired entries only
priceCache.prune();
```

## Best Practices

1. **Choose appropriate TTLs** - Balance freshness vs. API quota
2. **Use cache keys wisely** - Include all parameters that affect the response
3. **Monitor hit rates** - Low hit rates may indicate TTL is too short
4. **Handle cache misses gracefully** - Always have fallback logic

## Files Modified

- `src/lib/cache.ts` - LRU cache implementation
- `src/lib/coingecko.ts` - Added caching to CoinGecko fetchers
- `src/lib/apiHelpers.ts` - HTTP cache header utilities
- `src/app/api/health/route.ts` - Health check endpoint
- `src/app/api/price/[id]/route.ts` - Applied cache headers
- `src/app/api/market/[id]/route.ts` - Uses cached `fetchSimplePrice`
- `src/app/api/metrics/[id]/route.ts` - Applied cache headers
- `src/app/api/holders/route.ts` - Applied in-memory + HTTP caching
