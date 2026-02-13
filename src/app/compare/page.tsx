"use client";

const ALLOW_MOCKS = process.env.NEXT_PUBLIC_ALLOW_MOCKS === "true";

import { useState, useMemo } from "react";
import { METADAO_TOKENS, VC_TOKENS, ALL_TOKENS } from "@/data/tokens";
import { KpiCard } from "@/components/ui/KpiCard";
import { LorenzCurveChart } from "@/components/charts/LorenzCurve";
import { ChartContainer } from "@/components/charts/ChartContainer";
import {
  generateMetrics,
  generateLorenzPoints,
  generateCurrentPrice,
  getAllTokenSummaries,
  generateTradingMetrics,
} from "@/lib/mock-data";
import { decentralizationScore } from "@/lib/metrics/comparison";
import {
  CategoryBoxPlot,
  CategoryScatter,
  CategoryRadar,
  CategorySummaryTable,
  type CategoryStats,
} from "./category-charts";

type CompareMode = "category" | "token";

// ── Category Stats Calculation ───────────────────────────────────────────────

function computeCategoryStats(
  summaries: ReturnType<typeof getAllTokenSummaries>
): CategoryStats[] {
  const categoryGroups: Record<
    string,
    {
      gini: number[];
      nakamoto: number[];
      hhi: number[];
      entropy: number[];
      holders: number[];
      buyPressure: number[];
    }
  > = {};

  summaries.forEach((s) => {
    const cat = s.token.category;
    if (!categoryGroups[cat]) {
      categoryGroups[cat] = {
        gini: [],
        nakamoto: [],
        hhi: [],
        entropy: [],
        holders: [],
        buyPressure: [],
      };
    }

    const metrics = generateMetrics(s.token.id);
    const trading = generateTradingMetrics(s.token.id);

    categoryGroups[cat].gini.push(s.gini);
    categoryGroups[cat].nakamoto.push(s.nakamoto);
    categoryGroups[cat].hhi.push(metrics.hhi);
    categoryGroups[cat].entropy.push(metrics.shannonEntropy);
    categoryGroups[cat].holders.push(s.holders);
    categoryGroups[cat].buyPressure.push(trading.buyPressure * 100);
  });

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return Object.entries(categoryGroups).map(([category, data]) => ({
    category,
    tokens: data.gini.length,
    avgGini: avg(data.gini),
    avgNakamoto: avg(data.nakamoto),
    avgHHI: avg(data.hhi),
    avgEntropy: avg(data.entropy),
    avgHolders: avg(data.holders),
    avgBuyPressure: avg(data.buyPressure),
  }));
}

export default function ComparePage() {
  if (!ALLOW_MOCKS) {
    return <div className="p-8 text-ink">Compare analysis is gated until real data is wired.</div>;
  }
  const [mode, setMode] = useState<CompareMode>("category");
  const [metaId, setMetaId] = useState(METADAO_TOKENS[0].id);
  const [vcId, setVcId] = useState(VC_TOKENS[0].id);

  // Category mode data
  const summaries = useMemo(() => getAllTokenSummaries(), []);
  const categoryStats = useMemo(
    () => computeCategoryStats(summaries),
    [summaries]
  );

  // Token comparison mode data
  const metaToken =
    METADAO_TOKENS.find((t) => t.id === metaId) ?? METADAO_TOKENS[0];
  const vcToken = VC_TOKENS.find((t) => t.id === vcId) ?? VC_TOKENS[0];

  const metaMetrics = generateMetrics(metaId);
  const vcMetrics = generateMetrics(vcId);

  const metaLorenz = generateLorenzPoints(metaId);
  const vcLorenz = generateLorenzPoints(vcId);

  const metaScore = decentralizationScore(metaMetrics);
  const vcScore = decentralizationScore(vcMetrics);

  const giniDiff = (
    ((vcMetrics.giniCoefficient - metaMetrics.giniCoefficient) /
      vcMetrics.giniCoefficient) *
    100
  ).toFixed(0);

  return (
    <div>
      <h2 className="font-serif text-3xl font-bold text-ink mb-2">
        Token Comparison
      </h2>
      <p className="text-sm text-ink-muted mb-4">
        Analyze distribution metrics across categories or compare individual
        tokens
      </p>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("category")}
          className={`px-4 py-2 text-sm font-medium border transition-colors ${
            mode === "category"
              ? "bg-ink text-surface border-ink"
              : "bg-surface text-ink border-rule hover:border-ink"
          }`}
        >
          Category Analysis
        </button>
        <button
          onClick={() => setMode("token")}
          className={`px-4 py-2 text-sm font-medium border transition-colors ${
            mode === "token"
              ? "bg-ink text-surface border-ink"
              : "bg-surface text-ink border-rule hover:border-ink"
          }`}
        >
          Token vs Token
        </button>
      </div>

      {/* ── Category Comparison Mode ─────────────────────────────────────── */}
      {mode === "category" && (
        <div className="space-y-8">
          {/* Category Summary Table */}
          <ChartContainer
            title="Category Summary Statistics"
            subtitle="Aggregated metrics for each token category"
          >
            <CategorySummaryTable categoryStats={categoryStats} />
          </ChartContainer>

          {/* Scatter Plot */}
          <CategoryScatter summaries={summaries} />

          {/* Box Plots Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryBoxPlot summaries={summaries} metric="gini" />
            <CategoryBoxPlot summaries={summaries} metric="nakamoto" />
          </div>

          {/* Radar Chart */}
          <CategoryRadar categoryStats={categoryStats} />

          {/* Key Insights */}
          <div className="bg-surface border border-rule-light p-6">
            <h3 className="font-serif text-lg font-semibold text-ink mb-3">
              Key Insights
            </h3>
            <ul className="space-y-2 text-sm text-ink-muted">
              {(() => {
                const metadaoStats = categoryStats.find(
                  (c) => c.category === "metadao"
                );
                const vcStats = categoryStats.find(
                  (c) => c.category === "vc-backed"
                );
                const communityStats = categoryStats.find(
                  (c) => c.category === "community"
                );

                const insights: string[] = [];

                if (metadaoStats && vcStats) {
                  const giniDiff = (
                    ((vcStats.avgGini - metadaoStats.avgGini) /
                      vcStats.avgGini) *
                    100
                  ).toFixed(0);
                  insights.push(
                    `MetaDAO tokens show ${giniDiff}% lower Gini coefficients than VC-backed tokens on average, indicating more equitable distribution.`
                  );
                  insights.push(
                    `MetaDAO average Nakamoto coefficient (${Math.round(metadaoStats.avgNakamoto)}) is ${Math.round(metadaoStats.avgNakamoto / vcStats.avgNakamoto)}x higher than VC-backed (${Math.round(vcStats.avgNakamoto)}).`
                  );
                }

                if (communityStats) {
                  insights.push(
                    `Community tokens have the highest average holder counts (${Math.round(communityStats.avgHolders).toLocaleString()}) but also show more concentration.`
                  );
                }

                return insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-ink">•</span>
                    <span>{insight}</span>
                  </li>
                ));
              })()}
            </ul>
          </div>
        </div>
      )}

      {/* ── Token Comparison Mode ────────────────────────────────────────── */}
      {mode === "token" && (
        <>
          {/* Selectors */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-faint block mb-1">
                MetaDAO Token
              </label>
              <select
                value={metaId}
                onChange={(e) => setMetaId(e.target.value)}
                className="bg-surface border border-rule px-3 py-2 text-sm rounded"
              >
                {METADAO_TOKENS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.symbol} — {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2 text-ink-muted font-serif text-lg">
              vs
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-faint block mb-1">
                VC-Backed Token
              </label>
              <select
                value={vcId}
                onChange={(e) => setVcId(e.target.value)}
                className="bg-surface border border-rule px-3 py-2 text-sm rounded"
              >
                {VC_TOKENS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.symbol} — {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary Banner */}
          <div className="bg-wsj-blue-light border-l-4 border-wsj-blue p-4 mb-8">
            <p className="text-sm text-ink-light">
              <span className="font-semibold">{metaToken.symbol}</span> is{" "}
              <span className="font-bold text-wsj-blue">
                {giniDiff}% more decentralized
              </span>{" "}
              than <span className="font-semibold">{vcToken.symbol}</span> based
              on Gini coefficient ({metaMetrics.giniCoefficient.toFixed(3)} vs{" "}
              {vcMetrics.giniCoefficient.toFixed(3)})
            </p>
          </div>

          {/* Side-by-side metrics */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-wsj-blue font-semibold mb-3">
                {metaToken.symbol} (Futarchy)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  label="Gini"
                  value={metaMetrics.giniCoefficient.toFixed(3)}
                />
                <KpiCard
                  label="Nakamoto"
                  value={String(metaMetrics.nakamotoCoefficient)}
                />
                <KpiCard
                  label="Entropy"
                  value={metaMetrics.shannonEntropy.toFixed(2)}
                />
                <KpiCard
                  label="Score"
                  value={`${metaScore.overall} (${metaScore.grade})`}
                />
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-3">
                {vcToken.symbol} (VC-Backed)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  label="Gini"
                  value={vcMetrics.giniCoefficient.toFixed(3)}
                />
                <KpiCard
                  label="Nakamoto"
                  value={String(vcMetrics.nakamotoCoefficient)}
                />
                <KpiCard
                  label="Entropy"
                  value={vcMetrics.shannonEntropy.toFixed(2)}
                />
                <KpiCard
                  label="Score"
                  value={`${vcScore.overall} (${vcScore.grade})`}
                />
              </div>
            </div>
          </div>

          {/* Lorenz overlay */}
          <LorenzCurveChart
            data={metaLorenz}
            comparisonData={vcLorenz}
            tokenName={metaToken.symbol}
            comparisonName={vcToken.symbol}
            gini={metaMetrics.giniCoefficient}
          />

          {/* Token details */}
          <div className="grid grid-cols-2 gap-6 mt-8 text-sm text-ink-muted">
            <div>
              <p className="font-medium text-ink mb-1">{metaToken.name}</p>
              <p>{metaToken.description}</p>
              {metaToken.communityAllocationPct !== undefined && (
                <p className="mt-1">
                  Community allocation: {metaToken.communityAllocationPct}%
                </p>
              )}
            </div>
            <div>
              <p className="font-medium text-ink mb-1">{vcToken.name}</p>
              <p>{vcToken.description}</p>
              {vcToken.vcBackers && (
                <p className="mt-1">Backers: {vcToken.vcBackers.join(", ")}</p>
              )}
              {vcToken.investorAllocationPct !== undefined && (
                <p>Investor allocation: {vcToken.investorAllocationPct}%</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
