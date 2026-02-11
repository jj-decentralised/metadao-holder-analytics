import { SOLANA_NETWORK_ID } from "./codex";

export interface Token {
  id: string; // Unique identifier for the token (used in URLs)
  name: string;
  symbol: string;
  address: string;
  networkId: number;
  coingeckoId: string;
  decimals: number;
  logoUrl?: string;
}

/**
 * Token registry for MetaDAO ecosystem tokens on Solana
 */
export const TOKEN_REGISTRY: Token[] = [
  {
    id: "meta",
    name: "MetaDAO",
    symbol: "META",
    address: "METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr",
    networkId: SOLANA_NETWORK_ID,
    coingeckoId: "meta-dao",
    decimals: 9,
  },
  {
    id: "usdc",
    name: "USD Coin",
    symbol: "USDC",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    networkId: SOLANA_NETWORK_ID,
    coingeckoId: "usd-coin",
    decimals: 6,
  },
  {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    address: "So11111111111111111111111111111111111111112",
    networkId: SOLANA_NETWORK_ID,
    coingeckoId: "solana",
    decimals: 9,
  },
];

/**
 * Map of token id -> Token for fast lookups
 */
export const TOKEN_MAP: Map<string, Token> = new Map(
  TOKEN_REGISTRY.map((token) => [token.id, token])
);

/**
 * Get a token by its ID
 */
export function getTokenById(id: string): Token | undefined {
  return TOKEN_MAP.get(id);
}

/**
 * Get a token by its address
 */
export function getTokenByAddress(address: string): Token | undefined {
  return TOKEN_REGISTRY.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get all registered tokens
 */
export function getAllTokens(): Token[] {
  return [...TOKEN_REGISTRY];
}

/**
 * Build a Codex tokenId from a Token object
 * Format: "tokenAddress:networkId"
 */
export function buildCodexTokenId(token: Token): string {
  return `${token.address}:${token.networkId}`;
}
