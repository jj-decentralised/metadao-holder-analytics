/**
 * Test script to explore Codex.io GraphQL API capabilities
 * Run with: npx tsx scripts/test-codex-api.ts
 */

const CODEX_URL = "https://graph.codex.io/graphql";
const SOLANA_NETWORK_ID = 1399811149;

// Token addresses from our tokens.ts
const TOKENS = {
  META: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
};

interface Result {
  query: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

const results: Result[] = [];

async function query(
  name: string,
  gql: string,
  variables?: Record<string, unknown>
): Promise<unknown> {
  console.log(`\n${"=".repeat(60)}\nTesting: ${name}\n${"=".repeat(60)}`);
  
  try {
    const res = await fetch(CODEX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.CODEX_API_KEY || "",
      },
      body: JSON.stringify({ query: gql, variables }),
    });

    const json = await res.json();
    
    if (json.errors?.length) {
      const error = json.errors[0].message;
      console.log(`❌ Error: ${error}`);
      results.push({ query: name, success: false, error });
      return null;
    }
    
    console.log(`✅ Success`);
    console.log(JSON.stringify(json.data, null, 2));
    results.push({ query: name, success: true, data: json.data });
    return json.data;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.log(`❌ Error: ${error}`);
    results.push({ query: name, success: false, error });
    return null;
  }
}

async function testSchemaIntrospection() {
  return query(
    "Schema Introspection - Root Query Fields",
    `{ __schema { queryType { fields { name description } } } }`
  );
}

async function testGetNetworks() {
  return query(
    "Get Supported Networks",
    `{ getNetworks { id name } }`
  );
}

async function testFilterTokens() {
  return query(
    "Filter/Search Tokens",
    `query { filterTokens(filters: { network: [${SOLANA_NETWORK_ID}] }, limit: 10) { results { token { address name symbol } } } }`
  );
}

async function testTokenPairs() {
  return query(
    "Get Token Pairs (listPairsForToken)",
    `query($tokenAddress: String!, $networkId: Int!) {
      listPairsForToken(tokenAddress: $tokenAddress, networkId: $networkId) {
        address
        token0 { address symbol name }
        token1 { address symbol name }
        exchangeHash
        liquidity
        volume24h
        createdAt
      }
    }`,
    { tokenAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testPairs() {
  return query(
    "Get Pairs (pairs query)",
    `query($address: String!, $networkId: Int!) {
      pairs(input: { tokenAddress: $address, networkId: $networkId }) {
        items {
          pairAddress
          token0
          token1
          exchange
        }
      }
    }`,
    { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testGetTokenPairs() {
  return query(
    "Get Token Pairs (getTokenPairs)",
    `query($address: String!, $networkId: Int!) {
      getTokenPairs(address: $address, networkId: $networkId) {
        pairAddress
        liquidity
        volume24h
      }
    }`,
    { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testTokenInfo() {
  return query(
    "Get Token Info",
    `query($address: String!, $networkId: Int!) {
      token(input: { address: $address, networkId: $networkId }) {
        address
        name
        symbol
        totalSupply
        holderCount
        decimals
        createdAt
      }
    }`,
    { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testTokenEvents() {
  return query(
    "Get Token Events (Swaps/Trades)",
    `query($address: String!, $networkId: Int!) {
      getTokenEvents(address: $address, networkId: $networkId, limit: 10) {
        items {
          eventType
          timestamp
          amount
          maker
          taker
        }
      }
    }`,
    { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testGetBars() {
  return query(
    "Get OHLCV Bars",
    `query($pairAddress: String!, $networkId: Int!) {
      getBars(
        pairAddress: $pairAddress
        networkId: $networkId
        resolution: "1D"
        from: 1704067200
        to: 1704153600
      ) {
        t
        o
        h
        l
        c
        v
      }
    }`,
    { pairAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testGetLatestPairs() {
  return query(
    "Get Latest/New Pairs (Token Discovery)",
    `query($networkId: [Int!]) {
      getLatestPairs(networkId: $networkId, limit: 10) {
        items {
          pairAddress
          createdAt
          token0 { address symbol }
          token1 { address symbol }
          liquidity
        }
      }
    }`,
    { networkId: [SOLANA_NETWORK_ID] }
  );
}

async function testFilterPairs() {
  return query(
    "Filter Pairs by Volume",
    `query {
      filterPairs(
        filters: { network: [${SOLANA_NETWORK_ID}] }
        statsType: UNFILTERED
        limit: 10
      ) {
        results {
          pair {
            address
            token0 { symbol }
            token1 { symbol }
          }
          volume24h
          liquidity
          txCount24h
        }
      }
    }`
  );
}

async function testGetDetailedPairStats() {
  return query(
    "Get Detailed Pair Stats",
    `query($pairAddress: String!, $networkId: Int!) {
      getDetailedPairStats(
        pairAddress: $pairAddress
        networkId: $networkId
      ) {
        liquidity
        volume24h
        volume1h
        txCount24h
        priceChange24h
        buyCount24h
        sellCount24h
        uniqueBuyers24h
        uniqueSellers24h
      }
    }`,
    { pairAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testNewTokens() {
  return query(
    "Filter New Tokens by Creation Date",
    `query {
      filterTokens(
        filters: { 
          network: [${SOLANA_NETWORK_ID}]
          createdAt: { gte: 1700000000 }
        }
        limit: 10
      ) {
        results {
          token {
            address
            name
            symbol
            createdAt
          }
          volume24h
          liquidity
        }
      }
    }`
  );
}

async function testTokenHolders() {
  return query(
    "Get Token Holders",
    `query($tokenAddress: String!, $networkId: Int!) {
      tokenHolders(input: { tokenAddress: $tokenAddress, networkId: $networkId, limit: 10 }) {
        items {
          address
          balance
          percentOwned
        }
      }
    }`,
    { tokenAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testHistoricalData() {
  return query(
    "Get Historical Token Stats",
    `query($address: String!, $networkId: Int!) {
      getTokenStats(
        address: $address
        networkId: $networkId
      ) {
        liquidity
        volume24h
        holders
        marketCap
      }
    }`,
    { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testPairEvents() {
  return query(
    "Get Pair Events (Trades/Swaps)",
    `query($pairAddress: String!, $networkId: Int!) {
      getPairEvents(
        pairAddress: $pairAddress
        networkId: $networkId
        limit: 10
      ) {
        items {
          eventType
          timestamp
          amount0
          amount1
          maker
          priceUsd
        }
      }
    }`,
    { pairAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function main() {
  console.log("Codex.io API Exploration for Solana DEX/Pair Data\n");
  console.log(`CODEX_API_KEY set: ${!!process.env.CODEX_API_KEY}`);
  console.log(`Solana Network ID: ${SOLANA_NETWORK_ID}`);
  console.log(`Test tokens: META, JTO, JUP\n`);

  // 1. Schema exploration
  await testSchemaIntrospection();
  await testGetNetworks();
  
  // 2. Token info & pairs
  await testTokenInfo();
  await testTokenPairs();
  await testPairs();
  await testGetTokenPairs();
  
  // 3. Liquidity & stats
  await testFilterPairs();
  await testGetDetailedPairStats();
  await testHistoricalData();
  
  // 4. Events & trades
  await testTokenEvents();
  await testPairEvents();
  await testGetBars();
  
  // 5. Token discovery
  await testGetLatestPairs();
  await testFilterTokens();
  await testNewTokens();
  
  // 6. Holder data
  await testTokenHolders();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successful queries (${successful.length}):`);
  successful.forEach(r => console.log(`   - ${r.query}`));
  
  console.log(`\n❌ Failed queries (${failed.length}):`);
  failed.forEach(r => console.log(`   - ${r.query}: ${r.error}`));
}

main().catch(console.error);
