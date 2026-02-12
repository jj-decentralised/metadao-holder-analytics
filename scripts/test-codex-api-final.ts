/**
 * Codex.io API Exploration - Final Version
 * Based on official documentation at docs.codex.io
 * Run with: npx tsx scripts/test-codex-api-final.ts
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
  category: string;
  success: boolean;
  data?: unknown;
  error?: string;
  notes?: string;
}

const results: Result[] = [];

async function query(
  name: string,
  category: string,
  gql: string,
  variables?: Record<string, unknown>,
  notes?: string
): Promise<unknown> {
  console.log(`\n${"=".repeat(60)}\n[${category}] ${name}\n${"=".repeat(60)}`);
  
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
      results.push({ query: name, category, success: false, error, notes });
      return null;
    }
    
    console.log(`✅ Success`);
    console.log(JSON.stringify(json.data, null, 2).slice(0, 2000));
    if (JSON.stringify(json.data).length > 2000) console.log("... (truncated)");
    results.push({ query: name, category, success: true, data: json.data, notes });
    return json.data;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.log(`❌ Error: ${error}`);
    results.push({ query: name, category, success: false, error, notes });
    return null;
  }
}

// ============================================================================
// 1. PAIR/POOL QUERIES
// ============================================================================

async function test_listPairsWithMetadataForToken() {
  return query(
    "listPairsWithMetadataForToken",
    "PAIRS",
    `query ListPairs($tokenAddress: String!, $networkId: Int!) {
      listPairsWithMetadataForToken(tokenAddress: $tokenAddress, networkId: $networkId, limit: 10) {
        address
        exchangeHash
        fee
        token0
        token1
        pooled {
          token0
          token1
        }
        price
        priceChange24
        volume24
        liquidity
      }
    }`,
    { tokenAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID },
    "Get all trading pairs for a token with liquidity/volume data"
  );
}

async function test_filterPairs() {
  return query(
    "filterPairs",
    "PAIRS",
    `query FilterPairs {
      filterPairs(
        filters: { network: ${SOLANA_NETWORK_ID} }
        limit: 5
      ) {
        count
        results {
          pair {
            address
            exchangeHash
            fee
            token0
            token1
          }
          liquidity
          volume24
          priceChange24
          txnCount24
          buyCount24
          sellCount24
        }
      }
    }`,
    undefined,
    "Filter and discover trading pairs on Solana"
  );
}

// ============================================================================
// 2. DETAILED PAIR STATS
// ============================================================================

async function test_getDetailedPairStats() {
  return query(
    "getDetailedPairStats",
    "LIQUIDITY",
    `query GetDetailedPairStats($pairAddress: String!, $networkId: Int!) {
      getDetailedPairStats(
        pairAddress: $pairAddress
        networkId: $networkId
        tokenOfInterest: token0
      ) {
        stats_day1 {
          statsUsd {
            close
            high
            low
            volume
            liquidity
          }
          transactions {
            buys
            sells
            total
          }
          uniqueWallets {
            buyers
            sellers
            total
          }
        }
        stats_week1 {
          statsUsd {
            volume
            liquidity
          }
        }
        statsNonCurrency {
          holders
        }
      }
    }`,
    { pairAddress: TOKENS.JUP, networkId: SOLANA_NETWORK_ID },
    "Detailed stats including TVL, volume, buy/sell pressure"
  );
}

// ============================================================================
// 3. TOKEN EVENTS (TRADES/SWAPS)
// ============================================================================

async function test_getTokenEvents() {
  return query(
    "getTokenEvents",
    "EVENTS",
    `query GetTokenEvents {
      getTokenEvents(
        query: {
          address: "${TOKENS.JUP}"
          networkId: ${SOLANA_NETWORK_ID}
        }
        cursor: null
        limit: 10
      ) {
        cursor
        items {
          baseTokenPrice
          blockNumber
          eventType
          liquidityToken
          maker
          quoteToken
          timestamp
          token0PoolValueUsd
          token1PoolValueUsd
          transactionHash
          data {
            ... on SwapEventData {
              amount0
              amount0In
              amount0Out
              amount1
              amount1In
              amount1Out
              amountNonLiquidityToken
              priceBaseToken
              priceBaseTokenTotal
              priceUsd
              priceUsdTotal
              type
            }
          }
        }
      }
    }`,
    undefined,
    "Recent swaps/trades for a token with amounts and prices"
  );
}

// ============================================================================
// 4. TOKEN DISCOVERY & FILTERING
// ============================================================================

async function test_filterTokens_basic() {
  return query(
    "filterTokens (basic)",
    "DISCOVERY",
    `query FilterTokens {
      filterTokens(
        filters: {
          network: ${SOLANA_NETWORK_ID}
          buyVolume24: { gt: 5000 }
          liquidity: { gt: 10000 }
        }
        rankings: { attribute: trendingScore24, direction: DESC }
        limit: 10
      ) {
        count
        results {
          buyVolume24
          sellVolume24
          liquidity
          holders
          createdAt
          txnCount24
          token {
            address
            name
            symbol
            info {
              imageThumbUrl
            }
            createdAt
            creatorAddress
          }
        }
      }
    }`,
    undefined,
    "Filter tokens by volume/liquidity with trending ranking"
  );
}

async function test_filterTokens_newTokens() {
  // Filter for tokens created in the last 7 days
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  return query(
    "filterTokens (new tokens)",
    "DISCOVERY",
    `query FilterNewTokens {
      filterTokens(
        filters: {
          network: ${SOLANA_NETWORK_ID}
          createdAt: { gt: ${sevenDaysAgo} }
          volume24: { gt: 1000 }
        }
        rankings: { attribute: createdAt, direction: DESC }
        limit: 10
      ) {
        count
        results {
          createdAt
          volume24
          liquidity
          token {
            address
            name
            symbol
            createdAt
            createTransactionHash
          }
        }
      }
    }`,
    undefined,
    "Find tokens created within last 7 days"
  );
}

async function test_filterTokens_byVolume() {
  return query(
    "filterTokens (by volume thresholds)",
    "DISCOVERY",
    `query FilterByVolume {
      filterTokens(
        filters: {
          network: ${SOLANA_NETWORK_ID}
          volume24: { gt: 100000 }
        }
        rankings: { attribute: volume24, direction: DESC }
        limit: 10
      ) {
        count
        results {
          volume24
          buyVolume24
          sellVolume24
          liquidity
          marketCap
          token {
            address
            name
            symbol
          }
        }
      }
    }`,
    undefined,
    "Filter tokens by trading volume thresholds"
  );
}

// ============================================================================
// 5. TOKEN INFO
// ============================================================================

async function test_token() {
  return query(
    "token",
    "TOKEN_INFO",
    `query GetToken($input: TokenInput!) {
      token(input: $input) {
        address
        decimals
        name
        symbol
        totalSupply
        networkId
        info {
          address
          circulatingSupply
          imageThumbUrl
          imageLargeUrl
        }
      }
    }`,
    { input: { address: TOKENS.JUP, networkId: SOLANA_NETWORK_ID } },
    "Get token metadata"
  );
}

// ============================================================================
// 6. OHLCV BARS
// ============================================================================

async function test_getBars() {
  // Get bars for the last 30 days
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  
  return query(
    "getBars",
    "OHLCV",
    `query GetBars {
      getBars(
        symbol: "${TOKENS.JUP}:${SOLANA_NETWORK_ID}"
        from: ${thirtyDaysAgo}
        to: ${now}
        resolution: "1D"
        currencyCode: "USD"
        quoteToken: token0
      ) {
        t
        o
        h
        l
        c
        v
        volume
        liquidity
        buyers
        sellers
        transactions
        buyVolume
        sellVolume
      }
    }`,
    undefined,
    "Get OHLCV price data for charting"
  );
}

// ============================================================================
// 7. HOLDERS
// ============================================================================

async function test_holders() {
  return query(
    "holders",
    "HOLDERS",
    `query GetHolders($input: HoldersInput!) {
      holders(input: $input) {
        count
        items {
          address
          balance
        }
      }
    }`,
    { 
      input: {
        tokenId: `${TOKENS.JUP}:${SOLANA_NETWORK_ID}`,
        limit: 10
      }
    },
    "Get top token holders with balances"
  );
}

// ============================================================================
// 8. NETWORK INFO
// ============================================================================

async function test_getNetworks() {
  return query(
    "getNetworks",
    "NETWORK",
    `query GetNetworks {
      getNetworks {
        id
        name
      }
    }`,
    undefined,
    "List all supported networks and their IDs"
  );
}

async function test_getNetworkStatus() {
  return query(
    "getNetworkStatus",
    "NETWORK",
    `query GetNetworkStatus {
      getNetworkStatus(networkIds: [${SOLANA_NETWORK_ID}]) {
        networkId
        lastProcessedBlock
        lastProcessedTimestamp
      }
    }`,
    undefined,
    "Get network indexing status"
  );
}

// ============================================================================
// 9. LATEST/NEW PAIRS (TOKEN DISCOVERY)
// ============================================================================

async function test_getLatestPairs() {
  return query(
    "getLatestPairs",
    "DISCOVERY",
    `query GetLatestPairs {
      getLatestPairs(limit: 10, networkFilter: [${SOLANA_NETWORK_ID}]) {
        cursor
        items {
          address
          exchangeHash
          id
          networkId
          token0 {
            address
            name
            symbol
          }
          token1 {
            address
            name
            symbol
          }
          liquidity
          initialPriceUsd
        }
      }
    }`,
    undefined,
    "Get newly created trading pairs"
  );
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║       Codex.io API Research for Solana DEX Data            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  console.log(`CODEX_API_KEY set: ${!!process.env.CODEX_API_KEY}`);
  console.log(`Solana Network ID: ${SOLANA_NETWORK_ID}`);
  console.log(`Test tokens: META, JTO, JUP\n`);

  // 1. Pair queries
  await test_listPairsWithMetadataForToken();
  await test_filterPairs();
  
  // 2. Detailed stats
  await test_getDetailedPairStats();
  
  // 3. Events/trades
  await test_getTokenEvents();
  
  // 4. Token discovery
  await test_filterTokens_basic();
  await test_filterTokens_newTokens();
  await test_filterTokens_byVolume();
  
  // 5. Token info
  await test_token();
  
  // 6. OHLCV
  await test_getBars();
  
  // 7. Holders
  await test_holders();
  
  // 8. Network
  await test_getNetworks();
  await test_getNetworkStatus();
  
  // 9. Latest pairs
  await test_getLatestPairs();

  // Summary by category
  console.log("\n" + "═".repeat(60));
  console.log("SUMMARY BY CATEGORY");
  console.log("═".repeat(60));
  
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const successful = catResults.filter(r => r.success);
    console.log(`\n${cat}:`);
    catResults.forEach(r => {
      const icon = r.success ? "✅" : "❌";
      const errorMsg = r.error ? ` - ${r.error.slice(0, 60)}` : "";
      console.log(`  ${icon} ${r.query}${errorMsg}`);
    });
  }

  // Overall summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log("\n" + "═".repeat(60));
  console.log(`OVERALL: ${successful.length}/${results.length} queries successful`);
  console.log("═".repeat(60));
  
  // Write detailed results to a JSON file
  const fs = await import("fs");
  fs.writeFileSync(
    "scripts/codex-api-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\nDetailed results written to scripts/codex-api-results.json");
}

main().catch(console.error);
