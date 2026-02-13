export {};
/**
 * Test script to explore Codex.io GraphQL API capabilities - V2
 * Updated queries based on error feedback
 * Run with: npx tsx scripts/test-codex-api-v2.ts
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

async function testTokenInfo() {
  return query(
    "Get Token Info (EnhancedToken)",
    `query($address: String!, $networkId: Int!) {
      token(input: { address: $address, networkId: $networkId }) {
        address
        name
        symbol
        totalSupply
        decimals
        info {
          circulatingSupply
          imageThumbUrl
        }
      }
    }`,
    { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

// ============ PAIR QUERIES ============

async function testListPairsForToken() {
  // token0/token1 are strings, not objects
  return query(
    "List Pairs for Token",
    `query($tokenAddress: String!, $networkId: Int!) {
      listPairsForToken(tokenAddress: $tokenAddress, networkId: $networkId) {
        address
        token0
        token1
        exchangeHash
        liquidity
        volume24
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
  // token0/token1 are strings
  return query(
    "Filter Pairs by Network",
    `query {
      filterPairs(
        filters: { network: [${SOLANA_NETWORK_ID}] }
        limit: 10
      ) {
        results {
          pair {
            address
            token0
            token1
            exchangeHash
            createdAt
          }
          volume24
          liquidity
          txnCount24
          priceChange24
        }
      }
    }`
  );
}

async function testGetDetailedPairStats() {
  // Different field names
  return query(
    "Get Detailed Pair Stats",
    `query($pairAddress: String!, $networkId: Int!) {
      getDetailedPairStats(
        pairAddress: $pairAddress
        networkId: $networkId
        tokenOfInterest: "${TOKENS.JUP}"
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
  // Requires 'query' parameter
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
        networkId: SOLANA_NETWORK_ID,
        limit: 10
      }
    }
  );
}

async function testGetWebhookEvents() {
  return query(
    "Get Webhook Events (Swap Events)",
    `query($query: EventsQueryInput!) {
      getWebhookEvents(query: $query, cursor: null, limit: 10) {
        items {
          eventType
          timestamp
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

// ============ OHLCV/BARS ============

async function testGetBars() {
  // Requires 'symbol' instead of pairAddress
  return query(
    "Get OHLCV Bars",
    `query {
      getBars(
        symbol: "${TOKENS.JUP}:${SOLANA_NETWORK_ID}"
        resolution: "1D"
        from: 1704067200
        to: 1707000000
        currencyCode: "USD"
      ) {
        t
        o
        h
        l
        c
        v
        volume
      }
    }`
  );
}

async function testListBarsForPair() {
  return query(
    "List Bars for Pair",
    `query($pairAddress: String!, $networkId: Int!) {
      listBarsForPair(
        pairAddress: $pairAddress
        networkId: $networkId
        resolution: "1D"
        from: 1704067200
        to: 1707000000
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

// ============ TOKEN DISCOVERY ============

async function testGetLatestPairs() {
  // No networkId param
  return query(
    "Get Latest Pairs",
    `query {
      getLatestPairs(limit: 10) {
        cursor
        items {
          address
          exchangeHash
          token0
          token1
          createdAt
          networkId
        }
      }
    }`
  );
}

async function testFilterTokens() {
  return query(
    "Filter Tokens (Solana)",
    `query {
      filterTokens(
        filters: { network: [${SOLANA_NETWORK_ID}] }
        limit: 10
      ) {
        results {
          token {
            address
            name
            symbol
          }
          priceUSD
          change24
        }
        count
      }
    }`
  );
}

async function testFilterTokensByCreation() {
  return query(
    "Filter Tokens by Creation Date",
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
          }
          createdAt
        }
        count
      }
    }`
  );
}

async function testFilterTokensByVolume() {
  return query(
    "Filter Tokens by Volume",
    `query {
      filterTokens(
        filters: { 
          network: [${SOLANA_NETWORK_ID}]
          volume24: { gte: 100000 }
        }
        limit: 10
        rankings: { attribute: volume24, direction: DESC }
      ) {
        results {
          token {
            address
            name
            symbol
          }
          volume24
          marketCap
        }
        count
      }
    }`
  );
}

// ============ LIQUIDITY QUERIES ============

async function testListTopTokens() {
  return query(
    "List Top Tokens by Liquidity",
    `query {
      listTopTokens(
        networkFilter: [${SOLANA_NETWORK_ID}]
        limit: 10
      ) {
        address
        name
        symbol
        networkId
        liquidity
        volume24
      }
    }`
  );
}

async function testGetTokenInfo() {
  return query(
    "Get Token Info (with liquidity)",
    `query($address: String!, $networkId: Int!) {
      getTokenInfo(address: $address, networkId: $networkId) {
        token {
          address
          name
          symbol
        }
        stats {
          liquidity
          volume24h
          priceUSD
          holders
        }
      }
    }`,
    { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function testGetLiquidity() {
  return query(
    "Get Liquidity Depth",
    `query($pairAddress: String!, $networkId: Int!) {
      getLiquidity(pairAddress: $pairAddress, networkId: $networkId) {
        token0
        token1
        totalLiquidity
        pooled {
          token0
          token1
        }
      }
    }`,
    { pairAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

// ============ EXCHANGE/DEX QUERIES ============

async function testGetNetworkStatus() {
  return query(
    "Get Network Status",
    `query {
      getNetworkStatus(networkId: ${SOLANA_NETWORK_ID}) {
        networkId
        lastProcessedBlock
        status
      }
    }`
  );
}

async function testListExchanges() {
  return query(
    "List Exchanges (DEXs)",
    `query {
      listNetworks {
        id
        name
      }
    }`
  );
}

// ============ PAIR METADATA ============

async function testGetPair() {
  return query(
    "Get Pair Metadata",
    `query($pairId: String!) {
      pair(pairId: $pairId) {
        address
        networkId
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
    { pairId: `${TOKENS.JUP}:${SOLANA_NETWORK_ID}` }
  );
}

// ============ HOLDERS ============

async function testGetHolders() {
  return query(
    "Get Token Holders",
    `query($tokenAddress: String!, $networkId: Int!) {
      holders(tokenAddress: $tokenAddress, networkId: $networkId, limit: 10) {
        items {
          address
          balance
        }
        count
      }
    }`,
    { tokenAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID }
  );
}

async function main() {
  console.log("Codex.io API Exploration V2 - Solana DEX/Pair Data\n");
  console.log(`CODEX_API_KEY set: ${!!process.env.CODEX_API_KEY}`);
  console.log(`Solana Network ID: ${SOLANA_NETWORK_ID}`);
  console.log(`Test tokens: META, JTO, JUP\n`);

  // Token queries
  await testTokenInfo();
  
  // Pair queries
  await testListPairsForToken();
  await testFilterPairs();
  await testGetDetailedPairStats();
  await testGetPair();
  
  // Events/trades
  await testGetTokenEvents();
  await testGetWebhookEvents();
  
  // OHLCV
  await testGetBars();
  await testListBarsForPair();
  
  // Token discovery
  await testGetLatestPairs();
  await testFilterTokens();
  await testFilterTokensByCreation();
  await testFilterTokensByVolume();
  
  // Liquidity
  await testListTopTokens();
  await testGetTokenInfo();
  await testGetLiquidity();
  
  // DEX info
  await testGetNetworkStatus();
  await testListExchanges();
  
  // Holders
  await testGetHolders();

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
