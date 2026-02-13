import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import { generateHolderBuckets } from "@/lib/mock-data";
import { ALLOW_MOCKS } from "@/lib/config";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateAddress(rand: () => number): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let address = "";
  for (let i = 0; i < 44; i++) {
    address += chars[Math.floor(rand() * chars.length)];
  }
  return address;
}

interface WhaleMovement {
  address: string;
  timestamp: number;
  type: "buy" | "sell" | "transfer_in" | "transfer_out";
  amount: number;
  percentOfSupply: number;
}

interface TopHolder {
  address: string;
  balance: number;
  percentOfSupply: number;
}

function generateWhaleMovements(tokenId: string): WhaleMovement[] {
  const rand = seededRandom(hashString(tokenId + "_whale_movements"));
  const movements: WhaleMovement[] = [];
  const now = Date.now();

  const movementTypes: WhaleMovement["type"][] = [
    "buy",
    "sell",
    "transfer_in",
    "transfer_out",
  ];
  const numMovements = 10 + Math.floor(rand() * 15);

  for (let i = 0; i < numMovements; i++) {
    const daysAgo = Math.floor(rand() * 30);
    const hoursAgo = Math.floor(rand() * 24);
    const timestamp = now - daysAgo * 86400000 - hoursAgo * 3600000;

    movements.push({
      address: generateAddress(rand),
      timestamp,
      type: movementTypes[Math.floor(rand() * movementTypes.length)],
      amount: Math.round((100000 + rand() * 5000000) * 100) / 100,
      percentOfSupply: Math.round((0.1 + rand() * 2.5) * 1000) / 1000,
    });
  }

  return movements.sort((a, b) => b.timestamp - a.timestamp);
}

function generateTopHolders(tokenId: string): TopHolder[] {
  const rand = seededRandom(hashString(tokenId + "_top_holders"));
  const token = ALL_TOKENS.find((t) => t.id === tokenId);
  const isMetadao = token?.category === "metadao";
  const buckets = generateHolderBuckets(tokenId);

  const topHolders: TopHolder[] = [];
  let remainingPercent = isMetadao ? 35 : 65;

  const numTopHolders = Math.min(buckets.whale + 5, 20);

  for (let i = 0; i < numTopHolders; i++) {
    const maxAlloc = remainingPercent * (0.1 + rand() * 0.4);
    const percentOfSupply = Math.round(maxAlloc * 1000) / 1000;
    remainingPercent -= percentOfSupply;

    topHolders.push({
      address: generateAddress(rand),
      balance: Math.round((percentOfSupply / 100) * 1000000000 * 100) / 100,
      percentOfSupply,
    });

    if (remainingPercent <= 0.1) break;
  }

  return topHolders.sort((a, b) => b.percentOfSupply - a.percentOfSupply);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = ALL_TOKENS.find((t) => t.id === id);
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  if (!ALLOW_MOCKS) {
    return NextResponse.json({ error: "Whale data unavailable (mock data disabled)." }, { status: 503 });
  }

  const movements = generateWhaleMovements(token.id);
  const topHolders = generateTopHolders(token.id);

  const response = NextResponse.json({
    tokenId: id,
    movements,
    topHolders,
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });

  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
