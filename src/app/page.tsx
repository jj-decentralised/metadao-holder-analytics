import { KpiCard } from "@/components/ui/KpiCard";
import { METADAO_TOKENS, VC_TOKENS } from "@/data/tokens";

export default function Home() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <p className="dateline mb-6">{today}</p>

      {/* Hero */}
      <section className="mb-10">
        <h2 className="font-serif text-4xl font-bold text-ink leading-tight mb-3">
          Does Futarchy Create Better Token Holders?
        </h2>
        <p className="text-lg text-ink-light max-w-3xl leading-relaxed">
          MetaDAO pioneered futarchy-based governance on Solana, where market
          mechanisms replace traditional voting. This analysis compares how
          tokens governed by futarchy differ from VC-backed tokens in holder
          concentration, behavior, and long-term distribution patterns.
        </p>
      </section>

      {/* KPI Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <KpiCard
          label="MetaDAO Tokens Tracked"
          value={String(METADAO_TOKENS.length)}
          detail="Futarchy-governed"
        />
        <KpiCard
          label="VC Tokens Tracked"
          value={String(VC_TOKENS.length)}
          detail="For comparison"
        />
        <KpiCard label="Avg Gini (MetaDAO)" value="—" detail="Loading..." />
        <KpiCard label="Avg Gini (VC)" value="—" detail="Loading..." />
      </section>

      {/* Token Grid */}
      <section className="mb-10">
        <h2 className="font-serif text-2xl font-semibold text-ink mb-1">
          Token Universe
        </h2>
        <p className="text-sm text-ink-muted mb-4">
          All tracked tokens across MetaDAO ecosystem and VC-backed comparisons
        </p>
        <div className="rule-heavy" />

        <div className="mb-6">
          <h3 className="text-xs uppercase tracking-wider text-wsj-blue font-semibold mt-4 mb-3">
            MetaDAO Ecosystem
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {METADAO_TOKENS.map((token) => (
              <div
                key={token.id}
                className="bg-surface border border-rule-light p-4 hover:border-wsj-blue transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-ink">{token.symbol}</span>
                  <span className="text-xs bg-wsj-blue-light text-wsj-blue px-2 py-0.5 rounded">
                    futarchy
                  </span>
                </div>
                <p className="text-sm text-ink-muted">{token.name}</p>
                {token.launchDate && (
                  <p className="text-xs text-ink-faint mt-1">
                    Since {token.launchDate}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wider text-ink-muted font-semibold mb-3">
            VC-Backed Comparison Set
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {VC_TOKENS.map((token) => (
              <div
                key={token.id}
                className="bg-surface border border-rule-light p-4 hover:border-ink-faint transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-ink">{token.symbol}</span>
                  <span className="text-xs bg-cream-dark text-ink-muted px-2 py-0.5 rounded">
                    {token.category}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">{token.name}</p>
                <div className="mt-2 flex gap-3 text-xs text-ink-faint">
                  {token.investorAllocationPct !== undefined && (
                    <span>VC: {token.investorAllocationPct}%</span>
                  )}
                  {token.communityAllocationPct !== undefined && (
                    <span>Community: {token.communityAllocationPct}%</span>
                  )}
                </div>
                {token.vcBackers && token.vcBackers.length > 0 && (
                  <p className="text-xs text-ink-faint mt-1 truncate">
                    {token.vcBackers.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
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
