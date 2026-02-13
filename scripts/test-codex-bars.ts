export {};
/**
 * Test script for Codex.io getBars API
 * Tests OHLCV bar data fetching for Solana tokens
 * 
 * Note: Codex API requires authentication for most queries.
 * Free tier has limited access.
 */

const CODEX_URL = "https://graph.codex.io/graphql";
const SOLANA_NETWORK_ID = 1399811149;

// Test tokens
const TEST_TOKENS = {
  META: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
};

// Resolutions available: 1, 5, 15, 30, 60, 240, 720, 1D, 7D
const RESOLUTIONS = ["1", "5", "15", "60", "240", "1D"];

interface Bar {
  o: number;       // open price
  h: number;       // high price
  l: number;       // low price
  c: number;       // close price
  t: number;       // timestamp (unix seconds)
  volume: string;  // volume (USD) with high precision
  s: string;       // status: "ok" or "no_data"
}

interface GetBarsResponse {
  getBars: Bar[];
}

interface PairResult {
  pair: {
    address: string;
    token0: string;
    token1: string;
  };
  exchange: { name: string };
}

interface FilterPairsResponse {
  filterPairs: {
    results: PairResult[];
  };
}

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<{ data: T | null; errors?: string[]; raw?: unknown }> {
  const apiKey = process.env.CODEX_API_KEY || "";
  
  const res = await fetch(CODEX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey && { Authorization: apiKey }),
    },
    body: JSON.stringify({ query: gql, variables }),
  });

  const json = await res.json() as { data: T; errors?: Array<{ message: string }> };
  
  if (json.errors?.length) {
    return { 
      data: null, 
      errors: json.errors.map(e => e.message),
      raw: json 
    };
  }
  
  return { data: json.data };
}

// Get pairs for a token to find the most liquid pair
async function getTokenPairs(tokenAddress: string): Promise<PairResult[]> {
  const result = await query<FilterPairsResponse>(
    `query FilterPairs($tokenAddress: String!, $networkId: Int!) {
      filterPairs(
        filters: { tokenAddress: $tokenAddress, network: [$networkId] }
        limit: 10
        rankings: { attribute: liquidity, direction: DESC }
      ) {
        results {
          pair {
            address
            token0
            token1
          }
          exchange { name }
        }
      }
    }`,
    { tokenAddress, networkId: SOLANA_NETWORK_ID }
  );
  if (result.errors) {
    console.log(`  Query errors: ${result.errors.join(", ")}`);
    return [];
  }
  return result.data?.filterPairs?.results ?? [];
}

// Convert resolution to seconds
function getResolutionSeconds(resolution: string): number {
  const map: Record<string, number> = {
    "1": 60,
    "5": 300,
    "15": 900,
    "30": 1800,
    "60": 3600,
    "240": 14400,
    "720": 43200,
    "1D": 86400,
    "7D": 604800,
  };
  return map[resolution] || 86400;
}

// Test getBars for a specific pair (POOL mode - default)
async function testGetBars(
  pairAddress: string,
  resolution: string,
  countback: number = 100
): Promise<{ bars: Bar[]; elapsed: number; error?: string }> {
  const symbol = `${pairAddress}:${SOLANA_NETWORK_ID}`;
  const now = Math.floor(Date.now() / 1000);
  const from = now - (countback * getResolutionSeconds(resolution));
  
  const start = Date.now();
  const result = await query<GetBarsResponse>(
    `query GetBars($symbol: String!, $resolution: String!, $from: Int!, $to: Int!) {
      getBars(
        symbol: $symbol
        resolution: $resolution
        from: $from
        to: $to
      ) {
        o h l c t volume s
      }
    }`,
    { symbol, resolution, from, to: now }
  );
  const elapsed = Date.now() - start;
  
  if (result.errors) {
    return { bars: [], elapsed, error: result.errors[0] };
  }
  return { bars: result.data?.getBars ?? [], elapsed };
}

// Test getBars with symbolType: TOKEN for aggregate token data
async function testGetTokenBars(
  tokenAddress: string,
  resolution: string,
  countback: number = 100
): Promise<{ bars: Bar[]; elapsed: number; error?: string }> {
  const symbol = `${tokenAddress}:${SOLANA_NETWORK_ID}`;
  const now = Math.floor(Date.now() / 1000);
  const from = now - (countback * getResolutionSeconds(resolution));
  
  const start = Date.now();
  const result = await query<GetBarsResponse>(
    `query GetTokenBars($symbol: String!, $resolution: String!, $from: Int!, $to: Int!) {
      getBars(
        symbol: $symbol
        resolution: $resolution
        from: $from
        to: $to
        symbolType: TOKEN
      ) {
        o h l c t volume s
      }
    }`,
    { symbol, resolution, from, to: now }
  );
  const elapsed = Date.now() - start;
  
  if (result.errors) {
    return { bars: [], elapsed, error: result.errors[0] };
  }
  return { bars: result.data?.getBars ?? [], elapsed };
}

// Test maximum historical data range
async function testMaxHistoricalRange(tokenAddress: string): Promise<{
  earliestTimestamp: number;
  latestTimestamp: number;
  totalBars: number;
  error?: string;
}> {
  const symbol = `${tokenAddress}:${SOLANA_NETWORK_ID}`;
  const now = Math.floor(Date.now() / 1000);
  // Go back ~4 years to find earliest data
  const farPast = now - (4 * 365 * 86400);
  
  const result = await query<GetBarsResponse>(
    `query GetMaxBars($symbol: String!, $from: Int!, $to: Int!) {
      getBars(
        symbol: $symbol
        resolution: "1D"
        from: $from
        to: $to
        symbolType: TOKEN
      ) {
        t
      }
    }`,
    { symbol, from: farPast, to: now }
  );
  
  if (result.errors) {
    return { earliestTimestamp: 0, latestTimestamp: 0, totalBars: 0, error: result.errors[0] };
  }
  
  const bars = result.data?.getBars ?? [];
  if (bars.length === 0) {
    return { earliestTimestamp: 0, latestTimestamp: 0, totalBars: 0 };
  }
  
  const timestamps = bars.map(b => b.t).filter(t => t > 0);
  return {
    earliestTimestamp: Math.min(...timestamps),
    latestTimestamp: Math.max(...timestamps),
    totalBars: bars.length,
  };
}

// Format timestamp for display
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

async function main() {
  console.log("=== Codex.io Trading Bars API Test ===\n");
  
  const apiKey = process.env.CODEX_API_KEY;
  console.log(`API Key: ${apiKey ? "Present" : "Not set (requires API key for most queries)"}\n`);

  // Test 1: Get pairs for META token
  console.log("--- Test 1: Finding pairs for META token ---");
  const pairs = await getTokenPairs(TEST_TOKENS.META);
  if (pairs.length > 0) {
    console.log(`Found ${pairs.length} pairs for META:`);
    pairs.slice(0, 5).forEach(p => {
      console.log(`  - ${p.pair.address} on ${p.exchange.name}`);
    });
    
    // Test 2: getBars for the most liquid pair
    console.log("\n--- Test 2: getBars for most liquid META pair ---");
    const topPair = pairs[0];
    
    for (const resolution of ["1", "60", "1D"]) {
      const { bars, elapsed, error } = await testGetBars(topPair.pair.address, resolution, 10);
      if (error) {
        console.log(`  Resolution ${resolution}: Error - ${error}`);
      } else {
        console.log(`  Resolution ${resolution}: ${bars.length} bars returned (${elapsed}ms)`);
        if (bars.length > 0) {
          const sample = bars[0];
          console.log(`    Sample: o=${sample.o}, h=${sample.h}, l=${sample.l}, c=${sample.c}, vol=${sample.volume}, t=${formatDate(sample.t)}`);
        }
      }
    }
  } else {
    console.log("  No pairs found (API key may be required)");
  }

  // Test 3: getTokenBars (aggregate) for multiple tokens
  console.log("\n--- Test 3: getTokenBars (symbolType: TOKEN) across tokens ---");
  for (const [name, address] of Object.entries(TEST_TOKENS)) {
    console.log(`\n  Token: ${name} (${address.slice(0, 8)}...)`);
    for (const resolution of ["1D"]) { // Just test daily for brevity
      const { bars, elapsed, error } = await testGetTokenBars(address, resolution, 30);
      if (error) {
        console.log(`    Resolution ${resolution}: Error - ${error}`);
      } else {
        console.log(`    Resolution ${resolution}: ${bars.length} bars (${elapsed}ms)`);
        if (bars.length > 0) {
          const sample = bars[bars.length - 1]; // Most recent
          console.log(`      Latest: o=$${sample.o?.toFixed(4) || 'N/A'}, h=$${sample.h?.toFixed(4) || 'N/A'}, l=$${sample.l?.toFixed(4) || 'N/A'}, c=$${sample.c?.toFixed(4) || 'N/A'}`);
        }
      }
    }
  }

  // Test 4: Maximum historical range
  console.log("\n--- Test 4: Maximum historical range (daily bars) ---");
  for (const [name, address] of Object.entries(TEST_TOKENS)) {
    const range = await testMaxHistoricalRange(address);
    if (range.error) {
      console.log(`  ${name}: Error - ${range.error}`);
    } else if (range.totalBars > 0) {
      console.log(`  ${name}: ${range.totalBars} daily bars, from ${formatDate(range.earliestTimestamp)} to ${formatDate(range.latestTimestamp)}`);
      const days = Math.round((range.latestTimestamp - range.earliestTimestamp) / 86400);
      console.log(`         (~${days} days of history)`);
    } else {
      console.log(`  ${name}: No historical data found`);
    }
  }

  // Test 5: 30-day fetch example for META
  console.log("\n--- Test 5: Practical example - 30 days of daily META bars ---");
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
  
  const result = await query<GetBarsResponse>(
    `query Get30DayBars($symbol: String!, $from: Int!, $to: Int!) {
      getBars(
        symbol: $symbol
        resolution: "1D"
        from: $from
        to: $to
        symbolType: TOKEN
      ) {
        o h l c t volume s
      }
    }`,
    { 
      symbol: `${TEST_TOKENS.META}:${SOLANA_NETWORK_ID}`,
      from: thirtyDaysAgo,
      to: now
    }
  );
  
  if (result.errors) {
    console.log(`  Error: ${result.errors[0]}`);
  } else {
    const bars = result.data?.getBars ?? [];
    console.log(`  Retrieved ${bars.length} daily bars for META`);
    
    if (bars.length > 0) {
      console.log("\n  First 5 bars:");
      bars.slice(0, 5).forEach(bar => {
        console.log(`    ${formatDate(bar.t)}: O=$${bar.o?.toFixed(4) || 'N/A'} H=$${bar.h?.toFixed(4) || 'N/A'} L=$${bar.l?.toFixed(4) || 'N/A'} C=$${bar.c?.toFixed(4) || 'N/A'} Vol=${bar.volume}`);
      });
      
      // Calculate some basic stats
      const closes = bars.map(b => b.c).filter(c => c != null);
      if (closes.length > 0) {
        console.log(`\n  Summary:`);
        console.log(`    Period: ${formatDate(bars[0].t)} to ${formatDate(bars[bars.length-1].t)}`);
        console.log(`    Price range: $${Math.min(...closes).toFixed(4)} - $${Math.max(...closes).toFixed(4)}`);
        console.log(`    Latest close: $${closes[closes.length-1].toFixed(4)}`);
      }
    }
  }

  console.log("\n=== Test Complete ===");
}

main().catch(console.error);
