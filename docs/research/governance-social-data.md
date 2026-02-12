# Governance & Social Activity Data Sources for Solana Tokens

Research document covering data sources for governance participation, social metrics, and on-chain governance analytics for Solana tokens, with specific focus on MetaDAO futarchy.

---

## 1. Realms (SPL Governance)

### Overview
Realms is the primary DAO governance platform on Solana, built on the SPL Governance program maintained by Solana Labs. It provides tools for creating DAOs, managing treasuries, and voting on proposals.

### Data Available
- **Proposals**: Title, description, state (draft, voting, executing, completed, defeated)
- **Vote Records**: Casted voting weight, vote type (approve/disapprove/veto), voter address
- **Token Owner Records**: Deposited governance tokens, voting power
- **Realm Configuration**: Voting thresholds, quorum requirements, voting periods

### Data Access Methods

#### 1. Shyft GraphQL API (Recommended)
- **Endpoint**: `https://programs.shyft.to/v0/graphql/?api_key={api-key}&network=mainnet-beta`
- **Features**:
  - Get DAO token owners
  - Get proposals for governing mint
  - Get all proposals for DAO
  - Get DAO treasury info
  - Get all active proposals for wallet
- **Rate Limits**: Varies by plan (free tier available)
- **Docs**: https://docs.shyft.to/solana-indexers/case-studies/solana-governance-realms

#### 2. Direct On-Chain Queries (via RPC)
Query SPL Governance program accounts directly:
- **Program ID**: `GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw`
- Parse proposal accounts, vote records, and realm configurations
- Requires understanding of account data structures

#### 3. Realms UI API
- The Realms web interface (realms.today) has internal APIs
- Not officially documented for external use
- Can be reverse-engineered from network requests

### Key Data Points for Analytics
- Voter turnout rate: (unique voters / eligible token holders) × 100
- Proposal pass rate: (passed proposals / total finalized proposals) × 100
- Average voting participation per proposal
- Vote concentration (Gini coefficient of voting power)

---

## 2. MetaDAO Futarchy Governance

### Overview
MetaDAO implements futarchy governance on Solana, where decisions are made through prediction markets rather than traditional voting. The Autocrat program orchestrates the futarchy process.

### Program Architecture
- **Autocrat Program**: `meta3cxKzFBmWYgCVozmvCQAS3y9b3fGxrG9HkHL7Wi` (v0)
- **Conditional Vault**: `vaU1tVLj8RFk7mNj1BxqgAsMKKaL8UvEUHvU3tdbZPe` (v0)
- **AMM Program**: For trading pass/fail conditional tokens

### Data Access Methods

#### 1. Futarchy TypeScript SDK (Official)
```bash
npm install @metadaoproject/futarchy-sdk
```

```typescript
import { FutarchyRPCClient, AUTOCRAT_VERSIONS } from "@metadaoproject/futarchy-sdk";
import { AnchorProvider } from "@coral-xyz/anchor";

const provider = new AnchorProvider(connection, wallet, {});
const programVersion = AUTOCRAT_VERSIONS[0];
const client = FutarchyRPCClient.make(programVersion, provider);

// Fetch proposals
const proposals = await client.daos.fetchProposals(daoAddress);
```

**Available Methods**:
- Fetch DAOs and their configurations
- Retrieve proposals with conditional vaults
- Query token balances (DAO tokens and conditional tokens)
- Get TWAP oracle data

**Docs**: https://docs.metadao.fi/implementation/program-architecture

#### 2. Direct On-Chain Queries
Parse Autocrat program accounts for:
- Proposal accounts (number, description link, SVM instruction, state)
- Conditional vault data
- Pass/fail market TWAP prices
- Finalization outcomes

#### 3. Futarchy.metadao.fi Interface
- Web interface at https://futarchy.metadao.fi
- Shows organizations, proposals, and trading activity
- Internal APIs can be monitored for data endpoints

### Key Metrics for MetaDAO Analytics
- **TWAP Differential**: Pass market TWAP vs fail market TWAP
- **Proposal Outcome**: Pass if TWAP(pass) > TWAP(fail) × (1 + threshold%)
- **Trading Volume**: Total conditional token volume per proposal
- **Liquidity Depth**: AMM liquidity in pass/fail markets
- **Participation**: Number of unique traders per proposal
- **Historical Pass Rate**: Percentage of proposals that passed

### Comparison Metrics (Futarchy vs Traditional Voting)
| Metric | Realms (Traditional) | MetaDAO (Futarchy) |
|--------|---------------------|-------------------|
| Decision Mechanism | Token-weighted voting | Prediction market prices |
| Participation Incentive | Governance rewards (optional) | Financial profit/loss |
| Time to Decision | Fixed voting period | Trading period + TWAP calculation |
| Whale Resistance | Low (direct vote power) | Medium (market dynamics) |

---

## 3. Social Metrics Data Sources

### CoinGecko API

#### Overview
CoinGecko provides comprehensive social and developer metrics for tracked tokens.

#### Social Data Available
- Twitter/X followers count
- Reddit subscribers
- Facebook likes
- Telegram channel members
- Discord members (when available)

#### Developer Data Available
- GitHub commits (4 weeks)
- GitHub contributors
- GitHub stars, forks
- Pull requests merged
- Lines added/deleted

#### API Endpoints
```javascript
// Get coin data including social stats
GET https://api.coingecko.com/api/v3/coins/{id}

// Response includes:
// - community_data: twitter_followers, reddit_subscribers, etc.
// - developer_data: forks, stars, subscribers, total_issues, etc.
```

#### Pricing & Rate Limits
| Plan | Rate Limit | Monthly Calls | Price |
|------|------------|---------------|-------|
| Demo (Free) | 30 calls/min | 10,000 | Free |
| Analyst | 500 calls/min | Varies | Paid |
| Pro | Higher limits | Unlimited | Paid |

**Docs**: https://docs.coingecko.com/reference/coins-id

### Twitter/X API

#### Official X API
- **Engagement API** (Enterprise): Impressions, engagements, favorites, replies, retweets, quote tweets, video views
- **User Lookup**: Follower counts, following counts, tweet counts
- **Limitations**: Analytics dashboard exclusive to Premium subscribers

#### Rate Limits
- Basic tier: Very limited
- Pro/Enterprise: Higher limits for engagement metrics

#### Third-Party Alternatives
- **TwitterAPI.io**: More affordable, supports competitor analysis
- **Tweet Hunter**: Free metrics calculator for public profiles
- **Metricool**: Historical tracking, engagement analysis

### Discord API
Discord does not provide a public API for member counts. Options:
- **Invite Link Widgets**: Some servers expose member counts via invite widgets
- **Bot Integration**: Custom bots can track member counts if added to servers
- **Statbot**: Third-party Discord analytics bot

### GitHub API

#### Available Endpoints
```bash
# Repository statistics
GET /repos/{owner}/{repo}/stats/contributors
GET /repos/{owner}/{repo}/stats/commit_activity
GET /repos/{owner}/{repo}/stats/code_frequency

# Repository info
GET /repos/{owner}/{repo}
# Returns: stars, forks, open_issues, subscribers
```

#### Rate Limits
- **Unauthenticated**: 60 requests/hour
- **Authenticated**: 5,000 requests/hour
- **GitHub Actions**: 1,000 requests/hour per repository

#### Key Metrics
- Total commits (historical and recent)
- Unique contributors
- Code frequency (additions/deletions per week)
- Stars, forks, watchers
- Issue/PR activity

**Docs**: https://docs.github.com/en/rest/metrics/statistics

---

## 4. On-Chain Analytics Platforms

### Dune Analytics

#### Overview
SQL-based platform for querying Solana blockchain data. Supports governance and DAO analysis.

#### Solana Tables
- `solana.transactions`: All transaction data
- `solana.instruction_calls`: Decoded instructions
- Protocol-specific decoded tables (when available)

#### Governance Use Cases
- Track DAO proposals and voting patterns
- Analyze treasury movements
- Monitor voter concentration

#### Pricing
| Plan | Credits/Month | Query Engine |
|------|---------------|--------------|
| Free | Limited | Community |
| Analyst | More | Faster |
| Premium | Highest | Priority |

**Docs**: https://docs.dune.com/data-catalog/solana/overview

### Flipside Crypto

#### Overview
Alternative to Dune with broader L1 coverage. Uses standard SQL dialect.

#### Solana Support
- `solana.core.fact_transactions`
- Raw transaction and instruction data
- Less pre-built governance tables than Dune

#### Trade-offs vs Dune
- **Dune**: Better UI, more community dashboards, EVM-focused
- **Flipside**: Wider L1 coverage, more raw data access, better for custom pipelines

### Helius API

#### Overview
Premier Solana infrastructure provider with comprehensive token and account APIs.

#### Relevant Endpoints
```javascript
// Get token holders
const response = await fetch(url, {
  method: "POST",
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "getTokenAccounts",
    params: {
      mint: "TOKEN_MINT_ADDRESS",
      page: 1,
      limit: 1000
    }
  })
});

// Get assets by owner (DAS API)
// Returns NFTs, fungible tokens, SOL balance
```

#### Pricing
| Plan | Requests/Month | Features |
|------|----------------|----------|
| Free | 500,000 | Basic RPC + DAS |
| Starter | Higher | Webhooks, Priority |
| Pro | Unlimited | Dedicated nodes |

**Docs**: https://www.helius.dev/docs/das-api

---

## 5. Data Integration Summary

### Recommended API Stack for Governance Analytics

| Data Type | Primary Source | Backup Source |
|-----------|---------------|---------------|
| Realms Proposals | Shyft GraphQL | Direct RPC |
| MetaDAO Futarchy | Futarchy SDK | Direct RPC |
| Token Holders | Helius DAS API | getProgramAccounts |
| Social (Twitter) | CoinGecko | TwitterAPI.io |
| Social (Discord) | Manual/Statbot | N/A |
| Developer Activity | GitHub API | CoinGecko |
| On-Chain Analytics | Dune/Flipside | Custom Indexer |

### Implementation Priority

1. **Phase 1: Core Governance Data**
   - Integrate Futarchy SDK for MetaDAO proposals
   - Query Shyft for Realms voting data
   - Build proposal comparison dashboard

2. **Phase 2: Social Metrics**
   - CoinGecko API for Twitter/Reddit/GitHub stats
   - GitHub API for detailed developer metrics
   - Manual Discord member tracking

3. **Phase 3: Advanced Analytics**
   - Dune/Flipside dashboards for on-chain governance
   - Voter concentration analysis
   - Cross-DAO participation metrics

### Rate Limit Considerations

| API | Free Tier Limit | Recommended Caching |
|-----|-----------------|---------------------|
| CoinGecko | 30/min, 10K/month | 15-minute cache |
| GitHub | 60/hour (unauth) | 1-hour cache |
| Helius | 500K/month | As needed |
| Shyft | Varies | 5-minute cache |
| Dune | Query credits | Pre-compute dashboards |

---

## 6. Data Quality Notes

### Freshness
- **CoinGecko social data**: Updated every few hours
- **On-chain governance**: Real-time via RPC, minutes via indexed APIs
- **GitHub stats**: Cached by GitHub, may lag by hours

### Completeness
- **MetaDAO**: All data on-chain, fully accessible
- **Realms**: All data on-chain, well-indexed by Shyft
- **Social**: Dependent on external platforms, may have gaps

### Accuracy Concerns
- Twitter follower counts can include bots
- Discord member counts don't reflect active users
- GitHub stats exclude private repositories

---

## 7. Next Steps

1. **Set up API keys** for CoinGecko, Helius, and Shyft
2. **Install Futarchy SDK** and test proposal queries
3. **Create Dune dashboard** for governance comparison
4. **Build caching layer** to respect rate limits
5. **Design data models** for storing historical governance metrics
