import { Codex } from "@codex-data/sdk";

// MetaDAO token address on Solana
export const METADAO_TOKEN = "METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr";

let codexClient: Codex | null = null;

export function getCodexClient(): Codex {
  if (!codexClient) {
    const apiKey = process.env.CODEX_API_KEY;
    if (!apiKey) {
      throw new Error("CODEX_API_KEY environment variable is required");
    }
    codexClient = new Codex(apiKey);
  }
  return codexClient;
}

export interface HolderData {
  address: string;
  balance: string;
  balanceUsd: number;
  percentage: number;
}

export interface HolderStats {
  totalHolders: number;
  top10Percentage: number;
  top50Percentage: number;
  medianBalance: number;
  holders: HolderData[];
}

// Solana network ID for Codex
export const SOLANA_NETWORK_ID = 1399811149;

export async function getMetaDAOHolders(): Promise<HolderStats> {
  const codex = getCodexClient();
  
  try {
    // Fetch token holders from Codex API
    // tokenId format is "tokenAddress:networkId"
    const tokenId = `${METADAO_TOKEN}:${SOLANA_NETWORK_ID}`;
    
    const response = await codex.queries.holders({
      input: {
        tokenId,
        limit: 100,
      },
    });

    const holders = response?.holders?.items || [];
    const totalHolders = response?.holders?.count || holders.length;
    const top10Pct = response?.holders?.top10HoldersPercent || 0;

    // Calculate holder statistics
    const holdersWithData: HolderData[] = holders.map((holder: any, index: number) => {
      const balance = parseFloat(holder.balance || "0");
      const totalSupply = holders.reduce((sum: number, h: any) => sum + parseFloat(h.balance || "0"), 0);
      
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
    
    const balances = holdersWithData.map(h => parseFloat(h.balance));
    const medianBalance = balances.length > 0 
      ? balances[Math.floor(balances.length / 2)] 
      : 0;

    return {
      totalHolders,
      top10Percentage,
      top50Percentage,
      medianBalance,
      holders: holdersWithData,
    };
  } catch (error) {
    console.error("Error fetching holders:", error);
    // Return mock data for demo if API fails
    return getMockHolderData();
  }
}

function getMockHolderData(): HolderStats {
  const mockHolders: HolderData[] = Array.from({ length: 50 }, (_, i) => ({
    address: `${i + 1}...${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 5) % 26))}`,
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
