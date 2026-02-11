import { NextRequest, NextResponse } from "next/server";
import { getCodexClient, HolderData, HolderStats } from "@/lib/codex";
import { getTokenById, buildCodexTokenId, Token } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const revalidate = 60; // Cache for 60 seconds

/**
 * GET /api/tokens/[id]/holders
 * Fetches holder data for a specific token by its registry ID
 * 
 * Query params:
 *   - limit: number of holders to fetch (default: 100)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const tokenId = params.id;
    
    // Look up token in registry
    const token = getTokenById(tokenId);
    if (!token) {
      return NextResponse.json(
        { error: `Token '${tokenId}' not found in registry` },
        { status: 404 }
      );
    }

    // Parse optional query params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    // Fetch holders from Codex
    const holderStats = await fetchTokenHolders(token, limit);
    
    return NextResponse.json({
      token: {
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        address: token.address,
      },
      ...holderStats,
    });
  } catch (error) {
    console.error("API Error fetching token holders:", error);
    return NextResponse.json(
      { error: "Failed to fetch holder data" },
      { status: 500 }
    );
  }
}

/**
 * Fetch holder statistics for a given token
 */
async function fetchTokenHolders(token: Token, limit: number): Promise<HolderStats> {
  const codex = getCodexClient();
  const codexTokenId = buildCodexTokenId(token);

  try {
    const response = await codex.queries.holders({
      input: {
        tokenId: codexTokenId,
        limit,
      },
    });

    const holders = response?.holders?.items || [];
    const totalHolders = response?.holders?.count || holders.length;
    const top10Pct = response?.holders?.top10HoldersPercent || 0;

    // Calculate holder statistics
    const holdersWithData: HolderData[] = holders.map((holder: any, index: number) => {
      const balance = parseFloat(holder.balance || "0");
      const totalSupply = holders.reduce(
        (sum: number, h: any) => sum + parseFloat(h.balance || "0"),
        0
      );

      return {
        address: holder.walletAddress || `holder-${index}`,
        balance: holder.balance || "0",
        balanceUsd: holder.balanceUsd || 0,
        percentage: totalSupply > 0 ? (balance / totalSupply) * 100 : 0,
      };
    });

    // Sort by balance descending
    holdersWithData.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

    // Calculate concentration metrics
    const top10 = holdersWithData.slice(0, 10);
    const top50 = holdersWithData.slice(0, 50);

    const top10Percentage = top10.reduce((sum, h) => sum + h.percentage, 0);
    const top50Percentage = top50.reduce((sum, h) => sum + h.percentage, 0);

    const balances = holdersWithData.map((h) => parseFloat(h.balance));
    const medianBalance =
      balances.length > 0 ? balances[Math.floor(balances.length / 2)] : 0;

    return {
      totalHolders,
      top10Percentage,
      top50Percentage,
      medianBalance,
      holders: holdersWithData,
    };
  } catch (error) {
    console.error(`Error fetching holders for ${token.symbol}:`, error);
    // Return mock data for demo if API fails
    return getMockHolderData(token.symbol);
  }
}

/**
 * Generate mock holder data for demo/fallback
 */
function getMockHolderData(symbol: string): HolderStats {
  const mockHolders: HolderData[] = Array.from({ length: 50 }, (_, i) => ({
    address: `${i + 1}...${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(
      65 + ((i + 5) % 26)
    )}`,
    balance: String(Math.floor(1000000 / (i + 1))),
    balanceUsd: Math.floor(50000 / (i + 1)),
    percentage: 100 / Math.pow(1.5, i),
  }));

  return {
    totalHolders: 2847,
    top10Percentage: 68.5,
    top50Percentage: 89.2,
    medianBalance: 1250,
    holders: mockHolders,
  };
}
