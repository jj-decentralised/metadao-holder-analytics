import { notFound } from "next/navigation";
import { ALL_TOKENS } from "@/data/tokens";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  generateCurrentPrice,
  generateMetrics,
  generateHolderBuckets,
  generatePriceHistory,
  generateLorenzPoints,
  generateOHLCV,
  generateHolderTimeSeries,
  generateWhaleMovements,
  getCategoryAverages,
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
  const ohlcvData = generateOHLCV(token.id, 90);
  const holderTimeSeries = generateHolderTimeSeries(token.id, 180);
  const whaleMovements = generateWhaleMovements(token.id, 10);
  const categoryAverages = getCategoryAverages();
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
                : token.category === "community"
                ? "bg-positive/10 text-positive"
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

      {/* Charts - Comprehensive Analytics */}
      <TokenDetailCharts
        tokenName={token.symbol}
        tokenCategory={token.category}
        priceHistory={priceHistory}
        lorenzPoints={lorenz}
        gini={metrics.giniCoefficient}
        ohlcvData={ohlcvData}
        holderTimeSeries={holderTimeSeries}
        whaleMovements={whaleMovements}
        categoryAverages={categoryAverages}
      />

      {/* Section Divider */}
      <div className="my-10 border-t-2 border-rule-heavy" />

      {/* Holder Breakdown */}
      <h3 className="font-serif text-2xl font-bold text-ink mb-6 tracking-tight">
        Current Holder Breakdown
      </h3>
      <div className="bg-surface border border-rule-light p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {(
            [
              { label: "Whales", count: buckets.whale, desc: "≥1% of supply", color: "text-negative", icon: "🐋" },
              { label: "Sharks", count: buckets.shark, desc: "0.1-1%", color: "text-series-2", icon: "🦈" },
              { label: "Dolphins", count: buckets.dolphin, desc: "0.01-0.1%", color: "text-wsj-blue", icon: "🐬" },
              { label: "Fish", count: buckets.fish, desc: "<0.01%", color: "text-positive", icon: "🐟" },
            ] as const
          ).map((b) => (
            <div key={b.label} className="text-center p-4 bg-cream/50 rounded">
              <p className="text-2xl mb-1">{b.icon}</p>
              <p className={`data-number text-3xl font-bold ${b.color}`}>
                {b.count.toLocaleString()}
              </p>
              <p className="text-sm font-semibold text-ink mt-1">{b.label}</p>
              <p className="text-xs text-ink-faint">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section Divider */}
      <div className="my-10 border-t-2 border-rule-heavy" />

      {/* Token Details */}
      <h3 className="font-serif text-2xl font-bold text-ink mb-6 tracking-tight">
        Token Information
      </h3>
      <div className="bg-surface border border-rule-light p-6">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-semibold text-ink">Mint Address</dt>
            <dd className="text-ink-muted mt-1">
              <code className="text-xs bg-cream-dark px-2 py-1 rounded break-all">
                {token.mintAddress}
              </code>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Chain</dt>
            <dd className="text-ink-muted mt-1 capitalize">{token.chain}</dd>
          </div>
          {token.launchDate && (
            <div>
              <dt className="font-semibold text-ink">Launch Date</dt>
              <dd className="text-ink-muted mt-1">{token.launchDate}</dd>
            </div>
          )}
          {token.coingeckoId && (
            <div>
              <dt className="font-semibold text-ink">CoinGecko ID</dt>
              <dd className="text-ink-muted mt-1">{token.coingeckoId}</dd>
            </div>
          )}
          {token.vcBackers && token.vcBackers.length > 0 && (
            <div className="md:col-span-2">
              <dt className="font-semibold text-ink">VC Backers</dt>
              <dd className="text-ink-muted mt-1 flex flex-wrap gap-2">
                {token.vcBackers.map((backer) => (
                  <span
                    key={backer}
                    className="bg-cream-dark px-2 py-1 rounded text-xs"
                  >
                    {backer}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {(token.communityAllocationPct !== undefined ||
            token.teamAllocationPct !== undefined ||
            token.investorAllocationPct !== undefined) && (
            <div className="md:col-span-2">
              <dt className="font-semibold text-ink mb-2">Token Allocation</dt>
              <dd className="flex gap-4 flex-wrap">
                {token.communityAllocationPct !== undefined && (
                  <div className="text-center">
                    <p className="data-number text-lg font-semibold text-positive">
                      {token.communityAllocationPct}%
                    </p>
                    <p className="text-xs text-ink-faint">Community</p>
                  </div>
                )}
                {token.teamAllocationPct !== undefined && token.teamAllocationPct > 0 && (
                  <div className="text-center">
                    <p className="data-number text-lg font-semibold text-series-2">
                      {token.teamAllocationPct}%
                    </p>
                    <p className="text-xs text-ink-faint">Team</p>
                  </div>
                )}
                {token.investorAllocationPct !== undefined && token.investorAllocationPct > 0 && (
                  <div className="text-center">
                    <p className="data-number text-lg font-semibold text-wsj-blue">
                      {token.investorAllocationPct}%
                    </p>
                    <p className="text-xs text-ink-faint">Investors</p>
                  </div>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
