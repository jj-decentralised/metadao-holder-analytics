import { notFound } from "next/navigation";
import { ALL_TOKENS } from "@/data/tokens";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  generateCurrentPrice,
  generateMetrics,
  generateHolderBuckets,
  generatePriceHistory,
  generateLorenzPoints,
} from "@/lib/mock-data";
import { TokenDetailCharts } from "./charts";

export function generateStaticParams() {
  return ALL_TOKENS.map((t) => ({ id: t.id }));
}

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = ALL_TOKENS.find((t) => t.id === id);
  if (!token) notFound();

  const price = generateCurrentPrice(token.id);
  const metrics = generateMetrics(token.id);
  const buckets = generateHolderBuckets(token.id);
  const priceHistory = generatePriceHistory(token.id, 90);
  const lorenz = generateLorenzPoints(token.id);
  const totalHolders = buckets.whale + buckets.shark + buckets.dolphin + buckets.fish;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="font-serif text-3xl font-bold text-ink">
            {token.name}
          </h2>
          <span className="text-lg text-ink-muted">{token.symbol}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              token.category === "metadao"
                ? "bg-wsj-blue-light text-wsj-blue"
                : "bg-cream-dark text-ink-muted"
            }`}
          >
            {token.category}
          </span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="data-number text-3xl font-semibold">
            ${price.price.toFixed(price.price < 0.01 ? 6 : 2)}
          </span>
          <span
            className={`text-lg font-medium ${
              price.change24h >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {price.change24h >= 0 ? "+" : ""}
            {price.change24h.toFixed(1)}%
          </span>
        </div>
        {token.description && (
          <p className="text-sm text-ink-muted mt-2 max-w-2xl">
            {token.description}
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        <KpiCard label="Gini" value={metrics.giniCoefficient.toFixed(3)} detail="Lower = more equal" />
        <KpiCard label="HHI" value={metrics.hhi.toLocaleString()} detail="<1500 = low concentration" />
        <KpiCard label="Nakamoto" value={String(metrics.nakamotoCoefficient)} detail="Entities for 51%" />
        <KpiCard label="Palma" value={metrics.palmaRatio.toFixed(1)} detail="Top 10% / Bottom 40%" />
        <KpiCard label="Entropy" value={metrics.shannonEntropy.toFixed(2)} detail="Higher = more spread" />
        <KpiCard label="Holders" value={totalHolders.toLocaleString()} />
      </div>

      {/* Charts */}
      <TokenDetailCharts
        tokenName={token.symbol}
        priceHistory={priceHistory}
        lorenzPoints={lorenz}
        gini={metrics.giniCoefficient}
      />

      {/* Holder Breakdown */}
      <div className="mt-8 bg-surface border border-rule-light p-6">
        <h3 className="font-serif text-xl font-semibold text-ink mb-4">
          Holder Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              { label: "Whales", count: buckets.whale, desc: "≥1% of supply", color: "text-negative" },
              { label: "Sharks", count: buckets.shark, desc: "0.1-1%", color: "text-series-2" },
              { label: "Dolphins", count: buckets.dolphin, desc: "0.01-0.1%", color: "text-wsj-blue" },
              { label: "Fish", count: buckets.fish, desc: "<0.01%", color: "text-positive" },
            ] as const
          ).map((b) => (
            <div key={b.label} className="text-center">
              <p className={`data-number text-2xl font-semibold ${b.color}`}>
                {b.count.toLocaleString()}
              </p>
              <p className="text-sm font-medium text-ink">{b.label}</p>
              <p className="text-xs text-ink-faint">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Token Details */}
      <div className="mt-8 text-sm text-ink-muted space-y-1">
        <p><span className="font-medium text-ink">Mint:</span> <code className="text-xs bg-cream-dark px-1 py-0.5 rounded">{token.mintAddress}</code></p>
        <p><span className="font-medium text-ink">Chain:</span> {token.chain}</p>
        {token.launchDate && <p><span className="font-medium text-ink">Launch:</span> {token.launchDate}</p>}
        {token.vcBackers && token.vcBackers.length > 0 && (
          <p><span className="font-medium text-ink">VC Backers:</span> {token.vcBackers.join(", ")}</p>
        )}
      </div>
    </div>
  );
}
