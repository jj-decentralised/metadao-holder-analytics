/**
 * Test script to probe Codex.io API for holder time-series capabilities
 * Run: npx ts-node scripts/test-codex-holders.ts
 */

const CODEX_URL = "https://graph.codex.io/graphql";
const API_KEY = process.env.CODEX_API_KEY || "";
const META_TOKEN = "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m";
const SOLANA_NETWORK_ID = 1399811149;

interface QueryResult {
  name: string;
  query: string;
  variables?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

async function executeQuery(
  name: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<QueryResult> {
  const result: QueryResult = { name, query, variables };
  
  try {
    const res = await fetch(CODEX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: API_KEY,
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = await res.json();
    
    if (!res.ok) {
      result.error = `HTTP ${res.status}: ${res.statusText}`;
      return result;
    }
    
    if (json.errors?.length) {
      result.error = json.errors.map((e: { message: string }) => e.message).join("; ");
      return result;
    }
    
    result.result = json.data;
    return result;
  } catch (err) {
    result.error = String(err);
    return result;
  }
}

async function runTests() {
  console.log("=".repeat(80));
  console.log("CODEX.IO HOLDER TIME-SERIES API RESEARCH");
  console.log("=".repeat(80));
  console.log(`Token: META (${META_TOKEN})`);
  console.log(`Network ID: ${SOLANA_NETWORK_ID} (Solana)`);
  console.log(`API Key present: ${API_KEY ? "Yes" : "No"}`);
  console.log("=".repeat(80));
  console.log();

  const tests: QueryResult[] = [];

  // =====================================================
  // TEST 1: Basic token info with holderCount
  // =====================================================
  tests.push(await executeQuery(
    "1. Token Info with Holder Count",
    `query($address: String!, $networkId: Int!) {
      token(input: { address: $address, networkId: $networkId }) {
        address
        name
        symbol
        totalSupply
        holderCount
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 2: Token holders with pagination
  // =====================================================
  tests.push(await executeQuery(
    "2. Token Holders (Top 10)",
    `query($address: String!, $networkId: Int!) {
      tokenHolders(input: { tokenAddress: $address, networkId: $networkId, limit: 10 }) {
        items {
          address
          balance
          percentOwned
        }
        cursor
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 3: Holder count history (hypothetical)
  // =====================================================
  tests.push(await executeQuery(
    "3. Holder Count History (holderCountHistory)",
    `query($address: String!, $networkId: Int!) {
      token(input: { address: $address, networkId: $networkId }) {
        holderCountHistory {
          timestamp
          count
        }
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 4: Token stats with holder count over time
  // =====================================================
  tests.push(await executeQuery(
    "4. Token Stats (tokenStats query)",
    `query($address: String!, $networkId: Int!) {
      tokenStats(input: { address: $address, networkId: $networkId }) {
        holderCount
        holders24hChange
        holders7dChange
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 5: Filter token holders by balance range
  // =====================================================
  tests.push(await executeQuery(
    "5. Filter Holders by Balance Range",
    `query($address: String!, $networkId: Int!) {
      filterTokenHolders(input: { 
        tokenAddress: $address, 
        networkId: $networkId,
        minBalance: "1000000000"
      }) {
        items {
          address
          balance
        }
        count
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 6: Holder balance changes (hypothetical)
  // =====================================================
  tests.push(await executeQuery(
    "6. Holder Balance Changes",
    `query($address: String!, $networkId: Int!) {
      holderBalanceChanges(input: { 
        tokenAddress: $address, 
        networkId: $networkId,
        period: "24h"
      }) {
        items {
          address
          previousBalance
          currentBalance
          change
        }
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 7: Token chart bars (might include holder data)
  // =====================================================
  tests.push(await executeQuery(
    "7. Token Chart Bars",
    `query($address: String!, $networkId: Int!) {
      getTokenChartBars(input: { 
        address: $address, 
        networkId: $networkId,
        resolution: "1D",
        countback: 30
      }) {
        t
        o
        h
        l
        c
        v
        holders
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 8: Token metrics over time
  // =====================================================
  tests.push(await executeQuery(
    "8. Token Metrics (getBars with holders)",
    `query($address: String!, $networkId: Int!) {
      getBars(
        symbol: $address
        resolution: "1D"
        from: 1704067200
        to: 1706745600
        networkId: $networkId
      ) {
        t
        holders
        holderCount
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 9: Token with detailed stats
  // =====================================================
  tests.push(await executeQuery(
    "9. Token with Extended Fields",
    `query($address: String!, $networkId: Int!) {
      token(input: { address: $address, networkId: $networkId }) {
        address
        name
        symbol
        holderCount
        holders24h
        holders7d
        holders30d
        holderCountChange24h
        holderCountChange7d
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 10: Schema introspection for holder fields
  // =====================================================
  tests.push(await executeQuery(
    "10. Schema Introspection (Token type)",
    `{
      __type(name: "Token") {
        name
        fields {
          name
          type {
            name
            kind
          }
          description
        }
      }
    }`
  ));

  // =====================================================
  // TEST 11: Schema introspection for TokenHolder type
  // =====================================================
  tests.push(await executeQuery(
    "11. Schema Introspection (TokenHolder type)",
    `{
      __type(name: "TokenHolder") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
    }`
  ));

  // =====================================================
  // TEST 12: Query types for holder-related queries
  // =====================================================
  tests.push(await executeQuery(
    "12. Schema Introspection (Query type - holder fields)",
    `{
      __type(name: "Query") {
        fields {
          name
          description
        }
      }
    }`
  ));

  // =====================================================
  // TEST 13: Token holders with more detailed fields
  // =====================================================
  tests.push(await executeQuery(
    "13. Token Holders with All Fields",
    `query($address: String!, $networkId: Int!) {
      tokenHolders(input: { tokenAddress: $address, networkId: $networkId, limit: 5 }) {
        items {
          address
          balance
          percentOwned
          firstTransactionAt
          lastTransactionAt
          balanceChange24h
          rank
        }
        cursor
        count
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 14: Historical holder snapshot (hypothetical)
  // =====================================================
  const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  tests.push(await executeQuery(
    "14. Historical Holder Snapshot (at timestamp)",
    `query($address: String!, $networkId: Int!, $timestamp: Int!) {
      tokenHoldersAtTime(input: { 
        tokenAddress: $address, 
        networkId: $networkId,
        timestamp: $timestamp,
        limit: 10
      }) {
        items {
          address
          balance
        }
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID, timestamp: oneWeekAgo }
  ));

  // =====================================================
  // TEST 15: Token analytics
  // =====================================================
  tests.push(await executeQuery(
    "15. Token Analytics",
    `query($address: String!, $networkId: Int!) {
      tokenAnalytics(input: { address: $address, networkId: $networkId }) {
        holderCount
        holderCountHistory {
          timestamp
          value
        }
        top10HolderPercent
        top100HolderPercent
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 16: Holder distribution buckets
  // =====================================================
  tests.push(await executeQuery(
    "16. Holder Distribution Buckets",
    `query($address: String!, $networkId: Int!) {
      holderDistribution(input: { 
        tokenAddress: $address, 
        networkId: $networkId
      }) {
        buckets {
          range
          count
          totalBalance
        }
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // TEST 17: Enhanced token fields
  // =====================================================
  tests.push(await executeQuery(
    "17. Enhanced Token Info (looking for time series)",
    `query($address: String!, $networkId: Int!) {
      getEnhancedToken(input: { address: $address, networkId: $networkId }) {
        token {
          address
          name
          holderCount
        }
        stats {
          holders {
            value
            change24h
            change7d
          }
        }
      }
    }`,
    { address: META_TOKEN, networkId: SOLANA_NETWORK_ID }
  ));

  // =====================================================
  // Print Results
  // =====================================================
  for (const test of tests) {
    console.log("-".repeat(80));
    console.log(`TEST: ${test.name}`);
    console.log("-".repeat(80));
    
    if (test.error) {
      console.log(`❌ ERROR: ${test.error}`);
    } else {
      console.log(`✅ SUCCESS`);
      console.log(JSON.stringify(test.result, null, 2));
    }
    console.log();
  }

  // =====================================================
  // Summary
  // =====================================================
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  
  const successful = tests.filter(t => !t.error);
  const failed = tests.filter(t => t.error);
  
  console.log(`✅ Successful queries: ${successful.length}`);
  console.log(`❌ Failed queries: ${failed.length}`);
  
  console.log("\nSuccessful:");
  successful.forEach(t => console.log(`  - ${t.name}`));
  
  console.log("\nFailed:");
  failed.forEach(t => console.log(`  - ${t.name}: ${t.error?.substring(0, 80)}...`));
}

runTests().catch(console.error);
