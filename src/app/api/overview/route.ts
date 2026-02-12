import { NextResponse } from "next/server";
import { ALL_TOKENS } from "@/data/tokens";
import { generateMetrics } from "@/lib/mock-data";

export async function GET() {
  const categories = {
    metadao: 0,
    vc: 0,
    community: 0,
  };

  const giniSums = {
    metadao: { total: 0, count: 0 },
    vc: { total: 0, count: 0 },
    community: { total: 0, count: 0 },
  };

  let bestDecentralized: { tokenId: string; gini: number } | null = null;
  let worstDecentralized: { tokenId: string; gini: number } | null = null;

  for (const token of ALL_TOKENS) {
    const metrics = generateMetrics(token.id);

    if (token.category === "metadao") {
      categories.metadao++;
      giniSums.metadao.total += metrics.giniCoefficient;
      giniSums.metadao.count++;
    } else if (token.category === "vc-backed") {
      categories.vc++;
      giniSums.vc.total += metrics.giniCoefficient;
      giniSums.vc.count++;
    } else if (token.category === "community") {
      categories.community++;
      giniSums.community.total += metrics.giniCoefficient;
      giniSums.community.count++;
    }

    // Lower Gini = more decentralized
    if (!bestDecentralized || metrics.giniCoefficient < bestDecentralized.gini) {
      bestDecentralized = { tokenId: token.id, gini: metrics.giniCoefficient };
    }
    if (
      !worstDecentralized ||
      metrics.giniCoefficient > worstDecentralized.gini
    ) {
      worstDecentralized = { tokenId: token.id, gini: metrics.giniCoefficient };
    }
  }

  const averages = {
    futarchyGini:
      giniSums.metadao.count > 0
        ? Math.round((giniSums.metadao.total / giniSums.metadao.count) * 1000) /
          1000
        : null,
    vcGini:
      giniSums.vc.count > 0
        ? Math.round((giniSums.vc.total / giniSums.vc.count) * 1000) / 1000
        : null,
    communityGini:
      giniSums.community.count > 0
        ? Math.round(
            (giniSums.community.total / giniSums.community.count) * 1000
          ) / 1000
        : null,
  };

  const response = NextResponse.json({
    totalTokens: ALL_TOKENS.length,
    categories,
    averages,
    topDecentralized: bestDecentralized?.tokenId ?? null,
    worstDecentralized: worstDecentralized?.tokenId ?? null,
    source: "mock",
    fetchedAt: new Date().toISOString(),
  });

  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
