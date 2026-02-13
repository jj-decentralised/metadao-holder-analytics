# Network Analysis Approaches for Token Holder Data

Research document exploring network analysis techniques applicable to MetaDAO token holder analytics, including wallet clustering, social graphs, and cross-token holder networks.

## 1. Wallet Clustering / Sybil Detection

### Problem Statement
Multiple wallets may be controlled by the same entity (Sybil wallets), inflating holder counts and distorting decentralization metrics. Identifying these clusters reduces the effective holder count to unique entities.

### Detection Approaches

#### 1.1 Source Funding Analysis
The most fundamental technique identifies wallets funded from the same source:
- Track initial fund transfers from exchange hot wallets or funding addresses
- Wallets receiving funds from the same source address in similar amounts/timeframes are candidate clusters
- **Limitation**: Sophisticated actors fund wallets individually from exchanges to circumvent this

#### 1.2 Behavioral Pattern Matching (Jaccard Similarity)
Compare on-chain activity sequences between wallets:
- Transform raw activity into per-wallet sequences (contracts interacted, methods called)
- Compute pairwise Jaccard similarity index
- Wallets with >50% similarity threshold are flagged as potential Sybil clusters

**Implementation with Codex API:**
```typescript path=null start=null
// Use getTokenEventsForMaker to build activity sequences per wallet
const events = await codex.getTokenEvents(tokenAddress, networkId, from, to);
// Group by maker address, compute similarity matrix
```

#### 1.3 Temporal Correlation Detection
Identify coordinated behavior through timing analysis:
- Trading at same timestamps (within seconds/minutes)
- Identical transaction sequences with time offsets
- The Louvain Community Detection Algorithm can identify behavioral clusters by mapping transactions to unique IDs based on timing, cadence, and action

#### 1.4 Graph-Based Clustering
- **Weakly Connected Components (WCC)**: Initial grouping of wallets with transfer relationships
- **Louvain/Leiden Refinement**: Further decompose large clusters into communities
- **Radial Patterns**: Single funder → many recipients (star topology)
- **Sequential Patterns**: Chain of wallets passing funds linearly

### Sybil Typologies

1. **Radial Pattern**: Single wallet funds many wallets that engage in coordinated actions
2. **Sequential Pattern**: Chain of wallets with linear fund transfers
3. **CEX Obfuscation**: Funding through exchange deposits/withdrawals to break graph links

### Academic References
- Victor (2019): Ethereum address clustering method to identify addresses belonging to the same entity
- Payette et al.: Feature analysis of Ethereum address space for distinguishing normal vs. abnormal behaviors
- [arxiv:2209.04603](https://arxiv.org/pdf/2209.04603): Sybil detection methodology used by Arbitrum and Hop protocols

---

## 2. Holder Network Graph

### Graph Construction
- **Nodes**: Wallet addresses
- **Edges**: 
  - Shared token holdings (bipartite projection)
  - Direct transfer relationships
  - Co-occurrence in same transactions

### Network Metrics

| Metric | Description | Token Holder Interpretation |
|--------|-------------|----------------------------|
| **Degree Centrality** | Number of connections | Wallets holding many tokens in common with others |
| **Betweenness Centrality** | Bridge position in network | "Connector" wallets linking different holder communities |
| **Clustering Coefficient** | Local connectivity density | Tightness of holder subcommunities |
| **Eigenvector Centrality** | Influence based on neighbor influence | Whales connected to other whales |

### Category-Specific Topology Hypotheses

**Futarchy/Governance Tokens:**
- Expected: Higher clustering, denser interconnections
- Rationale: Governance participants likely hold multiple related tokens

**Meme Tokens:**
- Expected: Lower clustering, more isolated holders
- Rationale: Speculative, less community overlap

**MetaDAO Ecosystem Tokens:**
- Expected: Central hub structure with high betweenness nodes
- Rationale: Core community holds multiple ecosystem tokens

### Implementation Approach
```typescript path=null start=null
// Build bipartite graph: wallets ↔ tokens
// Project to wallet-wallet graph weighted by shared holdings
// Use graphology or NetworkX for metric computation
import { louvain } from 'graphology-communities-louvain';
```

---

## 3. Cross-Token Holder Overlap Matrix

### Methodology

Build an 88×88 similarity matrix comparing holder overlap between token pairs:

**Jaccard Similarity Index:**
```
J(A,B) = |Holders(A) ∩ Holders(B)| / |Holders(A) ∪ Holders(B)|
```

### Data Collection Pipeline

```typescript path=null start=null
// For each token pair:
const holdersA = await codex.getHolders(tokenA);
const holdersB = await codex.getHolders(tokenB);
const intersection = holdersA.filter(h => holdersBSet.has(h.address));
const jaccard = intersection.length / (holdersA.length + holdersB.length - intersection.length);
```

### Clustering Analysis
- Apply hierarchical clustering to similarity matrix
- Visualize as dendrogram or heatmap
- Identify token clusters with high internal similarity

### Hypothesis Testing
- **H1**: MetaDAO ecosystem tokens (governance, futarchy) share more holders than random pairs
- **H2**: Meme tokens form isolated clusters with minimal overlap to utility tokens
- **H3**: Category membership predicts holder overlap better than market cap similarity

---

## 4. Whale Network Analysis

### Whale Definition
Wallets exceeding threshold ownership:
- Top 10 holders per token
- >1% ownership of circulating supply
- >$10,000 USD value held

### Cross-Token Whale Tracking

```typescript path=null start=null
// For each whale, track presence across all 88 tokens
const whaleProfile = {
  address: string,
  holdings: Map<tokenAddress, { balance, percentOwned, rank }>,
  totalValueUsd: number,
  tokenCount: number
};
```

### Whale Influence Score
Composite metric capturing whale significance:

```
WhaleInfluence = Σ(tokenWeight_i × percentOwned_i × activityScore_i)

where:
- tokenWeight = log(marketCap) or liquidity-based weight
- activityScore = normalized trading frequency
```

### Coordination Analysis
- Do whale buy/sell events cluster temporally across tokens?
- Network graph of whale co-holdings
- Identify "whale cartels" holding similar portfolios

---

## 5. Token Holder Communities

### Community Detection Algorithms

#### Louvain Algorithm
Greedy modularity optimization:
- Iteratively assigns nodes to communities maximizing internal edge density
- Hierarchical: produces multi-level community structure
- Fast: O(n log n) for sparse graphs
- **Limitation**: May produce disconnected communities

#### Leiden Algorithm (Recommended)
Improvement over Louvain:
- Guarantees internally connected communities
- Better convergence properties
- Faster execution on large networks

### Proposed Community Archetypes

| Community | Characteristics | Detection Signals |
|-----------|-----------------|-------------------|
| **DeFi Degens** | High activity, many tokens, high turnover | High tx count, short hold times |
| **MetaDAO Believers** | Governance participation, long holds | Futarchy token concentration |
| **Meme Traders** | Volatile holdings, quick exits | Short hold duration, meme token focus |
| **Passive Holders** | Low activity, stable positions | Low tx frequency, long hold times |
| **Institutional** | Large positions, few tokens | High USD value, professional patterns |

### Mapping Communities to Token Categories
- After community detection, compute category affinity scores
- Statistical test: Are communities significantly associated with token categories?

---

## 6. Contagion and Cascade Effects

### Flow-of-Funds Analysis
Track capital movement when holders exit positions:

```typescript path=null start=null
// For exit events from token A:
// 1. Identify wallets selling token A
// 2. Track subsequent buys in other tokens
// 3. Build transition probability matrix
```

### Transition Matrix
For each source token, compute probability distribution of destination tokens:
```
P(destination | source) = count(source→destination) / total_exits(source)
```

### Academic Framework
Financial contagion models from traditional finance:
- **Correlation-based contagion**: Price movements propagate through holder networks
- **Liquidity spirals**: Forced selling creates cascade effects
- **Information cascades**: Whale exits signal negative information to market

### Metrics
- **Contagion coefficient**: Rate of holder loss propagation between tokens
- **Exit velocity**: Speed at which holders leave after neighboring token decline
- **Safe havens**: Tokens that receive inflows during market stress

---

## 7. Influence Propagation

### Lead-Lag Relationships
Do whale buys in one token predict buying in related tokens?

**Methodology:**
1. Compute daily holder growth rate per token
2. Cross-correlation analysis with time lags (1-7 days)
3. Granger causality tests between token pairs

### Granger Causality
Test whether holder growth in token A helps predict holder growth in token B:
```
HolderGrowth_B(t) = α + Σβ_i × HolderGrowth_B(t-i) + Σγ_j × HolderGrowth_A(t-j) + ε
```
If γ coefficients are jointly significant, A "Granger-causes" B.

### Expected Findings
- Core ecosystem tokens likely lead peripheral tokens
- Whale activity in liquid tokens may precede retail flows to smaller tokens
- Governance token dynamics may lead associated market tokens

---

## 8. Academic Frameworks

### Relevant Literature

**Blockchain Network Analysis:**
- **Makarov & Schoar (2021)**: "Blockchain Analysis of the Bitcoin Market" - Foundational work on linking blockchain addresses to entities, analyzing network structure and ownership concentration
- Key finding: Bitcoin ecosystem dominated by large, concentrated players; developed methodology for entity identification

**Social Network Analysis in Financial Markets:**
- **Ozsoylev et al. (2014)**: Social networks influence trading behavior and information flow
- Social learning and sentiment contagion affect market dynamics
- Network position correlates with information access and trading profitability

**Sybil Detection:**
- **SybilGuard, SybilLimit, SybilRank**: Graph-based techniques using social trust
- **DBSCAN clustering**: Density-based clustering for identifying behavioral clusters
- Machine learning approaches combining graph features with behavioral signals

### Adapting to Token Markets
Key differences from traditional markets:
1. **Pseudonymity**: Addresses not directly linked to identities
2. **Transparency**: Full transaction history publicly available
3. **Composability**: Wallets interact across multiple protocols
4. **Low barriers**: Easy to create multiple wallets

---

## 9. Implementation with Codex API

### Available Data Points

| API Method | Data Returned | Network Analysis Use |
|------------|---------------|---------------------|
| `getHolders(tokenAddress)` | Top holders with addresses, balances | Node list construction |
| `getTokenEvents(address)` | Trading events with maker, timestamp | Temporal behavior analysis |
| `getWalletStats(walletAddress)` | Total tokens, PnL | Whale identification |
| `filterTokenWallets(filters)` | Filtered holders by balance/percent | Threshold-based segmentation |

### Proposed Data Pipeline

```typescript path=null start=null
// Phase 1: Data Collection
const holderData = await Promise.all(
  tokens.map(t => codex.getHolders(t.address))
);

// Phase 2: Graph Construction
const walletTokenGraph = buildBipartiteGraph(holderData);
const walletGraph = projectToWalletGraph(walletTokenGraph);

// Phase 3: Community Detection
const communities = louvain(walletGraph);

// Phase 4: Sybil Detection
const sybilClusters = detectSybils(holderData, eventData);

// Phase 5: Metrics Computation
const networkMetrics = computeCentrality(walletGraph);
```

### Rate Limiting Considerations
Codex API has rate limits (30 requests/second configured in client):
- Batch requests where possible (getTokensBatch)
- Cache holder data aggressively
- Incremental updates rather than full refresh

---

## 10. Recommended Implementation Phases

### Phase 1: Cross-Token Overlap Matrix
- **Effort**: Low
- **Value**: High
- **Dependencies**: Holder data only
- Build 88×88 Jaccard similarity matrix, visualize clusters

### Phase 2: Whale Network Graph
- **Effort**: Medium
- **Value**: High
- **Dependencies**: Holder data + price data
- Track top holders across tokens, build influence graph

### Phase 3: Sybil Detection (Basic)
- **Effort**: Medium
- **Value**: Medium
- **Dependencies**: Event data
- Temporal correlation + funding source analysis

### Phase 4: Community Detection
- **Effort**: Medium
- **Value**: High
- **Dependencies**: Phase 1 completion
- Apply Leiden algorithm to holder overlap graph

### Phase 5: Contagion Analysis
- **Effort**: High
- **Value**: Medium
- **Dependencies**: Historical event data
- Build transition matrices, model cascade effects

### Phase 6: Advanced Sybil Detection
- **Effort**: High
- **Value**: High
- **Dependencies**: Full event history
- Behavioral clustering, ML-based classification

---

## References

1. Makarov, I. & Schoar, A. (2021). "Blockchain Analysis of the Bitcoin Market." NBER Working Paper 29396.
2. Blondel, V.D. et al. (2008). "Fast unfolding of communities in large networks." J. Stat. Mech. P10008.
3. Traag, V.A. et al. (2019). "From Louvain to Leiden: guaranteeing well-connected communities." Scientific Reports 9, 5233.
4. Victor, F. (2019). "Address Clustering in Ethereum." Financial Cryptography and Data Security.
5. Wormhole Foundation. (2024). "From Eligibility to Sybil Detection: Multichain Airdrop Methodology."
6. Arbitrum Foundation. "Sybil Detection Program." GitHub repository.
