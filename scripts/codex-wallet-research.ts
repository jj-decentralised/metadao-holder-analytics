export {};
/**
 * Codex.io Wallet Analytics Research Script
 * 
 * This script explores Codex.io's GraphQL API capabilities for:
 * - Wallet-level analytics
 * - Whale tracking
 * - Cross-token holder analysis
 */

const CODEX_URL = "https://graph.codex.io/graphql";
const API_KEY = process.env.CODEX_API_KEY || "";

// Solana network ID in Codex
const SOLANA_NETWORK_ID = 1399811149;

// Token addresses for research
const TOKENS = {
  META: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
};

interface QueryResult<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<QueryResult<T>> {
  try {
    const res = await fetch(CODEX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: API_KEY } : {}),
      },
      body: JSON.stringify({ query: gql, variables }),
    });

    if (!res.ok) {
      return { errors: [{ message: `HTTP ${res.status}: ${res.statusText}` }] };
    }

    return await res.json() as QueryResult<T>;
  } catch (err) {
    return { errors: [{ message: String(err) }] };
  }
}

// ============================================================================
// SCHEMA INTROSPECTION
// ============================================================================

async function introspectSchema(): Promise<void> {
  console.log("\n=== SCHEMA INTROSPECTION ===\n");
  
  // Get all query types
  const introspection = await query<{
    __schema: {
      queryType: { fields: Array<{ name: string; description?: string }> };
    };
  }>(`{
    __schema {
      queryType {
        fields {
          name
          description
        }
      }
    }
  }`);

  if (introspection.errors) {
    console.log("Introspection error:", introspection.errors);
    return;
  }

  const fields = introspection.data?.__schema.queryType.fields || [];
  const walletRelated = fields.filter(f => 
    f.name.toLowerCase().includes("wallet") ||
    f.name.toLowerCase().includes("holder") ||
    f.name.toLowerCase().includes("balance") ||
    f.name.toLowerCase().includes("transfer") ||
    f.name.toLowerCase().includes("address") ||
    f.name.toLowerCase().includes("transaction")
  );

  console.log("Wallet-related query types:");
  walletRelated.forEach(f => {
    console.log(`  - ${f.name}: ${f.description || "(no description)"}`);
  });

  console.log("\nAll available query types:");
  fields.forEach(f => {
    console.log(`  - ${f.name}`);
  });
}

async function introspectWalletTypes(): Promise<void> {
  console.log("\n=== WALLET TYPE INTROSPECTION ===\n");
  
  // Look for wallet-related types
  const typeNames = ["Wallet", "WalletBalance", "TokenHolder", "Transfer", "Transaction"];
  
  for (const typeName of typeNames) {
    const result = await query<{
      __type: {
        name: string;
        fields?: Array<{ name: string; type: { name?: string; kind: string } }>;
      } | null;
    }>(`{
      __type(name: "${typeName}") {
        name
        fields {
          name
          type {
            name
            kind
          }
        }
      }
    }`);

    if (result.data?.__type) {
      console.log(`\nType: ${typeName}`);
      result.data.__type.fields?.forEach(f => {
        console.log(`  - ${f.name}: ${f.type.name || f.type.kind}`);
      });
    }
  }
}

// ============================================================================
// TEST 1: WALLET TOKEN HOLDINGS
// ============================================================================

async function testWalletHoldings(walletAddress: string): Promise<void> {
  console.log("\n=== TEST: Wallet Token Holdings ===\n");
  console.log(`Testing wallet: ${walletAddress}`);

  // Try different potential query structures
  const queries = [
    // Query 1: walletTokenBalances
    {
      name: "walletTokenBalances",
      query: `query($address: String!, $networkId: Int!) {
        walletTokenBalances(input: { walletAddress: $address, networkId: $networkId }) {
          items {
            tokenAddress
            balance
            token {
              name
              symbol
            }
          }
        }
      }`,
    },
    // Query 2: wallet
    {
      name: "wallet",
      query: `query($address: String!, $networkId: Int!) {
        wallet(input: { address: $address, networkId: $networkId }) {
          address
          tokenBalances {
            tokenAddress
            balance
          }
        }
      }`,
    },
    // Query 3: getWalletHoldings
    {
      name: "getWalletHoldings",
      query: `query($address: String!, $networkId: Int!) {
        getWalletHoldings(input: { walletAddress: $address, networkId: $networkId }) {
          tokens {
            address
            balance
            symbol
          }
        }
      }`,
    },
  ];

  for (const q of queries) {
    console.log(`\nTrying ${q.name}...`);
    const result = await query(q.query, {
      address: walletAddress,
      networkId: SOLANA_NETWORK_ID,
    });

    if (result.errors) {
      console.log(`  Error: ${result.errors[0].message}`);
    } else {
      console.log(`  Success! Data:`, JSON.stringify(result.data, null, 2));
    }
  }
}

// ============================================================================
// TEST 2: TOP HOLDERS FOR TOKENS
// ============================================================================

async function testTopHolders(tokenAddress: string, tokenName: string, limit = 50): Promise<Array<{ address: string; balance: string; percentOwned: number }>> {
  console.log(`\n=== TEST: Top ${limit} Holders for ${tokenName} ===\n`);
  
  const result = await query<{
    tokenHolders: {
      items: Array<{ address: string; balance: string; percentOwned: number }>;
    };
  }>(`query($address: String!, $networkId: Int!, $limit: Int) {
    tokenHolders(input: { tokenAddress: $address, networkId: $networkId, limit: $limit }) {
      items {
        address
        balance
        percentOwned
      }
    }
  }`, {
    address: tokenAddress,
    networkId: SOLANA_NETWORK_ID,
    limit,
  });

  if (result.errors) {
    console.log(`Error: ${result.errors[0].message}`);
    return [];
  }

  const holders = result.data?.tokenHolders?.items || [];
  console.log(`Found ${holders.length} holders`);
  if (holders.length > 0) {
    console.log("Top 5:");
    holders.slice(0, 5).forEach((h, i) => {
      console.log(`  ${i + 1}. ${h.address} - ${h.percentOwned.toFixed(2)}%`);
    });
  }

  return holders;
}

// ============================================================================
// TEST 3: WALLET TRADING HISTORY
// ============================================================================

async function testWalletTradingHistory(walletAddress: string): Promise<void> {
  console.log("\n=== TEST: Wallet Trading History ===\n");
  console.log(`Testing wallet: ${walletAddress}`);

  const queries = [
    // Query 1: walletTransactions
    {
      name: "walletTransactions",
      query: `query($address: String!, $networkId: Int!) {
        walletTransactions(input: { walletAddress: $address, networkId: $networkId, limit: 10 }) {
          items {
            hash
            timestamp
            type
            tokenAddress
            amount
          }
        }
      }`,
    },
    // Query 2: walletSwaps
    {
      name: "walletSwaps", 
      query: `query($address: String!, $networkId: Int!) {
        walletSwaps(input: { walletAddress: $address, networkId: $networkId, limit: 10 }) {
          items {
            hash
            timestamp
            tokenIn
            tokenOut
            amountIn
            amountOut
          }
        }
      }`,
    },
    // Query 3: transfers
    {
      name: "transfers",
      query: `query($address: String!, $networkId: Int!) {
        transfers(input: { walletAddress: $address, networkId: $networkId, limit: 10 }) {
          items {
            hash
            timestamp
            from
            to
            tokenAddress
            amount
          }
        }
      }`,
    },
  ];

  for (const q of queries) {
    console.log(`\nTrying ${q.name}...`);
    const result = await query(q.query, {
      address: walletAddress,
      networkId: SOLANA_NETWORK_ID,
    });

    if (result.errors) {
      console.log(`  Error: ${result.errors[0].message}`);
    } else {
      console.log(`  Success! Data:`, JSON.stringify(result.data, null, 2));
    }
  }
}

// ============================================================================
// TEST 4: WALLET PNL
// ============================================================================

async function testWalletPnL(walletAddress: string): Promise<void> {
  console.log("\n=== TEST: Wallet PnL ===\n");
  console.log(`Testing wallet: ${walletAddress}`);

  const queries = [
    {
      name: "walletPnl",
      query: `query($address: String!, $networkId: Int!) {
        walletPnl(input: { walletAddress: $address, networkId: $networkId }) {
          totalPnl
          realizedPnl
          unrealizedPnl
          tokens {
            address
            symbol
            pnl
          }
        }
      }`,
    },
    {
      name: "walletStats",
      query: `query($address: String!, $networkId: Int!) {
        walletStats(input: { walletAddress: $address, networkId: $networkId }) {
          totalVolume
          totalTrades
          profitLoss
        }
      }`,
    },
  ];

  for (const q of queries) {
    console.log(`\nTrying ${q.name}...`);
    const result = await query(q.query, {
      address: walletAddress,
      networkId: SOLANA_NETWORK_ID,
    });

    if (result.errors) {
      console.log(`  Error: ${result.errors[0].message}`);
    } else {
      console.log(`  Success! Data:`, JSON.stringify(result.data, null, 2));
    }
  }
}

// ============================================================================
// TEST 5: WHALE OVERLAP ANALYSIS
// ============================================================================

async function testWhaleOverlap(): Promise<void> {
  console.log("\n=== TEST: Whale Overlap Analysis ===\n");

  // Get top 50 holders for each token
  const allHolders: Record<string, Set<string>> = {};
  
  for (const [name, address] of Object.entries(TOKENS)) {
    const holders = await testTopHolders(address, name, 50);
    allHolders[name] = new Set(holders.map(h => h.address));
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  // Calculate overlaps
  console.log("\n=== HOLDER OVERLAP MATRIX ===\n");
  
  const tokenNames = Object.keys(TOKENS);
  for (let i = 0; i < tokenNames.length; i++) {
    for (let j = i + 1; j < tokenNames.length; j++) {
      const token1 = tokenNames[i];
      const token2 = tokenNames[j];
      const set1 = allHolders[token1];
      const set2 = allHolders[token2];
      
      const overlap = [...set1].filter(addr => set2.has(addr));
      console.log(`${token1} ∩ ${token2}: ${overlap.length} common whales`);
      
      if (overlap.length > 0 && overlap.length <= 5) {
        console.log(`  Addresses: ${overlap.join(", ")}`);
      }
    }
  }
}

// ============================================================================
// TEST 6: EXCHANGE WALLET IDENTIFICATION
// ============================================================================

async function testExchangeIdentification(): Promise<void> {
  console.log("\n=== TEST: Exchange Wallet Identification ===\n");

  // Known exchange wallets on Solana
  const knownExchanges = [
    { name: "Binance", address: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9" },
    { name: "Coinbase", address: "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS" },
    { name: "FTX (defunct)", address: "6uGUx583UHvFKKCnoMfnGNEFxhSWy5iXXyea4o5E9iv7" },
  ];

  for (const exchange of knownExchanges) {
    console.log(`\nChecking ${exchange.name} wallet: ${exchange.address}`);
    
    // Check if this wallet appears in any token's top holders
    for (const [tokenName, tokenAddress] of Object.entries(TOKENS)) {
      const result = await query<{
        tokenHolders: {
          items: Array<{ address: string; percentOwned: number }>;
        };
      }>(`query($tokenAddress: String!, $walletAddress: String!, $networkId: Int!) {
        tokenHolders(input: { 
          tokenAddress: $tokenAddress, 
          networkId: $networkId,
          limit: 100
        }) {
          items {
            address
            percentOwned
          }
        }
      }`, {
        tokenAddress,
        walletAddress: exchange.address,
        networkId: SOLANA_NETWORK_ID,
      });

      if (!result.errors) {
        const holder = result.data?.tokenHolders?.items?.find(
          h => h.address === exchange.address
        );
        if (holder) {
          console.log(`  Found in ${tokenName} holders: ${holder.percentOwned.toFixed(2)}%`);
        }
      }
      
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

// ============================================================================
// TEST 7: TOKEN TRANSFERS
// ============================================================================

async function testTokenTransfers(tokenAddress: string, tokenName: string): Promise<void> {
  console.log(`\n=== TEST: Token Transfers for ${tokenName} ===\n`);

  const queries = [
    {
      name: "tokenTransfers",
      query: `query($address: String!, $networkId: Int!) {
        tokenTransfers(input: { tokenAddress: $address, networkId: $networkId, limit: 10 }) {
          items {
            hash
            timestamp
            from
            to
            amount
          }
        }
      }`,
    },
    {
      name: "tokenEvents",
      query: `query($address: String!, $networkId: Int!) {
        tokenEvents(input: { tokenAddress: $address, networkId: $networkId, limit: 10 }) {
          items {
            hash
            timestamp
            eventType
            from
            to
            amount
          }
        }
      }`,
    },
  ];

  for (const q of queries) {
    console.log(`\nTrying ${q.name}...`);
    const result = await query(q.query, {
      address: tokenAddress,
      networkId: SOLANA_NETWORK_ID,
    });

    if (result.errors) {
      console.log(`  Error: ${result.errors[0].message}`);
    } else {
      console.log(`  Success! Data:`, JSON.stringify(result.data, null, 2));
    }
  }
}

// ============================================================================
// TEST 8: WALLET FIRST/LAST ACTIVITY
// ============================================================================

async function testWalletActivity(walletAddress: string): Promise<void> {
  console.log("\n=== TEST: Wallet Activity Timestamps ===\n");
  console.log(`Testing wallet: ${walletAddress}`);

  const queries = [
    {
      name: "walletActivity",
      query: `query($address: String!, $networkId: Int!) {
        walletActivity(input: { walletAddress: $address, networkId: $networkId }) {
          firstActivityTimestamp
          lastActivityTimestamp
          totalTransactions
        }
      }`,
    },
    {
      name: "walletInfo",
      query: `query($address: String!, $networkId: Int!) {
        walletInfo(input: { address: $address, networkId: $networkId }) {
          createdAt
          lastActiveAt
          transactionCount
        }
      }`,
    },
  ];

  for (const q of queries) {
    console.log(`\nTrying ${q.name}...`);
    const result = await query(q.query, {
      address: walletAddress,
      networkId: SOLANA_NETWORK_ID,
    });

    if (result.errors) {
      console.log(`  Error: ${result.errors[0].message}`);
    } else {
      console.log(`  Success! Data:`, JSON.stringify(result.data, null, 2));
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("Codex.io Wallet Analytics Research");
  console.log("===================================\n");

  if (!API_KEY) {
    console.log("WARNING: No CODEX_API_KEY set. Some queries may fail.\n");
  }

  // Test wallet address (a known META holder for testing)
  const testWallet = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"; // Raydium authority

  try {
    // 1. Schema introspection
    await introspectSchema();
    await introspectWalletTypes();

    // 2. Wallet token holdings
    await testWalletHoldings(testWallet);

    // 3. Top holders for our target tokens
    for (const [name, address] of Object.entries(TOKENS)) {
      await testTopHolders(address, name, 50);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }

    // 4. Wallet trading history
    await testWalletTradingHistory(testWallet);

    // 5. Wallet PnL
    await testWalletPnL(testWallet);

    // 6. Whale overlap
    await testWhaleOverlap();

    // 7. Exchange identification
    await testExchangeIdentification();

    // 8. Token transfers
    await testTokenTransfers(TOKENS.META, "META");

    // 9. Wallet activity
    await testWalletActivity(testWallet);

  } catch (err) {
    console.error("Research script error:", err);
  }
}

main();
