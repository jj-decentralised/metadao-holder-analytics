# Alternative/Complementary Data Sources for Solana Token Holder Analytics

Last updated: 2026-02-12

Scope: Evaluate Helius and SolanaFM as alternatives/complements to our current Codex usage and to direct Solana JSON-RPC for token holder analytics (holder lists, distributions, and time series), plus architecture and caching recommendations.

---

## 1) Helius API

### 1.1 getTokenAccounts — can it provide holder lists?
- Yes. DAS `getTokenAccounts` supports querying by `mint` or `owner`. When called with a token mint, it returns all token accounts for that mint with the account `owner` and `amount`, along with pagination metadata. This can be used to build a full holder list (dedupe by owner if you only want wallet-level holders).
- Docs: https://www.helius.dev/docs/api-reference/das/gettokenaccounts

Notes
- Response also includes `last_indexed_slot`, which is useful for freshness tracking and incremental backfills.

### 1.2 getAssetsByOwner — wallet portfolio data
- DAS `getAssetsByOwner` returns all assets (SPL tokens, Token-2022, NFTs, compressed NFTs) held by a wallet in a unified schema, with pagination/sorting.
- Docs: https://www.helius.dev/docs/api-reference/das/getassetsbyowner

### 1.3 Historical balance tracking capabilities
- Helius-exclusive `getTransactionsForAddress` provides historical transactions with advanced filtering and, crucially, the option to include a wallet’s associated token accounts via `tokenAccounts: "balanceChanged" | "all"`. This enables reconstructing token balance time series per wallet (and, with aggregation, per mint).
- Docs: https://www.helius.dev/docs/rpc/gettransactionsforaddress
- Enhanced Transactions and webhooks payloads include `tokenBalanceChanges` for per-tx delta-based tracking.
  - Webhooks overview: https://www.helius.dev/docs/webhooks
  - Enhanced Transactions by address: https://www.helius.dev/docs/api-reference/enhanced-transactions/gettransactionsbyaddress

### 1.4 DAS (Digital Asset Standard) API features
- Unified interface across NFTs, compressed NFTs, SPL tokens and Token-2022; supports fungible token queries and price data (price responses are cached ~600s).
  - DAS overview: https://www.helius.dev/docs/das-api
  - Fungible Token extension: https://www.helius.dev/docs/das/fungible-token-extension
  - Getting assets + price cache note: https://www.helius.dev/docs/das/get-nfts

### 1.5 Webhook capabilities for holder changes
- Helius Webhooks support Raw and Enhanced Transaction events for monitored addresses. Enhanced payloads include `tokenBalanceChanges { mint, tokenAccount, userAccount, rawTokenAmount }` allowing ingestion of holder changes by mint/account in near-real-time. Retry and duplicate-delivery semantics are documented.
  - Webhooks: https://www.helius.dev/docs/webhooks
  - Real‑time streaming overview (Enhanced WebSockets + Webhooks): https://www.helius.dev/solana-webhooks

Practical notes
- For “all holders” state, combine `getTokenAccounts(mint=...)` for baseline + webhooks to stream deltas going forward.

### 1.6 Pricing tiers and rate limits (headline)
- Public pricing (Feb 2026): Free (1M credits, 10 RPS), Developer ($49/mo, 10M credits, 50 RPS), Business ($499/mo, 100M credits, 200 RPS), Professional ($999/mo, 200M credits, 500 RPS), Enterprise (custom). Per‑endpoint caps include `getProgramAccounts` per‑second limits and separate DAS RPS caps.
- Dedicated nodes “from $2,900/mo”.
- Pricing: https://www.helius.dev/pricing

---

## 2) SolanaFM API

### 2.1 Token holder analytics endpoints
- Holders for a mint (paginated): `GET /v1/tokens/{mint}/holders` — returns token accounts for the mint (includes owner accounts and balances).
  - Docs: https://docs.solana.fm/reference/get_token_accounts_for_token_mint

### 2.2 Historical transfer data
- Account-level transfers: `GET /v0/accounts/{hash}/transfers`.
- Per-transaction transfers: `GET /v0/transfers/{hash}`.
  - Docs: https://docs.solana.fm/reference/get_account_transfers_v1, https://docs.solana.fm/reference/get_transfers

### 2.3 Account monitoring
- Public docs focus on REST endpoints (accounts, tokens, transfers). No publicly documented push/webhook product in the current API reference; polling or external streaming would be required.
  - Dev Hub: https://docs.solana.fm/

### 2.4 Any time‑series holder data available?
- No dedicated “holders over time” endpoint is documented. Time series can be derived from transfer history and first‑seen timestamps per owner account.

### 2.5 Rate limits
- SolanaFM publishes per‑tier and per‑endpoint rate limits; see their “Rate Limits” page. (Exact caps may change.)
  - Docs: https://docs.solana.fm/reference/rate-limits-1

---

## 3) Solana RPC Direct

### 3.1 Useful RPC methods
- `getTokenLargestAccounts` — top 20 largest token accounts for a mint (useful for top-holder snapshot).
  - Docs: https://solana.com/docs/rpc/http/gettokenlargestaccounts
- `getTokenAccountsByOwner` — all token accounts owned by a wallet (portfolio-style view).
  - Docs: https://solana.com/docs/rpc/http/gettokenaccountsbyowner
- `getProgramAccounts` — enumerate all accounts owned by a program; with SPL Token program + `dataSize`/`memcmp` filters, can enumerate all token accounts for a mint (heavy, must paginate/chunk on large mints).
  - Docs: https://solana.com/docs/rpc/http/getprogramaccounts
- WebSockets (`accountSubscribe`, `logsSubscribe`, etc.) are available for real‑time monitoring if you manage your own connection + backoff.
  - WS docs index/examples: https://solana.com/docs/rpc/websocket/accountsubscribe, https://solana.com/docs/rpc/websocket/logssubscribe

### 3.2 Rate limits — public vs private RPC
- Solana Labs public endpoints are rate‑limited and “not intended for production applications.” Example (as documented): ~100 requests / 10s / IP overall, ~40 / 10s / IP per single RPC, with other limits on connections and data volume; limits can change without notice.
  - Docs: https://solana.com/docs/core/clusters
- Private RPC from vendors typically lifts limits and adds SLAs; some providers also impose method‑level caps (e.g., `getTokenLargestAccounts` caps on certain providers).

### 3.3 Cost of running your own RPC node (high‑level)
- Hardware guidance for RPC nodes commonly targets 16–32+ cores CPU and 512GB+ RAM with multiple high‑end NVMe SSDs; bare‑metal/dedicated deployments are typical for production. Expect $1k–$3k+/mo for capable bare‑metal or managed dedicated nodes depending on specs/region; cloud at similar performance can be higher. For a managed alternative, Helius dedicated nodes list “from $2,900/mo”.
  - References: Official hardware guidance summaries and operator write‑ups: 
    - https://slv.dev/en/doc/mainnet-validator/operational-notes/
    - https://www.withtap.com/fr/blog/run-a-solana-node (RPC section)
    - Helius pricing (dedicated nodes): https://www.helius.dev/pricing

---

## 4) Comparison Summary (Codex vs Helius vs SolanaFM vs Direct RPC)

Dimensions that matter for holder distribution analytics:

- Holder list completeness
  - Codex: Offers a `holders` query with `count` and `top10HoldersPercent`, but docs note holder count may exclude wallets that only received direct transfers/airdrops until they perform a swap. Best for quick distribution insights; verify coverage for your token.
    - Docs: https://docs.codex.io/api-reference/queries/holders
  - Helius (DAS): `getTokenAccounts(mint=...)` returns all token accounts (owner + amount), suitable for authoritative holder sets.
  - SolanaFM: `GET /v1/tokens/{mint}/holders` returns token accounts for the mint (paginated).
  - Direct RPC: `getProgramAccounts` (Token program) can enumerate all token accounts; operationally heavy and requires pagination + filtering.

- Historical/time‑series holders
  - Codex: `holders.items.firstHeldTimestamp` enables an adoption‑curve approximation without doing your own replay, but may miss non‑swap acquisitions per docs caveat.
  - Helius: Use `getTransactionsForAddress` with `tokenAccounts: balanceChanged` to reconstruct balances over time per wallet; combine across wallets for per‑mint series. Enhanced webhooks `tokenBalanceChanges` help stream deltas.
  - SolanaFM: Use Account Transfers + holders endpoint to derive daily distinct holders; no native time‑series endpoint documented.
  - Direct RPC: Requires scanning signatures/transactions per account and reconstructing state.

- Real‑time monitoring
  - Helius: Webhooks (raw/enhanced) and Enhanced WebSockets; production‑ready with retries and parsed payloads.
  - SolanaFM: No public webhooks in current docs; poll REST or build your own WS/Geyser stream.
  - Direct RPC: Native WS subscriptions available, but you must manage resiliency, parsing, and backoff yourself.

- Latency & developer UX (qualitative)
  - Codex: High‑level GraphQL with holders/aggregates out of the box.
  - Helius: Rich DAS + historical + webhooks; broad coverage; clear quotas.
  - SolanaFM: Straightforward REST for holders/transfers, good for explorer‑style queries.
  - Direct RPC: Lowest abstraction; fastest if colocated + tuned; highest ops burden.

- Cost / limits (snapshot)
  - Codex: Commercial GraphQL; pricing by requests (see vendor site for current tiers).
  - Helius: Transparent credit + RPS tiers; separate DAS and heavy‑call caps; dedicated nodes available.
  - SolanaFM: Rate limits documented per tier; pricing not publicly listed in docs.
  - Direct RPC: Infra cost + ops; or pay a managed RPC vendor.

Takeaway for our use case
- For accurate holder distributions (all holders, not just top N), prioritize a source that enumerates all token accounts (Helius DAS or Direct RPC). Use Codex for fast precomputed insights where acceptable, with awareness of the “swap‑only until first swap” caveat in their holders dataset.

---

## 5) Recommended Architecture

Primary sources by metric
- Holder list (canonical): Helius DAS `getTokenAccounts(mint)` → aggregate by owner to build the holder set and balances.
- Top holders (quick): Direct RPC `getTokenLargestAccounts` (top 20) or Codex `holders` for deeper pages when speed matters.
- Wallet portfolios: Helius DAS `getAssetsByOwner` (backup: Solana RPC `getTokenAccountsByOwner`, SolanaFM Owner Token Accounts).
- Holder time series: Start with Codex `firstHeldTimestamp` to seed an adoption curve; backfill/verify via Helius `getTransactionsForAddress` + Enhanced Transactions/webhooks to ensure completeness for a given mint.

Fallback strategy
- If DAS `getTokenAccounts` throttles or is unavailable, fall back to:
  1) SolanaFM `GET /v1/tokens/{mint}/holders` (paginate), else
  2) Direct RPC `getProgramAccounts` with SPL Token filters (chunked).
- For historical scans that exceed API quotas, shard by time/slot windows and implement backoff + resume cursors (both Helius and SolanaFM provide pagination tokens where applicable).

Caching approach (guidelines)
- Hot paths (top 20 holders, holder count): cache 1–5 minutes; invalidate on webhook‑detected supply or major holder change events.
- Full holder distribution snapshots: cache 15–60 minutes for active tokens; 6–24 hours for inactive/legacy mints. Store last `last_indexed_slot` to gate refreshes.
- Historical time‑series: treat as append‑only; recompute only the last N hours/days as new deltas arrive from webhooks.
- Implement per‑provider request budgeting with jittered backoff; batch by mint/owner where APIs support bulk.

Implementation notes
- Normalize by owner (wallet) when counting holders; a single wallet can have multiple token accounts.
- Exclude program‑owned or liquidity pool accounts when computing circulating‑holder distributions if your metric definition requires it; maintain a blocklist of known program/pool owners.

