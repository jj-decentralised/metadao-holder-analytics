# Multi-Token Pipeline

This document describes the multi-token support added to the MetaDAO Holder Analytics application.

## Overview

The application now supports tracking holder analytics for multiple tokens in the MetaDAO ecosystem, not just the META token. The token registry is extensible and includes:

- **META** - MetaDAO governance token
- **USDC** - USD Coin (Solana)
- **SOL** - Native Solana token

## Architecture

### Token Registry (`src/lib/tokens.ts`)

Central registry defining all supported tokens with:

```typescript
interface Token {
  id: string;         // URL-safe identifier (e.g., "meta", "usdc")
  name: string;       // Human-readable name
  symbol: string;     // Token symbol
  address: string;    // On-chain token address
  networkId: number;  // Codex network ID (1399811149 for Solana)
  coingeckoId: string; // CoinGecko API identifier
  decimals: number;   // Token decimals
  logoUrl?: string;   // Optional logo URL
}
```

**Functions:**
- `getTokenById(id)` - Look up token by registry ID
- `getTokenByAddress(address)` - Look up token by on-chain address
- `getAllTokens()` - Get all registered tokens
- `buildCodexTokenId(token)` - Build Codex API token ID format

### API Endpoints

#### `GET /api/tokens`

Returns list of all registered tokens.

**Response:**
```json
{
  "tokens": [
    { "id": "meta", "name": "MetaDAO", "symbol": "META", ... },
    { "id": "usdc", "name": "USD Coin", "symbol": "USDC", ... },
    { "id": "sol", "name": "Solana", "symbol": "SOL", ... }
  ]
}
```

#### `GET /api/tokens/[id]/holders`

Fetches holder data for a specific token.

**Parameters:**
- `id` (path) - Token registry ID (e.g., "meta", "usdc", "sol")
- `limit` (query, optional) - Number of holders to fetch (default: 100)

**Response:**
```json
{
  "token": {
    "id": "meta",
    "name": "MetaDAO",
    "symbol": "META",
    "address": "METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr"
  },
  "totalHolders": 2847,
  "top10Percentage": 68.5,
  "top50Percentage": 89.2,
  "medianBalance": 1250,
  "holders": [
    {
      "address": "ABC123...",
      "balance": "1000000",
      "balanceUsd": 50000,
      "percentage": 25.5
    }
  ]
}
```

### React Components

#### `TokenSelector` (`src/components/TokenSelector.tsx`)

Dropdown component for selecting tokens.

**Props:**
```typescript
interface TokenSelectorProps {
  value: string;                    // Current token ID
  onChange: (tokenId: string) => void; // Selection callback
  className?: string;               // Optional CSS class
  disabled?: boolean;               // Disable interaction
}
```

**Usage:**
```tsx
import { TokenSelector } from "@/components/TokenSelector";

function MyComponent() {
  const [selectedToken, setSelectedToken] = useState("meta");
  
  return (
    <TokenSelector
      value={selectedToken}
      onChange={setSelectedToken}
    />
  );
}
```

## Data Flow

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ TokenSelector   │────▶│ /api/tokens  │────▶│ Token Registry  │
│ (React)         │     │              │     │                 │
└────────┬────────┘     └──────────────┘     └─────────────────┘
         │
         │ User selects token
         ▼
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│ Page Component  │────▶│ /api/tokens/[id]/    │────▶│ Codex SDK   │
│                 │     │ holders              │     │             │
└─────────────────┘     └──────────────────────┘     └─────────────┘
```

## Adding New Tokens

To add a new token to the registry:

1. Edit `src/lib/tokens.ts`
2. Add entry to `TOKEN_REGISTRY` array:

```typescript
{
  id: "newtoken",           // Unique, URL-safe ID
  name: "New Token",
  symbol: "NEW",
  address: "TokenAddress...",
  networkId: SOLANA_NETWORK_ID,
  coingeckoId: "new-token", // For price data
  decimals: 9,
}
```

The token will automatically appear in the API and TokenSelector component.

## Backward Compatibility

The original `/api/holders` endpoint remains unchanged and continues to serve META token data. New endpoints are additive and don't break existing functionality.

## Environment Variables

Required:
- `CODEX_API_KEY` - API key for Codex.io data provider

Optional:
- `DATABASE_URL` - PostgreSQL for historical snapshots (existing feature)
