import { NextRequest, NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import type { PersonaDistribution, HolderPersona } from "@/types";
import { ALLOW_MOCKS } from "@/lib/config";

// Seeded random for reproducible mock data
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

type CategoryType = "metadao" | "vc" | "community";

function getTokenCategoryType(tokenId: string): CategoryType {
  const token = ALL_TOKENS.find((t) => t.id === tokenId);
  const category = token?.category ?? "";

  if (
    category === "metadao" ||
    category === "metadao-ico" ||
    category === "futarchy-dao"
  ) {
    return "metadao";
  }
  if (category === "community") {
    return "community";
  }
  return "vc";
}

function generateMockPersonaDistribution(tokenId: string): PersonaDistribution {
  const rand = seededRandom(hashString(tokenId + "_personas"));
  const categoryType = getTokenCategoryType(tokenId);

  // Base holder count varies by category
  const baseHolders =
    categoryType === "metadao"
      ? 1500 + Math.floor(rand() * 1000)
      : categoryType === "community"
        ? 30000 + Math.floor(rand() * 20000)
        : 5000 + Math.floor(rand() * 5000);

  // Persona distribution ratios by category
  const ratios: Record<CategoryType, Record<HolderPersona, [number, number]>> = {
    metadao: {
      // MetaDAO: high diamond hands, good smart money, moderate accumulators
      diamond_hands: [0.25, 0.35],
      accumulator: [0.15, 0.22],
      trader: [0.08, 0.12],
      smart_money: [0.12, 0.18],
      hodler: [0.10, 0.16],
      inactive: [0.08, 0.15],
      new_entrant: [0.08, 0.15],
      whale_accumulator: [0.02, 0.05],
      whale_distributor: [0.01, 0.03],
      paper_hands: [0.02, 0.05],
    },
    community: {
      // Community: high traders, moderate new entrants, lower smart money
      diamond_hands: [0.10, 0.18],
      accumulator: [0.08, 0.14],
      trader: [0.25, 0.35],
      smart_money: [0.02, 0.05],
      inactive: [0.15, 0.25],
      new_entrant: [0.15, 0.25],
      hodler: [0.08, 0.14],
      whale_accumulator: [0.01, 0.03],
      whale_distributor: [0.01, 0.03],
      paper_hands: [0.10, 0.15],
    },
    vc: {
      // VC: moderate diamond hands, many inactive (locked/vested), low smart money
      diamond_hands: [0.15, 0.22],
      accumulator: [0.10, 0.15],
      trader: [0.12, 0.18],
      smart_money: [0.05, 0.10],
      inactive: [0.25, 0.35],
      new_entrant: [0.08, 0.15],
      hodler: [0.12, 0.20],
      whale_accumulator: [0.03, 0.06],
      whale_distributor: [0.02, 0.05],
      paper_hands: [0.05, 0.10],
    },
  };

  const categoryRatios = ratios[categoryType];

  // Generate persona counts
  const personas: Record<HolderPersona, number> = {} as Record<HolderPersona, number>;
  let totalClassified = 0;

  for (const [persona, [min, max]] of Object.entries(categoryRatios) as [
    HolderPersona,
    [number, number],
  ][]) {
    const ratio = min + rand() * (max - min);
    const count = Math.round(baseHolders * ratio);
    personas[persona] = count;
    totalClassified += count;
  }

  return {
    tokenId,
    timestamp: Date.now(),
    personas,
    totalClassified,
  };
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
    return NextResponse.json({ error: "Persona data unavailable (mock data disabled)." }, { status: 503 });
  }

  const distribution = generateMockPersonaDistribution(id);

  return NextResponse.json({
    data: distribution,
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });
}
