import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetaDAO Token Holder Analytics",
  description:
    "Comparing futarchy-governed vs VC-backed token distribution on Solana",
  openGraph: {
    title: "MetaDAO Token Holder Analytics",
    description:
      "How does futarchy-based governance change token holder behavior? A data-driven comparison.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Header */}
        <header className="border-b border-rule bg-cream">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="rule-heavy pb-3 mb-3">
              <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">
                MetaDAO Token Holder Analytics
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                Comparing futarchy-governed vs VC-backed token distribution on
                Solana
              </p>
            </div>
            <nav className="flex gap-6 text-sm">
              <a
                href="/"
                className="text-ink-light font-medium hover:text-wsj-blue"
              >
                Overview
              </a>
              <a
                href="/tokens"
                className="text-ink-muted hover:text-wsj-blue"
              >
                Tokens
              </a>
              <a
                href="/compare"
                className="text-ink-muted hover:text-wsj-blue"
              >
                Compare
              </a>
              <a
                href="/methodology"
                className="text-ink-muted hover:text-wsj-blue"
              >
                Methodology
              </a>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        {/* Footer */}
        <footer className="border-t border-rule bg-cream-dark">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <p className="text-xs text-ink-faint">
              Data sources: CoinGecko, DeFiLlama, Codex.io &middot; Updated
              daily &middot; Built for research purposes
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
