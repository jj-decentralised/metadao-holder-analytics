"use client";

import { useState } from "react";
import { METADAO_TOKENS, VC_TOKENS } from "@/data/tokens";
import { KpiCard } from "@/components/ui/KpiCard";
import { LorenzCurveChart } from "@/components/charts/LorenzCurve";
import {
  generateMetrics,
  generateLorenzPoints,
  generateCurrentPrice,
} from "@/lib/mock-data";
import { decentralizationScore } from "@/lib/metrics/comparison";

export default function ComparePage() {
  const [metaId, setMetaId] = useState(METADAO_TOKENS[0].id);
  const [vcId, setVcId] = useState(VC_TOKENS[0].id);

  const metaToken = METADAO_TOKENS.find((t) => t.id === metaId) ?? METADAO_TOKENS[0];
  const vcToken = VC_TOKENS.find((t) => t.id === vcId) ?? VC_TOKENS[0];

  const metaMetrics = generateMetrics(metaId);
  const vcMetrics = generateMetrics(vcId);
  const metaPrice = generateCurrentPrice(metaId);
  const vcPrice = generateCurrentPrice(vcId);

  const metaLorenz = generateLorenzPoints(metaId);
  const vcLorenz = generateLorenzPoints(vcId);

  const metaScore = decentralizationScore(metaMetrics);
  const vcScore = decentralizationScore(vcMetrics);

  const giniDiff = ((vcMetrics.giniCoefficient - metaMetrics.giniCoefficient) / vcMetrics.giniCoefficient * 100).toFixed(0);

  return (
    <div>
      <h2 className="font-serif text-3xl font-bold text-ink mb-2">
        Token Comparison
      </h2>
      <p className="text-sm text-ink-muted mb-6">
        Compare distribution metrics between MetaDAO and VC-backed tokens
      </p>

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
        <div className="flex items-end pb-2 text-ink-muted font-serif text-lg">vs</div>
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
          <span className="font-bold text-wsj-blue">{giniDiff}% more decentralized</span>{" "}
          than <span className="font-semibold">{vcToken.symbol}</span> based on
          Gini coefficient ({metaMetrics.giniCoefficient.toFixed(3)} vs{" "}
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
            <KpiCard label="Gini" value={metaMetrics.giniCoefficient.toFixed(3)} />
            <KpiCard label="Nakamoto" value={String(metaMetrics.nakamotoCoefficient)} />
            <KpiCard label="Entropy" value={metaMetrics.shannonEntropy.toFixed(2)} />
            <KpiCard label="Score" value={`${metaScore.overall} (${metaScore.grade})`} />
          </div>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-3">
            {vcToken.symbol} (VC-Backed)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Gini" value={vcMetrics.giniCoefficient.toFixed(3)} />
            <KpiCard label="Nakamoto" value={String(vcMetrics.nakamotoCoefficient)} />
            <KpiCard label="Entropy" value={vcMetrics.shannonEntropy.toFixed(2)} />
            <KpiCard label="Score" value={`${vcScore.overall} (${vcScore.grade})`} />
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
            <p className="mt-1">Community allocation: {metaToken.communityAllocationPct}%</p>
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
    </div>
  );
}
