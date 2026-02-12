import Link from "next/link";
import { getAllTokenSummaries } from "@/lib/mock-data";
import { formatNumber } from "@/components/charts/theme";

export default function TokensPage() {
  const summaries = getAllTokenSummaries().sort((a, b) => {
    const order = { metadao: 0, community: 1, "vc-backed": 2 };
    return (order[a.token.category] ?? 3) - (order[b.token.category] ?? 3);
  });

  return (
    <div>
      <h2 className="font-serif text-3xl font-bold text-ink mb-2">
        Token Dashboard
      </h2>
      <p className="text-sm text-ink-muted mb-6">
        All tracked tokens with current distribution metrics
      </p>

      <div className="rule-heavy" />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="py-3 pr-4 font-semibold text-ink-muted text-xs uppercase tracking-wider">Token</th>
              <th className="py-3 pr-4 font-semibold text-ink-muted text-xs uppercase tracking-wider">Category</th>
              <th className="py-3 pr-4 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Price</th>
              <th className="py-3 pr-4 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">24h</th>
              <th className="py-3 pr-4 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Holders</th>
              <th className="py-3 pr-4 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Gini</th>
              <th className="py-3 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Nakamoto</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s, i) => (
              <tr
                key={s.token.id}
                className={`border-b border-rule-light ${i % 2 === 0 ? "bg-surface" : "bg-cream"} hover:bg-wsj-blue-light transition-colors`}
              >
                <td className="py-3 pr-4">
                  <Link href={`/tokens/${s.token.id}`} className="font-semibold text-ink hover:text-wsj-blue">
                    {s.token.symbol}
                    <span className="ml-2 font-normal text-ink-muted">{s.token.name}</span>
                  </Link>
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    s.token.category === "metadao"
                      ? "bg-wsj-blue-light text-wsj-blue"
                      : s.token.category === "community"
                        ? "bg-positive-light text-positive"
                        : "bg-cream-dark text-ink-muted"
                  }`}>
                    {s.token.category}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right data-number">{formatNumber(s.price)}</td>
                <td className={`py-3 pr-4 text-right data-number ${s.change24h >= 0 ? "text-positive" : "text-negative"}`}>
                  {s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(1)}%
                </td>
                <td className="py-3 pr-4 text-right data-number">{s.holders.toLocaleString()}</td>
                <td className="py-3 pr-4 text-right data-number">{s.gini.toFixed(3)}</td>
                <td className="py-3 text-right data-number">{s.nakamoto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
