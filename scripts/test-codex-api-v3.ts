/**
 * Test script to explore Codex.io GraphQL API capabilities - V3
 * Final corrected queries based on error feedback
 * Run with: npx tsx scripts/test-codex-api-v3.ts
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

// ============ TOKEN QUERIES ============

async function testToken() {
  return query(
    "Get Token (minimal)",
    `query($input: TokenInput!) {
      token(input: $input) {
        address
        name
        symbol
        totalSupply
        decimals
      }
    }`,
    { input: { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID } }
  );
}

async function testTokenWithInfo() {
  return query(
    "Get Token with Info subfields",
    `query($input: TokenInput!) {
      token(input: $input) {
        address
        name
        symbol
        info {
          circulatingSupply
          imageThumbUrl
          imageLargeUrl
        }
      }
    }`,
    { input: { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID } }
  );
}

// ============ PAIR QUERIES ============

async function testListPairsForToken() {
  return query(
    "List Pairs for Token (minimal)",
    `query($tokenAddress: String!, $networkId: Int!) {
      listPairsForToken(tokenAddress: $tokenAddress, networkId: $networkId) {
        address
        token0
        token1
        exchangeHash
        fee
        createdAt
        pooled {
          token0
          token1
        }
      }
    }`,
    { tokenAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testFilterPairs() {
  return query(
    "Filter Pairs by Network (minimal)",
    `query {
      filterPairs(
        filters: { network: [${SOLANA_NETWORK_ID}] }
        limit: 5
      ) {
        results {
          pair {
            address
            token0
            token1
            exchangeHash
            createdAt
          }
          liquidity
          txnCount24
          priceChange24
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
        tokenOfInterest: token0
      ) {
        stats_day1 {
          volume {
            currentValue
            previousValue
            change
          }
          transactions {
            currentValue
            buys
            sells
          }
          uniqueWallets {
            currentValue
            buyers
            sellers
          }
        }
        statsNonCurrency {
          holders
        }
      }
    }`,
    { pairAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

// ============ EVENTS/TRADES ============

async function testGetTokenEvents() {
  return query(
    "Get Token Events",
    `query($query: EventsQueryInput!) {
      getTokenEvents(query: $query) {
        items {
          eventType
          timestamp
          data
          maker
          transactionHash
        }
      }
    }`,
    { 
      query: {
        address: TOKENS.JUP,
        networkId: SOLANA_NETWORK_ID
      }
    }
  );
}

async function testGetLatestPairs() {
  return query(
    "Get Latest Pairs",
    `query {
      getLatestPairs(limit: 5) {
        cursor
        items {
          address
          exchangeHash
          token0 {
            address
            symbol
            name
          }
          token1 {
            address
            symbol
            name
          }
          createdAt
          networkId
        }
      }
    }`
  );
}

async function testGetLatestPairsSolana() {
  return query(
    "Get Latest Pairs (Solana filter via cursor)",
    `query {
      getLatestPairs(limit: 10) {
        items {
          address
          exchangeHash
          token0 {
            address
            symbol
          }
          token1 {
            address
            symbol
          }
          createdAt
          networkId
          liquidity
        }
      }
    }`
  );
}

// ============ TOKEN DISCOVERY ============

async function testFilterTokensMinimal() {
  return query(
    "Filter Tokens (minimal)",
    `query($filters: TokenFilters) {
      filterTokens(
        filters: $filters
        limit: 5
      ) {
        results {
          token {
            address
            name
            symbol
            networkId
          }
          priceUSD
          change24
        }
        count
      }
    }`,
    { filters: { network: [SOLANA_NETWORK_ID] } }
  );
}

async function testFilterTokensWithRanking() {
  return query(
    "Filter Tokens with Ranking",
    `query($filters: TokenFilters, $rankings: TokenRanking) {
      filterTokens(
        filters: $filters
        rankings: $rankings
        limit: 5
      ) {
        results {
          token {
            address
            name
            symbol
          }
          priceUSD
          marketCap
        }
        count
      }
    }`,
    { 
      filters: { network: [SOLANA_NETWORK_ID] },
      rankings: { attribute: "marketCap", direction: "DESC" }
    }
  );
}

// ============ LIQUIDITY QUERIES ============

async function testListTopTokens() {
  return query(
    "List Top Tokens (minimal)",
    `query {
      listTopTokens(
        networkFilter: [${SOLANA_NETWORK_ID}]
        limit: 5
      ) {
        address
        name
        symbol
        networkId
        liquidity
      }
    }`
  );
}

async function testGetTokenInfo() {
  return query(
    "Get Token Info",
    `query($address: String!, $networkId: Int!) {
      getTokenInfo(address: $address, networkId: $networkId) {
        address
        name
        symbol
        circulatingSupply
        totalSupply
        decimals
        imageLargeUrl
      }
    }`,
    { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

// ============ NETWORK/DEX QUERIES ============

async function testGetNetworkStatus() {
  return query(
    "Get Network Status",
    `query {
      getNetworkStatus(networkIds: [${SOLANA_NETWORK_ID}]) {
        networkId
        lastProcessedBlock
        status
      }
    }`
  );
}

async function testGetNetworks() {
  return query(
    "Get Networks",
    `query {
      getNetworks {
        id
        name
      }
    }`
  );
}

// ============ HOLDERS ============

async function testHolders() {
  return query(
    "Get Token Holders",
    `query($input: HoldersInput!) {
      holders(input: $input) {
        items {
          address
          balance
        }
        count
      }
    }`,
    { 
      input: { 
        tokenAddress: TOKENS.JUP, 
        networkId: SOLANA_NETWORK_ID,
        limit: 10
      } 
    }
  );
}

// ============ BARS/OHLCV ============

async function testGetBars() {
  return query(
    "Get Bars (OHLCV)",
    `query {
      getBars(
        symbol: "JUP"
        resolution: "1D"
        from: 1704067200
        to: 1707000000
        currencyCode: "USD"
        quoteToken: token0
      ) {
        t
        o
        h
        l
        c
        v
      }
    }`
  );
}

// ============ SEARCH ============

async function testSearchTokens() {
  return query(
    "Search Tokens",
    `query($search: String!) {
      searchTokens(search: $search, networkFilter: [${SOLANA_NETWORK_ID}], limit: 5) {
        tokens {
          address
          name
          symbol
          networkId
        }
      }
    }`,
    { search: "JUP" }
  );
}

async function testFilterPairsByExchange() {
  return query(
    "Filter Pairs by Exchange (Raydium)",
    `query {
      filterPairs(
        filters: { 
          network: [${SOLANA_NETWORK_ID}]
        }
        limit: 5
      ) {
        results {
          pair {
            address
            exchangeHash
          }
          liquidity
        }
      }
    }`
  );
}

async function main() {
  console.log("Codex.io API Exploration V3 - Solana DEX/Pair Data\n");
  console.log(`CODEX_API_KEY set: ${!!process.env.CODEX_API_KEY}`);
  console.log(`Solana Network ID: ${SOLANA_NETWORK_ID}`);
  console.log(`Test tokens: META, JTO, JUP\n`);

  // Token queries
  await testToken();
  await testTokenWithInfo();
  await testGetTokenInfo();
  
  // Pair queries
  await testListPairsForToken();
  await testFilterPairs();
  await testFilterPairsByExchange();
  await testGetDetailedPairStats();
  
  // Events/trades
  await testGetTokenEvents();
  
  // Token discovery
  await testGetLatestPairs();
  await testGetLatestPairsSolana();
  await testFilterTokensMinimal();
  await testFilterTokensWithRanking();
  await testSearchTokens();
  
  // Liquidity
  await testListTopTokens();
  
  // Network info
  await testGetNetworkStatus();
  await testGetNetworks();
  
  // Holders
  await testHolders();
  
  // OHLCV
  await testGetBars();

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
