export default function MethodologyPage() {
  return (
    <article className="max-w-3xl">
      <h2 className="font-serif text-4xl font-bold text-ink mb-2">
        Methodology
      </h2>
      <p className="dateline mb-8">Research Notes</p>

      {/* Why */}
      <section className="mb-10">
        <h3 className="font-serif text-2xl font-semibold text-ink mb-3">
          Why Study Token Distribution?
        </h3>
        <p className="text-ink-light leading-relaxed mb-4">
          Token distribution is the single most important structural factor in
          decentralized governance. A protocol can have the most elegant voting
          mechanism, but if 5 wallets control 80% of the supply, governance is
          effectively centralized. Distribution metrics give us a quantitative
          lens to evaluate how power is actually distributed in DAOs.
        </p>
        <div className="bg-wsj-blue-light border-l-4 border-wsj-blue p-4 my-4">
          <p className="text-sm font-medium text-ink-light italic">
            &ldquo;The distribution of tokens is the constitution of a DAO — it
            determines who has voice and how much.&rdquo;
          </p>
        </div>
      </section>

      {/* Hypothesis */}
      <section className="mb-10">
        <h3 className="font-serif text-2xl font-semibold text-ink mb-3">
          The MetaDAO Hypothesis
        </h3>
        <p className="text-ink-light leading-relaxed mb-4">
          MetaDAO uses futarchy — a governance system where decisions are made by
          markets rather than votes. Token holders express preferences through
          conditional markets: &ldquo;What will the token price be if we implement
          proposal X vs proposal Y?&rdquo;
        </p>
        <p className="text-ink-light leading-relaxed mb-4">
          Our hypothesis: futarchy-based tokens attract a different type of holder.
          Because governance power comes from market participation rather than raw
          token holdings, we expect MetaDAO ecosystem tokens to show more
          decentralized distribution, longer hold times, and less whale
          concentration compared to traditional VC-backed tokens.
        </p>
      </section>

      {/* Metrics */}
      <section className="mb-10">
        <h3 className="font-serif text-2xl font-semibold text-ink mb-3">
          Metrics Explained
        </h3>

        <div className="space-y-6">
          <div className="border-b border-rule-light pb-4">
            <h4 className="font-semibold text-ink mb-1">Gini Coefficient</h4>
            <p className="text-sm text-ink-muted mb-2">
              Measures inequality in the distribution of holdings. Ranges from 0
              (perfect equality — everyone holds the same amount) to 1 (maximum
              inequality — one wallet holds everything). Derived from the Lorenz
              curve: the area between the curve and the line of equality.
            </p>
            <div className="bg-cream-dark p-3 rounded text-xs text-ink-muted font-mono">
              G = (2·Σ(i·xᵢ)) / (n·Σxᵢ) - (n+1)/n
            </div>
          </div>

          <div className="border-b border-rule-light pb-4">
            <h4 className="font-semibold text-ink mb-1">
              Herfindahl-Hirschman Index (HHI)
            </h4>
            <p className="text-sm text-ink-muted">
              Sum of squared market shares. Used by the DOJ/FTC for antitrust
              analysis. Below 1,500 = low concentration. 1,500–2,500 = moderate.
              Above 2,500 = high concentration. We apply this to token holder
              shares to assess concentration risk.
            </p>
          </div>

          <div className="border-b border-rule-light pb-4">
            <h4 className="font-semibold text-ink mb-1">
              Nakamoto Coefficient
            </h4>
            <p className="text-sm text-ink-muted">
              The minimum number of entities needed to control 51% of the supply.
              Named after Satoshi Nakamoto. Higher is better — it means more
              entities would need to collude to take control. A Nakamoto
              coefficient of 1 means a single entity controls a majority.
            </p>
          </div>

          <div className="border-b border-rule-light pb-4">
            <h4 className="font-semibold text-ink mb-1">Shannon Entropy</h4>
            <p className="text-sm text-ink-muted">
              Information-theoretic measure of distribution randomness. Maximum
              entropy = log₂(n) when all holders have equal shares. We also
              compute normalized entropy (0–1 scale) for easier comparison
              across tokens with different holder counts.
            </p>
          </div>

          <div className="pb-4">
            <h4 className="font-semibold text-ink mb-1">Palma Ratio</h4>
            <p className="text-sm text-ink-muted">
              Ratio of the share held by the top 10% to the share held by the
              bottom 40%. Based on economist José Gabriel Palma&apos;s observation that
              the middle 50% tends to capture a consistent share. A Palma ratio
              of 10 means the top 10% hold 10x more than the bottom 40%.
            </p>
          </div>
        </div>
      </section>

      {/* Behavior */}
      <section className="mb-10">
        <h3 className="font-serif text-2xl font-semibold text-ink mb-3">
          Holder Behavior Categories
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "Diamond Hands", desc: "Held >180 days with <10% balance change. Long-term conviction holders." },
            { name: "Accumulators", desc: "Net increase >20% over the analysis period. Building positions." },
            { name: "Distributors", desc: "Net decrease >20%. Reducing exposure or taking profits." },
            { name: "Flippers", desc: "Hold time <7 days or high-frequency trading. Short-term speculators." },
            { name: "New Entrants", desc: "First appeared in the most recent snapshot period." },
            { name: "Exited", desc: "Present in previous snapshot but not in current. Sold entire position." },
          ].map((cat) => (
            <div key={cat.name} className="bg-surface border border-rule-light p-3">
              <p className="font-semibold text-ink text-sm">{cat.name}</p>
              <p className="text-xs text-ink-muted mt-1">{cat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data Sources */}
      <section className="mb-10">
        <h3 className="font-serif text-2xl font-semibold text-ink mb-3">
          Data Sources
        </h3>
        <div className="space-y-3 text-sm text-ink-muted">
          <p>
            <span className="font-medium text-ink">CoinGecko</span> — Price
            history, market cap, trading volume. Free tier: 30 calls/min.
          </p>
          <p>
            <span className="font-medium text-ink">DeFiLlama</span> — Protocol
            TVL, token prices via on-chain data. Free, no API key needed.
          </p>
          <p>
            <span className="font-medium text-ink">Codex.io</span> — On-chain
            holder data, wallet balances, holder counts. GraphQL API. This is
            the primary source for distribution analysis.
          </p>
        </div>
      </section>

      {/* Limitations */}
      <section className="mb-10">
        <h3 className="font-serif text-2xl font-semibold text-ink mb-3">
          Limitations
        </h3>
        <ul className="list-disc list-inside text-sm text-ink-muted space-y-2">
          <li>
            <span className="font-medium text-ink">Exchange wallets:</span>{" "}
            Centralized exchange wallets hold tokens on behalf of many users,
            inflating concentration metrics.
          </li>
          <li>
            <span className="font-medium text-ink">Multi-wallet holders:</span>{" "}
            A single entity may control multiple wallets, making distribution
            appear more equal than it actually is.
          </li>
          <li>
            <span className="font-medium text-ink">Protocol-owned liquidity:</span>{" "}
            DAO treasuries and LP positions affect metrics but represent
            collective rather than individual holdings.
          </li>
          <li>
            <span className="font-medium text-ink">Temporal coverage:</span>{" "}
            Historical holder snapshots may not be available for all tokens,
            limiting time-series analysis.
          </li>
          <li>
            <span className="font-medium text-ink">Correlation ≠ causation:</span>{" "}
            Differences between MetaDAO and VC tokens may reflect selection
            effects rather than governance mechanism effects.
          </li>
        </ul>
      </section>
    </article>
  );
}
