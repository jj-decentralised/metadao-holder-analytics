# Pipeline Validation & Error Recovery

This document describes the validation and error recovery system for the MetaDAO Holder Analytics pipeline.

## Overview

The analytics pipeline fetches data from multiple upstream APIs (Codex, CoinGecko) and transforms it for display. This system ensures:

1. **Data Integrity** - All API responses are validated before use
2. **Graceful Degradation** - Failures don't crash the app
3. **Automatic Recovery** - Transient errors are retried with backoff
4. **Observability** - Health status is exposed via diagnostics endpoint

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  API Route  │ --> │ Retry Layer  │ --> │ Validation     │
└─────────────┘     └──────────────┘     └────────────────┘
                            │                    │
                            v                    v
                    ┌──────────────┐     ┌────────────────┐
                    │ Upstream API │     │ Typed Response │
                    │ (Codex/CG)   │     │ or Error       │
                    └──────────────┘     └────────────────┘
```

## Components

### 1. Runtime Validators (`src/lib/validation.ts`)

Zod-free validators that check API response shapes at runtime without external dependencies.

**Key Functions:**

| Function | Description |
|----------|-------------|
| `validateCodexHoldersResponse` | Validates Codex holder API responses |
| `validateCoinGeckoMarketChart` | Validates CoinGecko market chart data |
| `validateCoinGeckoSimplePrice` | Validates CoinGecko simple price data |
| `validateHolderStats` | Validates transformed holder statistics |

**Usage:**

```typescript
import { validateCoinGeckoMarketChart, ValidationError } from "@/lib/validation";

const validation = validateCoinGeckoMarketChart(rawJson);
if (!validation.valid) {
  throw new ValidationError(validation.errors, "CoinGeckoMarketChart");
}
const data = validation.data; // Typed!
```

**Validation Results:**

All validators return a discriminated union:

```typescript
type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: string[] };
```

### 2. Retry System (`src/lib/retry.ts`)

Generic retry wrapper with exponential backoff and jitter.

**Key Functions:**

| Function | Description |
|----------|-------------|
| `withRetry` | Retry async function with backoff |
| `withRetrySafe` | Same but never throws, returns result object |
| `isHttpRetryable` | Check if HTTP error is retryable |
| `httpRetry` | Pre-configured retry for HTTP requests |

**Configuration:**

```typescript
interface RetryOptions {
  maxAttempts?: number;      // Default: 3
  initialDelayMs?: number;   // Default: 500
  maxDelayMs?: number;       // Default: 10000
  backoffMultiplier?: number; // Default: 2 (exponential)
  jitter?: boolean;          // Default: true
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}
```

**Retry Logic:**

- **Retryable errors:** 5xx status codes, 429 (rate limit), network errors
- **Non-retryable errors:** 4xx status codes (except 429), validation errors
- **Backoff formula:** `min(initialDelay * 2^attempt + jitter, maxDelay)`

**Example:**

```typescript
const data = await withRetry(
  () => fetch(url).then(r => r.json()),
  {
    maxAttempts: 5,
    initialDelayMs: 1000,
    onRetry: (err, attempt) => console.warn(`Retry ${attempt}:`, err),
  }
);
```

### 3. Diagnostics Endpoint (`/api/diagnostics`)

Health check endpoint that tests all upstream APIs.

**Response Format:**

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "overall": "healthy",
  "services": [
    {
      "name": "codex",
      "status": "ok",
      "latencyMs": 245
    },
    {
      "name": "coingecko",
      "status": "ok",
      "latencyMs": 180
    },
    {
      "name": "database",
      "status": "degraded",
      "error": "DATABASE_URL not configured (optional)"
    }
  ],
  "metrics": {
    "coingecko": {
      "lastLatencyMs": 180,
      "totalCalls": 42,
      "totalErrors": 1,
      "errorRate": 0.024
    }
  }
}
```

**Status Levels:**

| Overall | Meaning |
|---------|---------|
| `healthy` | All services operational |
| `degraded` | Some services have issues but app is functional |
| `unhealthy` | Critical services down, app may not work |

**HTTP Status Codes:**

- `200` - Healthy or degraded
- `503` - Unhealthy

### 4. Error Boundary (`src/components/ErrorBoundary.tsx`)

React error boundary for graceful UI degradation.

**Components:**

| Component | Description |
|-----------|-------------|
| `ErrorBoundary` | Catches JS errors in child tree |
| `ErrorDisplay` | Inline error message display |
| `LoadingFallback` | Loading placeholder |
| `EmptyState` | Empty data placeholder |

**Usage:**

```tsx
<ErrorBoundary
  title="Chart Error"
  onError={(error) => logToSentry(error)}
>
  <PriceChart data={data} />
</ErrorBoundary>
```

## Error Handling Strategy

### API Layer

1. **Fetch with retry** - Automatic retry for transient failures
2. **Validate response** - Check data shape before processing
3. **Log errors** - Console warnings for debugging
4. **Fallback data** - Return mock/cached data if all retries fail

### UI Layer

1. **Error boundaries** - Catch render errors per component
2. **Loading states** - Show skeleton while fetching
3. **Empty states** - Handle missing data gracefully
4. **Retry buttons** - Allow manual retry on failure

## Monitoring

### Checking Health

```bash
# Check all services
curl http://localhost:3000/api/diagnostics

# Just check if healthy
curl -s http://localhost:3000/api/diagnostics | jq '.overall'
```

### Log Messages

All validation and retry events are logged with prefixes:

- `[Codex]` - Codex API issues
- `[CoinGecko]` - CoinGecko API issues
- `[ErrorBoundary]` - React component errors
- `[Diagnostics]` - Health check issues

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CODEX_API_KEY` | Yes | Codex API authentication |
| `DATABASE_URL` | No | PostgreSQL connection string |

### Retry Defaults

Current retry configuration (can be adjusted per-call):

- **Codex API:** 3 attempts, 500ms initial delay
- **CoinGecko API:** 3 attempts, 500ms initial delay, 8s max delay
- **Health checks:** 1 attempt (no retry)

## Troubleshooting

### "Validation failed for X"

API returned data in unexpected format. Check:

1. API documentation for breaking changes
2. Raw response in browser network tab
3. Validation errors array for specific fields

### "HTTP 429" errors

Rate limited. Solutions:

1. Reduce polling frequency
2. Add caching (already implemented)
3. Use Pro API tier

### "CODEX_API_KEY not configured"

Set environment variable:

```bash
export CODEX_API_KEY=your-api-key
```

Or in `.env.local`:

```
CODEX_API_KEY=your-api-key
```

## Testing

### Manual Testing

```bash
# Test validation
npm run build  # TypeScript will catch type errors

# Test retry logic
# Simulate network failure by disconnecting
curl http://localhost:3000/api/holders

# Test error boundary
# Add `throw new Error('test')` to a component
```

### Unit Testing (Future)

Consider adding tests for:

- Validation functions with edge cases
- Retry logic with mock timers
- Error boundary rendering

## Future Improvements

1. **Circuit breaker** - Stop calling failing APIs temporarily
2. **Request deduplication** - Prevent duplicate in-flight requests
3. **Structured logging** - JSON logs for aggregation
4. **Metrics export** - Prometheus/DataDog integration
5. **Alert webhooks** - Notify on prolonged failures
