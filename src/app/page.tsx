import Link from "next/link";
import { KpiCard } from "@/components/ui/KpiCard";
import { getAllTokenSummaries, type TokenSummary } from "@/lib/mock-data";

// Category badge colors
const categoryStyles: Record<string, { bg: string; text: string; label: string }> = {
  metadao: { bg: "bg-wsj-blue-light", text: "text-wsj-blue", label: "futarchy" },
  "metadao-ico": { bg: "bg-wsj-blue-light", text: "text-wsj-blue", label: "futarchy" },
  "futarchy-dao": { bg: "bg-positive-light", text: "text-positive", label: "futarchy dao" },
  "vc-backed": { bg: "bg-cream-dark", text: "text-ink-muted", label: "vc-backed" },
  community: { bg: "bg-negative-light", text: "text-negative", label: "community" },
};

function getCategoryStyle(category: string) {
  return categoryStyles[category] ?? { bg: "bg-cream-dark", text: "text-ink-muted", label: category };
}

export default function Home() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Get all token summaries with computed metrics
  const summaries = getAllTokenSummaries();

  // Group tokens by category
  const futarchyCategories = ["metadao", "metadao-ico", "futarchy-dao"];
  const metadaoCoreTokens = summaries.filter(
    (s) => s.token.category === "metadao" || s.token.category === "metadao-ico"
  );
  const futarchyDaoTokens = summaries.filter((s) => s.token.category === "futarchy-dao");
  const vcTokens = summaries.filter((s) => s.token.category === "vc-backed");
  const communityTokens = summaries.filter((s) => s.token.category === "community");

  // Compute counts
  const metadaoCount = metadaoCoreTokens.length;
  const futarchyDaoCount = futarchyDaoTokens.length;
  const vcCount = vcTokens.length;
  const communityCount = communityTokens.length;

  // Compute average Gini for each group
  const avgGini = (tokens: TokenSummary[]) =>
    tokens.length > 0
      ? tokens.reduce((sum, t) => sum + t.gini, 0) / tokens.length
      : 0;

  const futarchyTokens = summaries.filter((s) => futarchyCategories.includes(s.token.category));
  const avgGiniFutarchy = avgGini(futarchyTokens);
  const avgGiniVC = avgGini(vcTokens);
  const avgGiniCommunity = avgGini(communityTokens);

  // Total holders tracked
  const totalHolders = summaries.reduce((sum, s) => sum + s.holders, 0);

  // Key insight calculation
  const giniDifference = avgGiniVC - avgGiniFutarchy;
  const percentMoreEquitable = avgGiniVC > 0 ? ((giniDifference / avgGiniVC) * 100) : 0;

  return (
    <div>
      <p className="dateline mb-6">{today}</p>

      {/* Hero */}
      <section className="mb-10">
        <h2 className="font-serif text-4xl font-bold text-ink leading-tight mb-3">
          Does Futarchy Create Better Token Holders?
        </h2>
        <p className="text-lg text-ink-light max-w-3xl leading-relaxed">
          Analyzing token holder distribution across futarchy-governed tokens,
          futarchy-adopting DAOs, VC-backed tokens, and community tokens.
          This study compares concentration metrics to determine whether
          governance mechanisms impact long-term holder distribution patterns.
        </p>
      </section>

      {/* KPI Grid - 2 rows of 4 */}
      <section className="mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <KpiCard
            label="MetaDAO Tokens"
            value={String(metadaoCount)}
            detail="Futarchy-governed"
          />
          <KpiCard
            label="Futarchy DAOs"
            value={String(futarchyDaoCount)}
            detail="Adopting futarchy"
          />
          <KpiCard
            label="VC Tokens"
            value={String(vcCount)}
            detail="For comparison"
          />
          <KpiCard
            label="Community Tokens"
            value={String(communityCount)}
            detail="Control group"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Avg Gini (Futarchy)"
            value={avgGiniFutarchy.toFixed(2)}
            detail="Lower = more equal"
          />
          <KpiCard
            label="Avg Gini (VC)"
            value={avgGiniVC.toFixed(2)}
            detail="Lower = more equal"
          />
          <KpiCard
            label="Avg Gini (Community)"
            value={avgGiniCommunity.toFixed(2)}
            detail="Lower = more equal"
          />
          <KpiCard
            label="Total Holders Tracked"
            value={totalHolders.toLocaleString()}
            detail="Across all tokens"
          />
        </div>
      </section>

      {/* Key Insight Callout */}
      <section className="mb-10 bg-surface border-l-4 border-wsj-blue p-6">
        <h3 className="font-serif text-lg font-semibold text-ink mb-2">Key Finding</h3>
        <p className="text-ink-light leading-relaxed">
          Futarchy-governed tokens show an average Gini coefficient of{" "}
          <span className="font-semibold text-ink">{avgGiniFutarchy.toFixed(2)}</span> vs{" "}
          <span className="font-semibold text-ink">{avgGiniVC.toFixed(2)}</span> for VC-backed
          tokens — indicating{" "}
          <span className="font-semibold text-positive">
            {percentMoreEquitable.toFixed(0)}% more equitable
          </span>{" "}
          distribution.
        </p>
      </section>

      {/* Token Universe Grid - 4 sections */}
      <section className="mb-10">
        <h2 className="font-serif text-2xl font-semibold text-ink mb-1">
          Token Universe
        </h2>
        <p className="text-sm text-ink-muted mb-4">
          All tracked tokens across futarchy ecosystems, VC-backed, and community tokens
        </p>
        <div className="rule-heavy" />

        {/* MetaDAO Core */}
        {metadaoCoreTokens.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-wsj-blue font-semibold mt-4 mb-3">
              MetaDAO Core
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {metadaoCoreTokens.map((summary) => (
                <TokenCard key={summary.token.id} summary={summary} />
              ))}
            </div>
          </div>
        )}

        {/* Futarchy-Adopting DAOs */}
        {futarchyDaoTokens.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-positive font-semibold mt-4 mb-3">
              Futarchy-Adopting DAOs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {futarchyDaoTokens.map((summary) => (
                <TokenCard key={summary.token.id} summary={summary} />
              ))}
            </div>
          </div>
        )}

        {/* VC-Backed Comparison */}
        {vcTokens.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-ink-muted font-semibold mt-4 mb-3">
              VC-Backed Comparison
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {vcTokens.map((summary) => (
                <TokenCard key={summary.token.id} summary={summary} />
              ))}
            </div>
          </div>
        )}

        {/* Community Control Group */}
        {communityTokens.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase tracking-wider text-negative font-semibold mt-4 mb-3">
              Community Control Group
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {communityTokens.map((summary) => (
                <TokenCard key={summary.token.id} summary={summary} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Methodology teaser */}
      <section className="border-t border-rule pt-6">
        <h2 className="font-serif text-xl font-semibold text-ink mb-2">
          Methodology
        </h2>
        <p className="text-sm text-ink-muted max-w-2xl">
          We compute Gini coefficients, Herfindahl-Hirschman Index (HHI),
          Nakamoto coefficients, and Shannon entropy across all token holders
          using on-chain data from Codex.io. Price data sourced from CoinGecko
          and DeFiLlama.
        </p>
      </section>
    </div>
  );
}

// Token Card Component
function TokenCard({ summary }: { summary: TokenSummary }) {
  const { token, gini, holders } = summary;
  const style = getCategoryStyle(token.category);

  return (
    <Link
      href={`/tokens/${token.id}`}
      className="bg-surface border border-rule-light p-4 hover:border-wsj-blue transition-colors block"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-ink">{token.symbol}</span>
        <span className={`text-xs ${style.bg} ${style.text} px-2 py-0.5 rounded`}>
          {style.label}
        </span>
      </div>
      <p className="text-sm text-ink-muted">{token.name}</p>
      <div className="mt-2 flex gap-4 text-xs text-ink-faint">
        <span>Gini: <span className="data-number font-medium text-ink">{gini.toFixed(2)}</span></span>
        <span>Holders: <span className="data-number font-medium text-ink">{holders.toLocaleString()}</span></span>
      </div>
    </Link>
  );
}
