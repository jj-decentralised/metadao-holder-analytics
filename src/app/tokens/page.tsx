"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useCallback } from "react";
import { getAllTokenSummaries, TokenSummary } from "@/lib/mock-data";
import { formatNumber } from "@/components/charts/theme";

type CategoryFilter = "all" | "futarchy" | "vc-backed" | "community";
type SortField = "token" | "category" | "price" | "change24h" | "marketCap" | "holders" | "gini" | "nakamoto" | "buyPressure";
type SortDirection = "asc" | "desc";

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "futarchy", label: "Futarchy" },
  { key: "vc-backed", label: "VC-Backed" },
  { key: "community", label: "Community" },
];

// Futarchy categories include metadao-related tokens
const FUTARCHY_CATEGORIES = ["metadao", "metadao-ico", "futarchy-dao"];

function isFutarchyToken(category: string): boolean {
  return FUTARCHY_CATEGORIES.includes(category);
}

function getCategoryBadgeStyle(category: string): string {
  if (isFutarchyToken(category)) {
    return "bg-wsj-blue-light text-wsj-blue";
  }
  if (category === "community") {
    return "bg-positive-light text-positive";
  }
  return "bg-cream-dark text-ink-muted";
}

function getGiniIndicator(gini: number): { color: string; label: string } {
  if (gini < 0.6) return { color: "text-positive", label: "Good" };
  if (gini <= 0.75) return { color: "text-series-4", label: "Fair" };
  return { color: "text-negative", label: "Poor" };
}

function getBuyPressureStyle(pressure: number): string {
  if (pressure > 55) return "text-positive";
  if (pressure < 45) return "text-negative";
  return "text-ink-muted";
}

function getTrendArrow(change24h: number): string {
  if (change24h > 2) return "↑↑";
  if (change24h > 0) return "↑";
  if (change24h < -2) return "↓↓";
  if (change24h < 0) return "↓";
  return "→";
}

export default function TokensPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-muted">Loading tokens...</div>}>
      <TokensPageInner />
    </Suspense>
  );
}

function TokensPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const categoryFilter = (searchParams.get("category") as CategoryFilter) || "all";
  const [sortField, setSortField] = useState<SortField>("category");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const allSummaries = useMemo(() => getAllTokenSummaries(), []);

  // Filter by category
  const filteredSummaries = useMemo(() => {
    if (categoryFilter === "all") return allSummaries;
    if (categoryFilter === "futarchy") {
      return allSummaries.filter((s) => isFutarchyToken(s.token.category));
    }
    return allSummaries.filter((s) => s.token.category === categoryFilter);
  }, [allSummaries, categoryFilter]);

  // Sort summaries
  const sortedSummaries = useMemo(() => {
    const sorted = [...filteredSummaries].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "token":
          cmp = a.token.symbol.localeCompare(b.token.symbol);
          break;
        case "category":
          // Futarchy first, then community, then VC
          const order: Record<string, number> = { metadao: 0, "metadao-ico": 0, "futarchy-dao": 0, community: 1, "vc-backed": 2 };
          cmp = (order[a.token.category] ?? 3) - (order[b.token.category] ?? 3);
          // Secondary sort by holders descending
          if (cmp === 0) cmp = b.holders - a.holders;
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "change24h":
          cmp = a.change24h - b.change24h;
          break;
        case "marketCap":
          cmp = a.marketCap - b.marketCap;
          break;
        case "holders":
          cmp = a.holders - b.holders;
          break;
        case "gini":
          cmp = a.gini - b.gini;
          break;
        case "nakamoto":
          cmp = a.nakamoto - b.nakamoto;
          break;
        case "buyPressure":
          cmp = a.buyPressure - b.buyPressure;
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredSummaries, sortField, sortDirection]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = allSummaries.length;
    
    // Average Gini by category
    const giniByCategory: Record<string, { sum: number; count: number }> = {};
    allSummaries.forEach((s) => {
      const cat = isFutarchyToken(s.token.category) ? "futarchy" : s.token.category;
      if (!giniByCategory[cat]) giniByCategory[cat] = { sum: 0, count: 0 };
      giniByCategory[cat].sum += s.gini;
      giniByCategory[cat].count++;
    });
    
    const avgGini: Record<string, number> = {};
    Object.entries(giniByCategory).forEach(([cat, { sum, count }]) => {
      avgGini[cat] = sum / count;
    });

    // Best decentralization score (lowest gini + highest nakamoto)
    const bestToken = [...allSummaries].sort((a, b) => {
      // Normalize and combine: lower gini is better, higher nakamoto is better
      const scoreA = a.gini - a.nakamoto / 100;
      const scoreB = b.gini - b.nakamoto / 100;
      return scoreA - scoreB;
    })[0];

    return { total, avgGini, bestToken };
  }, [allSummaries]);

  // Group tokens by category for card view
  const groupedTokens = useMemo(() => {
    const groups: Record<string, { tokens: TokenSummary[]; avgGini: number; avgNakamoto: number; avgBuyPressure: number }> = {};
    
    allSummaries.forEach((s) => {
      const cat = isFutarchyToken(s.token.category) ? "Futarchy" : 
                  s.token.category === "vc-backed" ? "VC-Backed" : "Community";
      if (!groups[cat]) {
        groups[cat] = { tokens: [], avgGini: 0, avgNakamoto: 0, avgBuyPressure: 0 };
      }
      groups[cat].tokens.push(s);
    });

    // Calculate averages
    Object.values(groups).forEach((group) => {
      const len = group.tokens.length;
      group.avgGini = group.tokens.reduce((sum, t) => sum + t.gini, 0) / len;
      group.avgNakamoto = group.tokens.reduce((sum, t) => sum + t.nakamoto, 0) / len;
      group.avgBuyPressure = group.tokens.reduce((sum, t) => sum + t.buyPressure, 0) / len;
    });

    return groups;
  }, [allSummaries]);

  const handleCategoryChange = useCallback((category: CategoryFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (category === "all") {
      params.delete("category");
    } else {
      params.set("category", category);
    }
    router.push(`/tokens?${params.toString()}`);
  }, [router, searchParams]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "gini" ? "asc" : "desc");
    }
  }, [sortField]);

  const SortHeader = ({ field, children, align = "left" }: { field: SortField; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      className={`py-3 pr-4 font-semibold text-ink-muted text-xs uppercase tracking-wider cursor-pointer hover:text-ink transition-colors ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-wsj-blue">{sortDirection === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );

  return (
    <div>
      <h2 className="font-serif text-3xl font-bold text-ink mb-2">
        Token Dashboard
      </h2>
      <p className="text-sm text-ink-muted mb-6">
        All tracked tokens with current distribution metrics
      </p>

      {/* Summary Stats Bar */}
      <div className="bg-surface border border-rule-light rounded p-4 mb-6">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-ink-muted">Total Tokens:</span>{" "}
            <span className="font-semibold data-number">{stats.total}</span>
          </div>
          <div className="h-4 w-px bg-rule-light" />
          <div className="flex items-center gap-4">
            <span className="text-ink-muted">Avg Gini:</span>
            {Object.entries(stats.avgGini).map(([cat, avg]) => (
              <span key={cat} className="inline-flex items-center gap-1">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  cat === "futarchy" ? "bg-wsj-blue-light text-wsj-blue" :
                  cat === "community" ? "bg-positive-light text-positive" :
                  "bg-cream-dark text-ink-muted"
                }`}>
                  {cat}
                </span>
                <span className="font-semibold data-number">{avg.toFixed(3)}</span>
              </span>
            ))}
          </div>
          <div className="h-4 w-px bg-rule-light" />
          <div>
            <span className="text-ink-muted">Best Decentralization:</span>{" "}
            <Link href={`/tokens/${stats.bestToken?.token.id}`} className="font-semibold text-wsj-blue hover:underline">
              {stats.bestToken?.token.symbol}
            </Link>
            <span className="text-ink-muted ml-1">(Gini: {stats.bestToken?.gini.toFixed(3)}, Nakamoto: {stats.bestToken?.nakamoto})</span>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-0 border-b border-rule mb-4">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleCategoryChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              categoryFilter === tab.key
                ? "text-wsj-blue"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {categoryFilter === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-wsj-blue" />
            )}
          </button>
        ))}
      </div>

      <div className="rule-heavy" />

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule">
              <SortHeader field="token">Token</SortHeader>
              <SortHeader field="category">Category</SortHeader>
              <SortHeader field="price" align="right">Price</SortHeader>
              <SortHeader field="change24h" align="right">24h</SortHeader>
              <SortHeader field="marketCap" align="right">Market Cap</SortHeader>
              <SortHeader field="holders" align="right">Holders</SortHeader>
              <SortHeader field="gini" align="right">Gini</SortHeader>
              <SortHeader field="nakamoto" align="right">Nakamoto</SortHeader>
              <SortHeader field="buyPressure" align="right">Buy Pressure</SortHeader>
              <th className="py-3 font-semibold text-ink-muted text-xs uppercase tracking-wider text-right">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sortedSummaries.map((s, i) => {
              const giniInfo = getGiniIndicator(s.gini);
              return (
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
                    <span className={`text-xs px-2 py-0.5 rounded ${getCategoryBadgeStyle(s.token.category)}`}>
                      {isFutarchyToken(s.token.category) ? "futarchy" : s.token.category}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right data-number">{formatNumber(s.price)}</td>
                  <td className={`py-3 pr-4 text-right data-number ${s.change24h >= 0 ? "text-positive" : "text-negative"}`}>
                    {s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4 text-right data-number">{formatNumber(s.marketCap)}</td>
                  <td className="py-3 pr-4 text-right data-number">{s.holders.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right">
                    <span className={`data-number ${giniInfo.color}`}>
                      {s.gini.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right data-number">{s.nakamoto}</td>
                  <td className={`py-3 pr-4 text-right data-number ${getBuyPressureStyle(s.buyPressure)}`}>
                    {s.buyPressure.toFixed(1)}%
                  </td>
                  <td className={`py-3 text-right text-lg ${s.change24h >= 0 ? "text-positive" : "text-negative"}`}>
                    {getTrendArrow(s.change24h)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grouped Cards View */}
      <div className="mt-12">
        <h3 className="font-serif text-2xl font-bold text-ink mb-4">Tokens by Category</h3>
        <div className="rule-heavy mb-6" />
        
        <div className="space-y-8">
          {Object.entries(groupedTokens).map(([category, group]) => (
            <div key={category} className="bg-surface border border-rule-light rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-serif text-xl font-semibold text-ink">{category}</h4>
                <div className="flex gap-4 text-sm text-ink-muted">
                  <span>Avg Gini: <span className="font-semibold data-number">{group.avgGini.toFixed(3)}</span></span>
                  <span>Avg Nakamoto: <span className="font-semibold data-number">{group.avgNakamoto.toFixed(1)}</span></span>
                  <span>Avg Buy Pressure: <span className="font-semibold data-number">{group.avgBuyPressure.toFixed(1)}%</span></span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {group.tokens.map((s) => {
                  const giniInfo = getGiniIndicator(s.gini);
                  return (
                    <Link
                      key={s.token.id}
                      href={`/tokens/${s.token.id}`}
                      className="block p-4 bg-cream rounded border border-rule-light hover:border-wsj-blue hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-ink">{s.token.symbol}</span>
                        <span className={`text-sm ${s.change24h >= 0 ? "text-positive" : "text-negative"}`}>
                          {s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted mb-3">{s.token.name}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-ink-muted">Price:</span>{" "}
                          <span className="data-number">{formatNumber(s.price)}</span>
                        </div>
                        <div>
                          <span className="text-ink-muted">Holders:</span>{" "}
                          <span className="data-number">{s.holders.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-ink-muted">Gini:</span>{" "}
                          <span className={`data-number ${giniInfo.color}`}>{s.gini.toFixed(3)}</span>
                        </div>
                        <div>
                          <span className="text-ink-muted">Nakamoto:</span>{" "}
                          <span className="data-number">{s.nakamoto}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
