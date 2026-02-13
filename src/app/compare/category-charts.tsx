"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  BarChart,
  Bar,
  Cell,
  ErrorBar,
} from "recharts";
import { CHART_COLORS, CHART_STYLE } from "@/components/charts/theme";
import { ChartContainer } from "@/components/charts/ChartContainer";
import type { TokenSummary } from "@/lib/mock-data";
import type { TokenCategory } from "@/types";

// ── Category Colors ──────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  metadao: CHART_COLORS.series[0], // black
  "metadao-ico": CHART_COLORS.series[4], // blue
  "futarchy-dao": CHART_COLORS.series[1], // gray
  "vc-backed": CHART_COLORS.series[3], // red
  community: CHART_COLORS.series[2], // green
};

export const CATEGORY_LABELS: Record<string, string> = {
  metadao: "MetaDAO",
  "metadao-ico": "MetaDAO ICO",
  "futarchy-dao": "Futarchy DAO",
  "vc-backed": "VC-Backed",
  community: "Community",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface BoxPlotData {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface CategoryStats {
  category: string;
  tokens: number;
  avgGini: number;
  avgNakamoto: number;
  avgHHI: number;
  avgEntropy: number;
  avgHolders: number;
  avgBuyPressure: number;
}

// ── Utility Functions ────────────────────────────────────────────────────────

function calculateBoxPlotStats(values: number[]): {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
} {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const median = sorted[Math.floor(n / 2)];
  const q1 = sorted[Math.floor(n / 4)];
  const q3 = sorted[Math.floor((3 * n) / 4)];
  return { min, q1, median, q3, max };
}

function normalizeValue(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) return 50;
  return Math.round(((value - min) / (max - min)) * 100);
}

// ── CategoryBoxPlot ──────────────────────────────────────────────────────────

interface CategoryBoxPlotProps {
  summaries: TokenSummary[];
  metric: "gini" | "nakamoto" | "holders";
  title?: string;
}

export function CategoryBoxPlot({
  summaries,
  metric,
  title,
}: CategoryBoxPlotProps) {
  // Group by category
  const categoryGroups: Record<string, number[]> = {};
  summaries.forEach((s) => {
    const cat = s.token.category;
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    const val =
      metric === "gini"
        ? s.gini
        : metric === "nakamoto"
          ? s.nakamoto
          : s.holders;
    categoryGroups[cat].push(val);
  });

  // Calculate box plot stats for each category
  const boxPlotData: BoxPlotData[] = Object.entries(categoryGroups).map(
    ([category, values]) => ({
      category: CATEGORY_LABELS[category] || category,
      ...calculateBoxPlotStats(values),
    })
  );

  // Format display title
  const metricLabels: Record<string, string> = {
    gini: "Gini Coefficient",
    nakamoto: "Nakamoto Coefficient",
    holders: "Holder Count",
  };

  // Create bar chart with error bars to simulate box plot
  const chartData = boxPlotData.map((d) => ({
    category: d.category,
    median: d.median,
    low: d.median - d.q1,
    high: d.q3 - d.median,
    min: d.min,
    max: d.max,
    color: CATEGORY_COLORS[
      Object.keys(CATEGORY_LABELS).find(
        (k) => CATEGORY_LABELS[k] === d.category
      ) || ""
    ] || CHART_COLORS.series[0],
  }));

  return (
    <ChartContainer
      title={title || `${metricLabels[metric]} by Category`}
      subtitle="Distribution comparison across token categories"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, bottom: 10, left: 80 }}
        >
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={true} vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
            domain={metric === "gini" ? [0, 1] : undefined}
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={75}
          />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            formatter={(value: number | undefined) => [
              value !== undefined
                ? metric === "gini"
                  ? value.toFixed(3)
                  : Math.round(value)
                : "-",
              "Median",
            ]}
          />
          <Bar dataKey="median" barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <ErrorBar
              dataKey="high"
              width={4}
              strokeWidth={2}
              stroke={CHART_COLORS.series[0]}
              direction="x"
            />
            <ErrorBar
              dataKey="low"
              width={4}
              strokeWidth={2}
              stroke={CHART_COLORS.series[0]}
              direction="x"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── CategoryScatter ──────────────────────────────────────────────────────────

interface CategoryScatterProps {
  summaries: TokenSummary[];
}

export function CategoryScatter({ summaries }: CategoryScatterProps) {
  // Group by category
  const categories = Array.from(new Set(summaries.map((s) => s.token.category)));

  // Prepare scatter data with each token as a point
  const scatterData = categories.map((category) => ({
    category,
    label: CATEGORY_LABELS[category] || category,
    color: CATEGORY_COLORS[category] || CHART_COLORS.series[0],
    data: summaries
      .filter((s) => s.token.category === category)
      .map((s) => ({
        x: s.gini,
        y: s.nakamoto,
        z: s.holders,
        name: s.token.symbol,
      })),
  }));

  return (
    <ChartContainer
      title="Gini vs Nakamoto Coefficient"
      subtitle="Each token colored by category • Size represents holder count"
    >
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} />
          <XAxis
            type="number"
            dataKey="x"
            name="Gini"
            domain={[0.3, 1]}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
            label={{
              value: "Gini Coefficient →",
              position: "bottom",
              offset: 10,
              fontSize: 11,
              fill: CHART_COLORS.axis,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Nakamoto"
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={50}
            label={{
              value: "← Nakamoto Coefficient",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
              fill: CHART_COLORS.axis,
            }}
          />
          <ZAxis type="number" dataKey="z" range={[40, 200]} name="Holders" />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            formatter={(value: number | undefined, name: string | undefined) => {
              const n = name ?? "";
              if (value === undefined) return ["-", n];
              if (n === "Gini") return [value.toFixed(3), n];
              if (n === "Holders") return [value.toLocaleString(), n];
              return [value, n];
            }}
            labelFormatter={(_, payload) => {
              if (payload && payload[0]) {
                return `${(payload[0].payload as { name?: string }).name ?? ""}`;
              }
              return "";
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => <span style={{ color: CHART_COLORS.axis }}>{value}</span>}
          />
          {scatterData.map((group) => (
            <Scatter
              key={group.category}
              name={group.label}
              data={group.data}
              fill={group.color}
              fillOpacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── CategoryRadar ────────────────────────────────────────────────────────────

interface CategoryRadarProps {
  categoryStats: CategoryStats[];
}

export function CategoryRadar({ categoryStats }: CategoryRadarProps) {
  // Calculate ranges for normalization
  const allGini = categoryStats.map((c) => c.avgGini);
  const allNakamoto = categoryStats.map((c) => c.avgNakamoto);
  const allHHI = categoryStats.map((c) => c.avgHHI);
  const allEntropy = categoryStats.map((c) => c.avgEntropy);
  const allHolders = categoryStats.map((c) => c.avgHolders);

  const ranges = {
    gini: { min: Math.min(...allGini), max: Math.max(...allGini) },
    nakamoto: { min: Math.min(...allNakamoto), max: Math.max(...allNakamoto) },
    hhi: { min: Math.min(...allHHI), max: Math.max(...allHHI) },
    entropy: { min: Math.min(...allEntropy), max: Math.max(...allEntropy) },
    holders: { min: Math.min(...allHolders), max: Math.max(...allHolders) },
  };

  // Create radar data points
  const radarData = [
    {
      metric: "Decentralization",
      fullMark: 100,
      ...Object.fromEntries(
        categoryStats.map((c) => [
          c.category,
          // Invert Gini - lower Gini = more decentralized = higher score
          100 - normalizeValue(c.avgGini, ranges.gini.min, ranges.gini.max),
        ])
      ),
    },
    {
      metric: "Nakamoto",
      fullMark: 100,
      ...Object.fromEntries(
        categoryStats.map((c) => [
          c.category,
          normalizeValue(c.avgNakamoto, ranges.nakamoto.min, ranges.nakamoto.max),
        ])
      ),
    },
    {
      metric: "Entropy",
      fullMark: 100,
      ...Object.fromEntries(
        categoryStats.map((c) => [
          c.category,
          normalizeValue(c.avgEntropy, ranges.entropy.min, ranges.entropy.max),
        ])
      ),
    },
    {
      metric: "Distribution",
      fullMark: 100,
      ...Object.fromEntries(
        categoryStats.map((c) => [
          c.category,
          // Invert HHI - lower HHI = better distribution = higher score
          100 - normalizeValue(c.avgHHI, ranges.hhi.min, ranges.hhi.max),
        ])
      ),
    },
    {
      metric: "Reach",
      fullMark: 100,
      ...Object.fromEntries(
        categoryStats.map((c) => [
          c.category,
          normalizeValue(c.avgHolders, ranges.holders.min, ranges.holders.max),
        ])
      ),
    },
  ];

  return (
    <ChartContainer
      title="Category Profile Comparison"
      subtitle="Normalized metrics (0-100) • Higher is better for decentralization"
    >
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke={CHART_COLORS.grid} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
            axisLine={false}
          />
          {categoryStats.map((stat) => (
            <Radar
              key={stat.category}
              name={CATEGORY_LABELS[stat.category] || stat.category}
              dataKey={stat.category}
              stroke={CATEGORY_COLORS[stat.category] || CHART_COLORS.series[0]}
              fill={CATEGORY_COLORS[stat.category] || CHART_COLORS.series[0]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => <span style={{ color: CHART_COLORS.axis }}>{value}</span>}
          />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            formatter={(value: number | undefined) => [`${value ?? 0}`, "Score"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── Category Summary Table ───────────────────────────────────────────────────

interface CategorySummaryTableProps {
  categoryStats: CategoryStats[];
}

export function CategorySummaryTable({ categoryStats }: CategorySummaryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs uppercase tracking-wider text-ink-faint">
            <th className="pb-2 pr-4">Category</th>
            <th className="pb-2 pr-4 text-right">Tokens</th>
            <th className="pb-2 pr-4 text-right">Avg Gini</th>
            <th className="pb-2 pr-4 text-right">Avg Nakamoto</th>
            <th className="pb-2 pr-4 text-right">Avg HHI</th>
            <th className="pb-2 pr-4 text-right">Avg Holders</th>
            <th className="pb-2 text-right">Avg Buy Pressure</th>
          </tr>
        </thead>
        <tbody>
          {categoryStats.map((stat) => (
            <tr key={stat.category} className="border-b border-rule-light">
              <td className="py-3 pr-4">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-2"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[stat.category] || CHART_COLORS.series[0],
                  }}
                />
                {CATEGORY_LABELS[stat.category] || stat.category}
              </td>
              <td className="py-3 pr-4 text-right data-number">{stat.tokens}</td>
              <td className="py-3 pr-4 text-right data-number">
                {stat.avgGini.toFixed(3)}
              </td>
              <td className="py-3 pr-4 text-right data-number">
                {Math.round(stat.avgNakamoto)}
              </td>
              <td className="py-3 pr-4 text-right data-number">
                {Math.round(stat.avgHHI)}
              </td>
              <td className="py-3 pr-4 text-right data-number">
                {stat.avgHolders.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </td>
              <td className="py-3 text-right data-number">
                <span
                  className={
                    stat.avgBuyPressure >= 50 ? "text-positive" : "text-negative"
                  }
                >
                  {stat.avgBuyPressure.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
