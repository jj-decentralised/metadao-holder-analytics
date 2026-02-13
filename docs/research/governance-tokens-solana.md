# Solana DeFi Governance Token Research

**Date:** February 2026  
**Purpose:** Analyze governance quality metrics for Solana DeFi tokens to establish a comparison set for MetaDAO holder analytics.

## Executive Summary

This research examines governance quality across major Solana DeFi protocols. Key findings:

1. **Governance infrastructure is maturing** - Most protocols use Realms (SPL Governance), with some innovations like multi-branch DAOs (Drift) and futarchy (MetaDAO)
2. **Participation remains a challenge** - Several protocols (Jupiter, Mango) have faced governance fatigue and centralization issues
3. **Token distribution varies significantly** - Fair-launch tokens (MNDE, META) show different dynamics than VC-backed tokens
4. **Governance models are evolving** - Jupiter paused voting in 2025, while others (Marinade, Orca) are adding participation incentives

---

## 1. Raydium (RAY)

### Governance Platform
- Uses **Realms** (SPL Governance) with voter-stake-registry plugin
- Token lockups provide vote weight benefits
- Full on-chain governance module planned for 2025

### Governance Activity
- **Status:** Governance module in development
- Raydium DAO exists but formal on-chain governance is still being rolled out
- Focus has been on protocol development (LaunchLab memecoin platform launched April 2025)

### Token Distribution
| Allocation | Percentage |
|------------|------------|
| Community (liquidity mining) | 34% |
| Team | 20% |
| Investors | 8% |
| Other | 38% |

Total supply: 555M RAY (launched February 2021)

### Governance Quality Assessment
- **Decentralization:** Medium - team-controlled initially, transitioning to DAO
- **Participation:** Low (governance still developing)
- **Platform:** Realms with custom voter-stake-registry
- **Notable:** Development funded by fee revenue, no major VC rounds after IDO

---

## 2. Orca (ORCA)

### Governance Platform
- Uses **Realms** (Governance v0)
- Hybrid model with **Governance Council** + community veto power
- Requires 100,000 ORCA to submit proposals

### Governance Structure
- **Council governance:** 4+ Council votes required for approval
- **Community veto:** 1M ORCA votes can block proposals during 2-day cooldown
- **Timeline:** 4-day discussion → 5-day voting → 2-day veto window

### Recent Governance Activity (2025)
- **April 2025:** 25% supply burn + $10M buyback proposal (passed, ORCA price +76.8%)
- **August 2025:** 55K SOL staking + 24-month ORCA buyback proposal
- Council commits to quarterly transparency reports

### Token Distribution
| Allocation | Percentage |
|------------|------------|
| Community | 42% |
| Team | 20% |
| Investors | 18% |
| Other | 20% |

VC Backers: Polychain Capital, Coinbase Ventures, Three Arrows Capital

### Governance Quality Assessment
- **Decentralization:** Medium - Council-led with community veto
- **Participation:** Moderate - Council active, community engagement through veto mechanism
- **Platform:** Realms
- **Notable:** Council-based model provides efficiency while maintaining community oversight

---

## 3. Marinade Finance (MNDE)

### Governance Platform
- Uses **Realms** (migrated from Tribeca in 2023)
- **veMNDE model** - lock MNDE for voting power
- 30-day unlocking period to exit governance

### Governance Activity
- **Active governance** since April 2022
- **128 million MNDE** locked in governance (as of 2024)
- Regular proposals on treasury management, validator selection, fee structures

### Participation Incentives (MIP-13)
- **Active Staking Rewards (ASR):** 25M MNDE allocated to governance participants in 2025
- Rewards based on voting consistency throughout the year
- Points system: votes × MNDE amount = participation points

### Token Distribution
- **Fair launch** (November 2021) - no ICO, no VC funding
- 7.5% (75M) to initial contributors (completed January 2024)
- Remainder controlled by DAO treasury

### Key Governance Features
- **Directed Stake:** veMNDE holders can direct stake to specific validators (20% of total)
- **Treasury control:** DAO controls fees and treasury
- **MIP-11:** 50% of protocol performance fees to MNDE buybacks

### Governance Quality Assessment
- **Decentralization:** High - fair launch, no VC, community-controlled
- **Participation:** High - strong incentive alignment through ASR
- **Platform:** Realms with veMNDE plugin
- **Notable:** Industry-leading governance incentives through ASR program

---

## 4. Jupiter (JUP)

### Governance Platform
- Custom voting platform (vote.jup.ag)
- DAO structure with Working Groups
- Token-weighted voting

### Current Status: GOVERNANCE PAUSED
- **June 2025:** All DAO votes paused until end of 2025
- **Reason:** "Breakdown in trust" and governance fatigue
- **Treasury (Litterbox Trust):** Sealed until 2027
- New governance model planned for 2026

### Historical Governance Issues
- **Centralization concerns:** Team member wallet held 24M+ JUP, accounting for 4.5%+ of votes
- **Token allocation:** Team received 20% of supply with vesting tokens still having voting rights
- Co-founders committed to not voting, but third co-founder continued

### What Continues During Pause
- **Active Staking Rewards (ASR):** 50M JUP per quarter to stakers
- Platform operations unchanged
- No new DAO-funded Work Groups

### Token Distribution
| Allocation | Percentage |
|------------|------------|
| Community | 50% |
| Team | 50% (includes 20% team allocation + strategic reserves) |

### Governance Quality Assessment
- **Decentralization:** Low-Medium - significant team influence caused issues
- **Participation:** Was high but led to "perpetual FUD cycle"
- **Platform:** Custom
- **Notable:** Example of governance challenges at scale; 2M+ wallets received airdrops

---

## 5. Drift Protocol (DRIFT)

### Governance Platform
- **Multi-branch DAO structure** (unique on Solana):
  1. **Realms DAO:** General protocol development
  2. **Security Council:** Protocol upgrades and security
  3. **Futarchy DAO:** Technical grants (uses MetaDAO's futarchy model)

### Governance Process
- **Discussion Period:** Up to 14 days on forum
- **Voting:** Via Realms, requires minimum token threshold
- **Self-executing:** On-chain votes directly execute decisions
- **DIPs (Drift Improvement Proposals):** Primary mechanism for changes

### Token Distribution
| Allocation | Percentage |
|------------|------------|
| Community/Ecosystem | 53%+ |
| Launch airdrop | 10% |
| Core contributors | Subject to 18-month lockup + 18-month vesting |
| Strategic partners | Advisory and infrastructure support |

Total supply: 1B DRIFT over 5-year emission schedule

### Recent Activity
- **Delegate Program:** Being developed to increase decentralization
- **Quorum debates:** Community debating appropriate quorum levels (6M DRIFT proposed)

### Governance Quality Assessment
- **Decentralization:** Medium-High - innovative multi-branch structure
- **Participation:** Growing - delegation program in early stages
- **Platform:** Realms + custom Futarchy DAO
- **Notable:** Only protocol using both Realms and MetaDAO futarchy

---

## 6. Mango Markets (MNGO)

### Status: WINDING DOWN (February 2025)

### Historical Significance
- **Pioneer:** One of first major Solana DAOs
- **1,000+ governance proposals** historically processed
- Built alongside Realms governance infrastructure

### What Happened
- **October 2022:** $110M exploit by Avraham Eisenberg (convicted April 2023)
- **September 2024:** SEC settlement - agreed to destroy MNGO tokens, pay $700K penalty
- **January 2025:** DAO voted unanimously to wind down operations
- **February 2025:** Final closure

### Governance Structure (Historical)
- Used **Realms**
- 3-day max voting time
- Tiered proposal thresholds (7.5M MNGO for program upgrades)
- 7-person developer council (1M MNGO minimum per member)

### Token Distribution (Historical)
- Public IDO distribution
- 3.9B MNGO locked in smart contract, only accessible via DAO votes
- Treasury held $260M at peak ($44M SOL at wind-down)

### Governance Quality Assessment (Historical)
- **Decentralization:** High - public IDO, broad distribution
- **Participation:** High historically, but centralized decision-making in crisis
- **Platform:** Realms
- **Notable:** Cautionary tale for DAO governance - SEC classified MNGO as security

---

## 7. Solend (SLND)

### Governance Platform
- Uses **Realms** (govern.solend.fi)
- Token-weighted voting

### Governance Controversy (June 2022)
The "whale" incident exposed governance weaknesses:
- Single user held 95% of SOL deposits, 88% of USDC borrowed
- **SLND1:** Vote to seize whale's $170M position
  - Passed in 6 hours with 1.1M votes
  - 98% of "yes" votes from single wallet
  - Only 1% of token holders participated
- **SLND2:** Reversed decision 24 hours later with 99% support
  - Increased voting time to 24 hours minimum

### Token Distribution
| Allocation | Percentage |
|------------|------------|
| Community | 60% |
| Team | 25% |
| Investors | 15% |

### Current Status
- Protocol still operational
- Governance has been quiet since 2022 controversy

### Governance Quality Assessment
- **Decentralization:** Low - demonstrated vulnerability to whale manipulation
- **Participation:** Very low (<1% in controversial vote)
- **Platform:** Realms
- **Notable:** Textbook example of governance failure; exposed tensions between decentralization ideals and practical risk management

---

## 8. Serum/OpenBook

### Status: No Active Governance Token

- Original Serum (SRM) token associated with FTX/Alameda
- **OpenBook** emerged as community fork after FTX collapse
- No dedicated governance token currently
- Governed informally by Solana ecosystem contributors

---

## 9. Tulip Protocol

### Status: Limited Information

- Yield aggregator on Solana
- No significant governance activity found in research
- Focus appears to be on protocol operations rather than DAO governance

---

## Realms Platform Statistics

### Overview
- **Hosts 97% of Solana DAOs**
- **$1.5B+ in treasury value** managed
- Developed by Solana Labs with Mango Markets team

### Notable DAOs on Realms
- Marinade Finance
- Orca
- Drift Protocol
- Pyth Network (1,000 PYTH minimum for voting)
- Metaplex
- Various NFT communities

### Governance Features
- Community Token DAOs
- NFT Community DAOs
- Multisig wallets
- Council + Community hybrid models
- Custom voter weight plugins (veMNDE, voter-stake-registry)

---

## Comparative Analysis

### Governance Participation Rates

| Protocol | Est. Participation | Notes |
|----------|-------------------|-------|
| Marinade | High | ASR incentives drive consistent voting |
| Orca | Moderate | Council-led with community veto |
| Drift | Growing | Delegate program developing |
| Jupiter | Was moderate | Paused due to dysfunction |
| Raydium | Low | Still developing governance |
| Solend | Very low | <1% in 2022 crisis vote |
| Mango | Was high | Protocol shut down |

### Governance Platform Distribution

| Platform | Protocols |
|----------|-----------|
| Realms | Marinade, Orca, Drift (partial), Mango (historical), Solend, Raydium |
| Custom | Jupiter |
| Multi-platform | Drift (Realms + Futarchy) |

### Token Distribution Models

| Model | Protocols | Pros | Cons |
|-------|-----------|------|------|
| Fair launch (no VC) | Marinade, BONK | High community ownership | Slower initial development |
| VC-backed | Jupiter, Orca, Drift | Fast development, resources | Concentration concerns |
| IDO | Raydium, Mango | Broad distribution | Depends on IDO mechanics |

### Delegation Support

| Protocol | Delegation | Notes |
|----------|------------|-------|
| Drift | Yes (developing) | Delegate program in early stages |
| Marinade | Yes | veMNDE system |
| Orca | No formal | Council-based |
| Jupiter | Was available | Paused |

---

## Key Insights for MetaDAO Comparison

### 1. Governance Quality Indicators to Track
- **Proposal frequency:** Monthly proposal count
- **Voter participation:** % of token supply voting
- **Vote concentration:** Gini coefficient of voting power
- **Time to quorum:** How quickly votes reach thresholds
- **Governance outcomes:** % of proposals passed/rejected

### 2. Distribution Comparison Opportunities
MetaDAO's 100% community allocation is unique. Compare against:
- Marinade (fair launch, similar ethos)
- Jupiter (50% community vs MetaDAO's 100%)
- VC-backed protocols (lower community allocation)

### 3. Futarchy Differentiation
Only MetaDAO and Drift's grant DAO use futarchy. This is a key differentiator:
- Traditional voting: Subject to vote buying, whale influence
- Futarchy: Market-based decisions, "skin in the game"

### 4. Red Flags Identified
- **Jupiter:** Governance paused due to breakdown in trust
- **Solend:** Single whale could manipulate votes
- **Mango:** SEC classified governance token as security

### 5. Best Practices Observed
- **Marinade:** ASR incentives for consistent participation
- **Orca:** Council + veto hybrid provides efficiency + oversight
- **Drift:** Multi-branch structure separates concerns

---

## Recommendations for Analytics Dashboard

### Tokens to Add
1. **Marinade (MNDE)** - Best-in-class governance incentives
2. **Drift (DRIFT)** - Multi-branch DAO, futarchy component
3. **Solend (SLND)** - Historical governance failure case study

### Metrics to Track
1. **Governance Participation Rate**
   - Unique voters / total token holders
   - Voting power concentration (Gini)

2. **Proposal Velocity**
   - Proposals per month
   - Average discussion period
   - Pass/fail ratio

3. **Token Lock-up**
   - % of supply locked in governance
   - Average lock duration

4. **Delegation Metrics** (where applicable)
   - Number of delegates
   - Delegation concentration

### Data Sources
- Realms API (most protocols)
- On-chain governance program accounts
- Protocol-specific governance forums

---

## Sources

- Realms documentation and platform data
- Protocol official documentation (Marinade, Orca, Drift, Jupiter)
- CoinDesk, SolanaFloor, DLNews reporting
- SEC filings (Mango Markets settlement)
- Protocol governance forums and Discord channels

---

*Research conducted February 2026 for MetaDAO Holder Analytics project*
