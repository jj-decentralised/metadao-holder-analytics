# Snapshot Pipeline

This document describes the hourly holder snapshot pipeline that captures historical holder data for MetaDAO tokens.

## Overview

The snapshot pipeline runs hourly via GitHub Actions, collecting:
1. **Aggregate metrics** — holder count, top 10%, and top 50% concentration
2. **Per-holder balances** — individual wallet balances for historical tracking

This enables historical analysis of holder distribution changes, identification of new/lost holders, and tracking individual wallet balance history.

## Architecture

```
┌─────────────────┐      hourly cron       ┌──────────────────────┐
│    Codex API    │ ◄──────────────────────│  snapshot_holders.mjs│
└─────────────────┘                        └──────────┬───────────┘
                                                      │
                                           insert     │
                                                      ▼
                                           ┌──────────────────────┐
                                           │     PostgreSQL       │
                                           │  - holder_snapshots  │
                                           │  - holder_balances   │
                                           └──────────────────────┘
                                                      │
                                             query    │
                                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                        API Routes                                │
│  /api/holders/timeseries     - Aggregate metrics over time       │
│  /api/holders/wallet/[addr]  - Single wallet balance history     │
│  /api/holders/changes        - New/lost holders between snaps    │
└──────────────────────────────────────────────────────────────────┘
```

## Database Schema

### `holder_snapshots`

Stores aggregate metrics per snapshot.

| Column | Type | Description |
|--------|------|-------------|
| `token_id` | text | Token identifier (address:networkId) |
| `as_of` | timestamptz | Snapshot timestamp |
| `holder_count` | int | Total number of holders |
| `top10_pct` | double precision | % of supply held by top 10 wallets |
| `top50_pct` | double precision | % of supply held by top 50 wallets |

Primary key: `(token_id, as_of)`

### `holder_balances`

Stores per-holder balances at each snapshot.

| Column | Type | Description |
|--------|------|-------------|
| `token_id` | text | Token identifier (address:networkId) |
| `as_of` | timestamptz | Snapshot timestamp |
| `wallet_address` | text | Holder's wallet address |
| `balance` | double precision | Token balance |
| `balance_usd` | double precision | USD value (nullable) |

Primary key: `(token_id, as_of, wallet_address)`
Index: `idx_holder_balances_wallet` on `(wallet_address, token_id, as_of)`

## Snapshot Script

**Location:** `scripts/snapshot_holders.mjs`

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CODEX_API_KEY` | Yes | — | API key for Codex data provider |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `TOKEN_IDS` | No | MetaDAO token | Comma-separated token IDs |
| `HOLDER_FETCH_LIMIT` | No | 500 | Max holders to fetch per token |

### Running Manually

```bash
CODEX_API_KEY=xxx DATABASE_URL=xxx node scripts/snapshot_holders.mjs
```

### GitHub Actions Schedule

The workflow runs hourly at minute 0. See `.github/workflows/snapshot.yml`.

## API Endpoints

### GET `/api/holders/timeseries`

Returns aggregate holder metrics over time.

**Query Parameters:**
- `tokenId` (optional) — Filter by token
- `days` (default: 180) — Number of days of history

**Response:**
```json
{
  "series": [
    { "t": 1707660000000, "holderCount": 2847, "top10": 68.5, "top50": 89.2 }
  ]
}
```

### GET `/api/holders/wallet/[address]`

Returns balance history for a single wallet.

**Path Parameters:**
- `address` — Wallet address (min 32 chars)

**Query Parameters:**
- `tokenId` (optional) — Filter by token
- `days` (default: 180) — Number of days of history

**Response:**
```json
{
  "wallet": "ABC123...XYZ",
  "tokenId": "META...:1399811149",
  "series": [
    { "t": 1707660000000, "balance": 15000.5, "balanceUsd": 7500.25 }
  ]
}
```

### GET `/api/holders/changes`

Computes new and lost holders between two snapshots.

**Query Parameters:**
- `tokenId` (optional) — Filter by token
- `from` (optional) — Start snapshot ISO timestamp
- `to` (optional) — End snapshot ISO timestamp
- `limit` (default: 100, max: 500) — Max holders per category

If `from`/`to` are omitted, compares the two most recent snapshots.

**Response:**
```json
{
  "tokenId": "META...:1399811149",
  "fromSnapshot": "2024-02-10T12:00:00.000Z",
  "toSnapshot": "2024-02-11T12:00:00.000Z",
  "newHolders": [
    { "wallet": "NEW123...ABC", "balance": 5000, "balanceUsd": 2500 }
  ],
  "lostHolders": [
    { "wallet": "LOST456...DEF", "balance": 1000, "balanceUsd": 500 }
  ],
  "newCount": 15,
  "lostCount": 8
}
```

## Data Retention

Currently, all snapshots are retained indefinitely. For high-frequency snapshots, consider implementing a retention policy:

```sql
-- Example: Remove holder_balances older than 1 year
DELETE FROM holder_balances WHERE as_of < NOW() - INTERVAL '1 year';

-- Example: Keep only daily snapshots for data older than 30 days
DELETE FROM holder_balances hb
WHERE as_of < NOW() - INTERVAL '30 days'
  AND EXISTS (
    SELECT 1 FROM holder_balances hb2
    WHERE hb2.token_id = hb.token_id
      AND hb2.wallet_address = hb.wallet_address
      AND DATE(hb2.as_of) = DATE(hb.as_of)
      AND hb2.as_of > hb.as_of
  );
```

## Demo Mode

When `DATABASE_URL` is not configured, all endpoints return synthetic demo data with a `note` field indicating demo mode. This allows the UI to function without a database for local development.
