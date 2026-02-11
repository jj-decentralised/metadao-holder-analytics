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
} from "recharts";

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

const COLORS = [
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#ddd6fe",
  "#ede9fe",
  "#6366f1",
  "#818cf8",
  "#a5b4fc",
  "#c7d2fe",
  "#e0e7ff",
];

export default function Home() {
  const [data, setData] = useState<HolderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/holders");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError("Failed to load holder data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading MetaDAO holder data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-red-400">{error || "No data available"}</div>
      </div>
    );
  }

  const pieData = [
    { name: "Top 10 Holders", value: data.top10Percentage },
    { name: "Top 11-50", value: data.top50Percentage - data.top10Percentage },
    { name: "Others", value: 100 - data.top50Percentage },
  ];

  const barData = data.holders.slice(0, 10).map((h, i) => ({
    name: `#${i + 1}`,
    balance: parseFloat(h.balance),
    percentage: h.percentage,
  }));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              MetaDAO Holder Analytics
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Real-time holder distribution powered by Codex.io
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Last updated</div>
            <div className="text-violet-400">{new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Holders"
            value={data.totalHolders.toLocaleString()}
            subtitle="Unique wallets"
          />
          <StatCard
            title="Top 10 Concentration"
            value={`${data.top10Percentage.toFixed(1)}%`}
            subtitle="Of total supply"
            highlight={data.top10Percentage > 50}
          />
          <StatCard
            title="Top 50 Concentration"
            value={`${data.top50Percentage.toFixed(1)}%`}
            subtitle="Of total supply"
          />
          <StatCard
            title="Median Balance"
            value={formatNumber(data.medianBalance)}
            subtitle="META tokens"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Distribution Pie Chart */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Holder Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Holders Bar Chart */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Top 10 Holders</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [
                    `${formatNumber(value)} META`,
                    "Balance",
                  ]}
                />
                <Bar dataKey="balance" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Holders Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">Top Holders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    USD Value
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    % of Supply
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.holders.slice(0, 25).map((holder, i) => (
                  <tr key={holder.address} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        i < 3 ? "bg-violet-500/20 text-violet-400" : "bg-gray-800 text-gray-400"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm text-gray-300 bg-gray-800 px-2 py-1 rounded">
                        {truncateAddress(holder.address)}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">
                      {formatNumber(parseFloat(holder.balance))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-green-400">
                      ${holder.balanceUsd.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-violet-500 h-2 rounded-full"
                            style={{ width: `${Math.min(holder.percentage * 2, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-300 w-16 text-right">
                          {holder.percentage.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Data provided by Codex.io API • Built with Next.js</p>
        </footer>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  highlight = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-gray-900 rounded-xl p-6 border ${
      highlight ? "border-yellow-500/50" : "border-gray-800"
    }`}>
      <div className="text-sm text-gray-400 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-yellow-400" : "text-white"}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}
