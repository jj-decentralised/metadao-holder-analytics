"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { METADAO_TOKEN, SOLANA_NETWORK_ID } from "@/lib/codex";

interface HolderData {
  address: string;
  balance: string;
  balanceUsd: number;
  percentage: number;
}

interface HolderStats {
  totalHolders: number;
  top10Percentage: number;
  top50Percentage: number;
  medianBalance: number;
  holders: HolderData[];
}

const COLORS = ["#262626", "#525252", "#a3a3a3", "#d4d4d4", "#e5e5e5"];

export default function Home() {
  const [data, setData] = useState<HolderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Controls for benchmarks
  const [coinId, setCoinId] = useState<string>("solana");
  const [days, setDays] = useState<number>(180);
  const [price, setPrice] = useState<{ t: number; price: number }[] | null>(null);
  const [vol30, setVol30] = useState<{ t: number; v: number }[] | null>(null);
  const [vol90, setVol90] = useState<{ t: number; v: number }[] | null>(null);
  const [sharpe30, setSharpe30] = useState<{ t: number; v: number }[] | null>(null);
  const [sharpe90, setSharpe90] = useState<{ t: number; v: number }[] | null>(null);
  const [holdersSeries, setHoldersSeries] = useState<{ t: number; holderCount: number; top10?: number; top50?: number }[] | null>(null);

  useEffect(() => {
    async function fetchSnapshot() {
      try {
        const res = await fetch("/api/holders");
        if (!res.ok) throw new Error("Failed to fetch holders");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError("Failed to load holder data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSnapshot();
  }, []);

  // Fetch price + metrics whenever controls change
  useEffect(() => {
    async function fetchBench() {
      try {
        const p = await fetch(`/api/price/${encodeURIComponent(coinId)}?days=${days}`).then(r => r.json());
        setPrice(p?.prices || null);
        const m = await fetch(`/api/metrics/${encodeURIComponent(coinId)}?days=${days}&windows=30,90`).then(r => r.json());
        setVol30(m?.vol?.[30] || null);
        setVol90(m?.vol?.[90] || null);
        setSharpe30(m?.sharpe?.[30] || null);
        setSharpe90(m?.sharpe?.[90] || null);
        const tokenId = `${METADAO_TOKEN}:${SOLANA_NETWORK_ID}`;
        const hs = await fetch(`/api/holders/timeseries?tokenId=${encodeURIComponent(tokenId)}&days=${days}`).then(r => r.json());
        setHoldersSeries(hs?.series || []);
      } catch (e) {
        console.error(e);
      }
    }
    fetchBench();
  }, [coinId, days]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-lg font-[family-name:var(--font-sans)] text-neutral-400">
          Loading…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-red-600 font-[family-name:var(--font-sans)]">
          {error || "No data available"}
        </div>
      </div>
    );
  }

  const pieData = [
    { name: "Top 10", value: data.top10Percentage },
    { name: "Top 11–50", value: data.top50Percentage - data.top10Percentage },
    { name: "Others", value: 100 - data.top50Percentage },
  ];

  const barData = data.holders.slice(0, 10).map((h, i) => ({
    name: `${i + 1}`,
    balance: parseFloat(h.balance),
    percentage: h.percentage,
  }));

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Masthead */}
      <header className="border-b-2 border-neutral-900">
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-4">
          <div className="text-center">
            <h1 className="font-[family-name:var(--font-serif)] text-4xl font-bold tracking-tight">
              MetaDAO Holder Analytics
            </h1>
            <div className="mt-2 flex items-center justify-center gap-3 text-xs font-[family-name:var(--font-sans)] text-neutral-500 uppercase tracking-widest">
              <span>{dateStr}</span>
              <span className="text-neutral-300">|</span>
              <span>Updated {now.toLocaleTimeString()}</span>
              <span className="text-neutral-300">|</span>
              <span>Data by Codex.io</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <label className="text-xs text-neutral-500 uppercase tracking-wider">CoinGecko ID</label>
            <input
              value={coinId}
              onChange={(e) => setCoinId(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
              placeholder="e.g. solana"
            />
          </div>
          <div className="flex items-center gap-2">
            {[30, 90, 180, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-sm border rounded ${
                  days === d ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300"
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>

        {/* Key Figures */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-neutral-200 divide-x divide-neutral-200 mb-10">
          <StatCard title="Total Holders" value={data.totalHolders.toLocaleString()} />
          <StatCard
            title="Top 10 Concentration"
            value={`${data.top10Percentage.toFixed(1)}%`}
            alert={data.top10Percentage > 50}
          />
          <StatCard
            title="Top 50 Concentration"
            value={`${data.top50Percentage.toFixed(1)}%`}
          />
          <StatCard title="Median Balance" value={formatNumber(data.medianBalance)} />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          {/* Distribution */}
          <section>
            <h2 className="font-[family-name:var(--font-serif)] text-xl font-semibold mb-1">
              Holder Distribution
            </h2>
            <p className="text-sm text-neutral-500 font-[family-name:var(--font-sans)] mb-4">
              Share of total supply by holder cohort
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={1}
                  dataKey="value"
                  stroke="#fff"
                  strokeWidth={2}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: "2px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </section>

          {/* Top Holders Bar */}
          <section>
            <h2 className="font-[family-name:var(--font-serif)] text-xl font-semibold mb-1">
              Largest Holders
            </h2>
            <p className="text-sm text-neutral-500 font-[family-name:var(--font-sans)] mb-4">
              Token balance by rank
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={24}
                  tick={{ fontSize: 12, fontFamily: "var(--font-sans)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: "2px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                  }}
                  formatter={(value) => [
                    `${formatNumber(Number(value))} META`,
                    "Balance",
                  ]}
                />
                <Bar dataKey="balance" fill="#262626" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>

        {/* Holders Over Time */}
        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-serif)] text-xl font-semibold mb-1">Holders Over Time</h2>
          <p className="text-sm text-neutral-500 font-[family-name:var(--font-sans)] mb-4">
            Requires snapshots; configure DATABASE_URL and CODEX_API_KEY to enable hourly updates.
          </p>
          <div className="border border-neutral-200 p-3">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={(holdersSeries || [])}>
                <CartesianGrid stroke="#eee" />
                <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleDateString()} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={(v) => new Date(Number(v)).toLocaleString()} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="holderCount" name="Holders" stroke="#111827" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="top10" name="Top10 %" stroke="#6b7280" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Price & Metrics */}
        <section className="mb-12">
          <h2 className="font-[family-name:var(--font-serif)] text-xl font-semibold mb-1">
            Price & Benchmarks
          </h2>
          <p className="text-sm text-neutral-500 font-[family-name:var(--font-sans)] mb-4">
            Price line with rolling volatility and Sharpe (30D, 90D)
          </p>
          <div className="grid grid-cols-1 gap-6">
            <div className="border border-neutral-200 p-3">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={(price || []).map(p => ({ t: p.t, price: p.price }))}>
                  <CartesianGrid stroke="#eee" />
                  <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleDateString()} tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(v) => new Date(Number(v)).toLocaleString()} formatter={(v) => [`$${Number(v).toLocaleString()}`, "Price"]} />
                  <Legend />
                  <Line type="monotone" dataKey="price" stroke="#111827" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-neutral-200 p-3">
                <h3 className="text-sm font-semibold mb-2">Rolling Volatility</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={(vol30 || []).map(p => ({ t: p.t, v30: p.v }))}>
                    <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleDateString()} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => new Date(Number(v)).toLocaleDateString()} />
                    <Line type="monotone" dataKey="v30" name="Vol 30D" stroke="#111827" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="border border-neutral-200 p-3">
                <h3 className="text-sm font-semibold mb-2">Sharpe</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={(sharpe30 || []).map(p => ({ t: p.t, s30: p.v }))}>
                    <XAxis dataKey="t" tickFormatter={(v) => new Date(v).toLocaleDateString()} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => new Date(Number(v)).toLocaleDateString()} />
                    <Line type="monotone" dataKey="s30" name="Sharpe 30D" stroke="#4b5563" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-neutral-200 mb-8" />

        {/* Holders Table */}
        <section>
          <h2 className="font-[family-name:var(--font-serif)] text-xl font-semibold mb-1">
            Top Holders
          </h2>
          <p className="text-sm text-neutral-500 font-[family-name:var(--font-sans)] mb-4">
            Ranked by token balance, top 25 wallets shown
          </p>
          <div className="overflow-x-auto">
            <table className="w-full font-[family-name:var(--font-sans)] text-sm">
              <thead>
                <tr className="border-b-2 border-neutral-900">
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Rank
                  </th>
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Address
                  </th>
                  <th className="py-2 pl-4 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Balance
                  </th>
                  <th className="py-2 pl-4 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    USD Value
                  </th>
                  <th className="py-2 pl-4 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    % of Supply
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.holders.slice(0, 25).map((holder, i) => (
                  <tr
                    key={holder.address}
                    className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="py-3 pr-4 tabular-nums">
                      <span className={`${
                        i < 3 ? "font-bold" : "text-neutral-400"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <code className="font-[family-name:var(--font-mono)] text-xs text-neutral-600">
                        {truncateAddress(holder.address)}
                      </code>
                    </td>
                    <td className="py-3 pl-4 text-right tabular-nums">
                      {formatNumber(parseFloat(holder.balance))}
                    </td>
                    <td className="py-3 pl-4 text-right tabular-nums">
                      ${holder.balanceUsd.toLocaleString()}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-neutral-100 h-1.5">
                          <div
                            className="bg-neutral-900 h-1.5"
                            style={{ width: `${Math.min(holder.percentage * 2, 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-neutral-600 w-14 text-right text-xs">
                          {holder.percentage.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-neutral-200 text-center">
          <p className="text-xs text-neutral-400 font-[family-name:var(--font-sans)] uppercase tracking-widest">
            Data provided by Codex.io · MetaDAO Holder Analytics
          </p>
        </footer>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  alert = false,
}: {
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs font-[family-name:var(--font-sans)] text-neutral-500 uppercase tracking-wider mb-1">
        {title}
      </div>
      <div
        className={`text-2xl font-[family-name:var(--font-serif)] font-bold tabular-nums ${
          alert ? "text-red-700" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}
