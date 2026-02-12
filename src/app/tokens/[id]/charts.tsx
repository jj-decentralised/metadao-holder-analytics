"use client";

import {
  ResponsiveContainer,
  Line,
  AreaChart,
  Area,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PriceChart } from "@/components/charts/PriceChart";
import { LorenzCurveChart } from "@/components/charts/LorenzCurve";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { CHART_COLORS, CHART_STYLE, formatNumber, formatDate } from "@/components/charts/theme";
import type { PricePoint, TokenCategory } from "@/types";
import type { OHLCVPoint, HolderTimeSeriesPoint, WhaleMovement, CategoryAverages } from "@/lib/mock-data";

interface TokenDetailChartsProps {
  tokenName: string;
  tokenCategory: TokenCategory;
  priceHistory: PricePoint[];
  lorenzPoints: { x: number; y: number }[];
  gini: number;
  ohlcvData: OHLCVPoint[];
  holderTimeSeries: HolderTimeSeriesPoint[];
  whaleMovements: WhaleMovement[];
  categoryAverages: CategoryAverages;
}

// Section divider component
function SectionDivider() {
  return (
    <div className="my-10 border-t-2 border-rule-heavy" />
  );
}

// Section title component
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-2xl font-bold text-ink mb-6 tracking-tight">
      {children}
    </h3>
  );
}

export function TokenDetailCharts({
  tokenName,
  tokenCategory,
  priceHistory,
  lorenzPoints,
  gini,
  ohlcvData,
  holderTimeSeries,
  whaleMovements,
  categoryAverages,
}: TokenDetailChartsProps) {
  // Calculate holder growth percentage
  const holderGrowthPct = holderTimeSeries.length > 1
    ? ((holderTimeSeries[holderTimeSeries.length - 1].totalHolders -
        holderTimeSeries[0].totalHolders) /
        holderTimeSeries[0].totalHolders) *
      100
    : 0;

  // Calculate buy/sell pressure from recent OHLCV
  const recentOHLCV = ohlcvData.slice(-14);
  const buyPressure = recentOHLCV.filter((d) => d.close > d.open).length;
  const sellPressure = recentOHLCV.length - buyPressure;
  const pressureRatio = buyPressure / (buyPressure + sellPressure);

  // Get category averages for comparison
  const categoryKey = tokenCategory === "metadao" ? "metadao" : tokenCategory === "vc-backed" ? "vcBacked" : "community";
  const categoryAvgGini = categoryAverages[categoryKey].avgGini;
  const overallAvgGini = categoryAverages.overall.avgGini;
  const isBetterThanCategory = gini < categoryAvgGini;
  const isBetterThanOverall = gini < overallAvgGini;

  // Sample OHLCV data for the chart (weekly for cleaner display)
  const weeklyOHLCV = ohlcvData.filter((_, i) => i % 7 === 0 || i === ohlcvData.length - 1);

  // Sample holder data for stacked chart (weekly)
  const weeklyHolders = holderTimeSeries.filter((_, i) => i % 7 === 0 || i === holderTimeSeries.length - 1);

  return (
    <>
      {/* Existing Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PriceChart
          data={priceHistory.map((p) => ({ timestamp: p.timestamp, price: p.price }))}
          tokenName={tokenName}
        />
        <LorenzCurveChart
          data={lorenzPoints}
          tokenName={tokenName}
          gini={gini}
        />
      </div>

      {/* Trading Activity Section */}
      <SectionDivider />
      <SectionTitle>Trading Activity</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price with Volume Chart */}
        <div className="lg:col-span-2">
          <ChartContainer
            title={`${tokenName} Price & Volume`}
            subtitle="90-day OHLCV data"
            source="Mock Data"
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={weeklyOHLCV} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="none" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => formatDate(ts)}
                  tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="price"
                  tickFormatter={(v) => formatNumber(v)}
                  tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  tickFormatter={(v) => formatNumber(v)}
                  tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={CHART_STYLE.tooltipStyle}
                  labelFormatter={(ts) => formatDate(ts as number)}
                  formatter={(value, name) => [
                    formatNumber(Number(value) || 0),
                    name === "volume" ? "Volume" : "Close",
                  ]}
                />
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  fill={CHART_COLORS.grid}
                  opacity={0.5}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  stroke={CHART_COLORS.series[0]}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Buy/Sell Pressure Indicator */}
        <div className="bg-surface border border-rule-light p-6">
          <h4 className="font-serif text-lg font-semibold text-ink mb-4">Buy/Sell Pressure</h4>
          <p className="text-sm text-ink-muted mb-4">14-day analysis</p>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink">Buy Days</span>
              <span className="data-number text-lg font-semibold text-positive">{buyPressure}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink">Sell Days</span>
              <span className="data-number text-lg font-semibold text-negative">{sellPressure}</span>
            </div>
            <div className="h-3 bg-cream-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-positive transition-all"
                style={{ width: `${pressureRatio * 100}%` }}
              />
            </div>
            <div className="text-center">
              <span
                className={`text-2xl font-bold ${
                  pressureRatio > 0.5 ? "text-positive" : "text-negative"
                }`}
              >
                {pressureRatio > 0.5 ? "Bullish" : "Bearish"}
              </span>
              <p className="text-xs text-ink-faint mt-1">
                {(pressureRatio * 100).toFixed(0)}% buy pressure
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Holder Growth Section */}
      <SectionDivider />
      <SectionTitle>Holder Growth Over Time</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <ChartContainer
            title="Total Holder Count"
            subtitle="180-day trend"
            source="Mock Data"
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={holderTimeSeries} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="holderGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.series[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.series[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="none" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => formatDate(ts)}
                  tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => v.toLocaleString()}
                  tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={CHART_STYLE.tooltipStyle}
                  labelFormatter={(ts) => formatDate(ts as number)}
                  formatter={(value) => [Number(value).toLocaleString(), "Holders"]}
                />
                <Area
                  type="monotone"
                  dataKey="totalHolders"
                  stroke={CHART_COLORS.series[0]}
                  strokeWidth={2}
                  fill="url(#holderGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        <div className="bg-surface border border-rule-light p-6 flex flex-col justify-center">
          <p className="text-sm text-ink-muted mb-2">180-Day Growth</p>
          <p
            className={`data-number text-4xl font-bold ${
              holderGrowthPct >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {holderGrowthPct >= 0 ? "+" : ""}
            {holderGrowthPct.toFixed(1)}%
          </p>
          <p className="text-xs text-ink-faint mt-2">
            From {holderTimeSeries[0]?.totalHolders.toLocaleString()} to{" "}
            {holderTimeSeries[holderTimeSeries.length - 1]?.totalHolders.toLocaleString()} holders
          </p>
        </div>
      </div>

      {/* Holder Composition Section */}
      <SectionDivider />
      <SectionTitle>Holder Composition</SectionTitle>
      <ChartContainer
        title="Holder Distribution Over Time"
        subtitle="Breakdown by wallet size category"
        source="Mock Data"
      >
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={weeklyHolders} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="none" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatDate(ts)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => v.toLocaleString()}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip
              contentStyle={CHART_STYLE.tooltipStyle}
              labelFormatter={(ts) => formatDate(ts as number)}
              formatter={(value, name) => [
                Number(value).toLocaleString(),
                String(name).charAt(0).toUpperCase() + String(name).slice(1),
              ]}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
            />
            <Area
              type="monotone"
              dataKey="fishCount"
              stackId="1"
              stroke={CHART_COLORS.positive}
              fill={CHART_COLORS.positive}
              fillOpacity={0.8}
              name="Fish"
            />
            <Area
              type="monotone"
              dataKey="dolphinCount"
              stackId="1"
              stroke={CHART_COLORS.series[0]}
              fill={CHART_COLORS.series[0]}
              fillOpacity={0.8}
              name="Dolphins"
            />
            <Area
              type="monotone"
              dataKey="sharkCount"
              stackId="1"
              stroke={CHART_COLORS.series[3]}
              fill={CHART_COLORS.series[3]}
              fillOpacity={0.8}
              name="Sharks"
            />
            <Area
              type="monotone"
              dataKey="whaleCount"
              stackId="1"
              stroke={CHART_COLORS.negative}
              fill={CHART_COLORS.negative}
              fillOpacity={0.8}
              name="Whales"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Whale Activity Section */}
      <SectionDivider />
      <SectionTitle>Notable Wallet Movements</SectionTitle>
      <div className="bg-surface border border-rule-light overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule-light bg-cream">
              <th className="text-left py-3 px-4 font-semibold text-ink">Date</th>
              <th className="text-left py-3 px-4 font-semibold text-ink">Wallet</th>
              <th className="text-left py-3 px-4 font-semibold text-ink">Type</th>
              <th className="text-right py-3 px-4 font-semibold text-ink">Amount</th>
              <th className="text-right py-3 px-4 font-semibold text-ink">% of Supply</th>
            </tr>
          </thead>
          <tbody>
            {whaleMovements.map((m, i) => (
              <tr
                key={i}
                className={`border-b border-rule-light ${
                  m.type === "accumulate" ? "bg-positive/5" : "bg-negative/5"
                }`}
              >
                <td className="py-3 px-4 text-ink-muted">{new Date(m.timestamp).toLocaleDateString()}</td>
                <td className="py-3 px-4 font-mono text-xs text-ink">{m.address.slice(0, 6)}...{m.address.slice(-4)}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      m.type === "accumulate"
                        ? "bg-positive/20 text-positive"
                        : "bg-negative/20 text-negative"
                    }`}
                  >
                    {m.type === "accumulate" ? "Accumulate" : "Distribute"}
                  </span>
                </td>
                <td className="py-3 px-4 text-right data-number">
                  {m.amount.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right data-number font-medium">
                  {m.percentOfSupply.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Comparison Section */}
      <SectionDivider />
      <SectionTitle>How {tokenName} Compares</SectionTitle>
      <div className="bg-surface border border-rule-light p-6">
        <div className="space-y-6">
          {/* This Token */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-ink">{tokenName} Gini</span>
              <span className="data-number text-sm font-semibold">{gini.toFixed(3)}</span>
            </div>
            <div className="h-4 bg-cream-dark rounded-full overflow-hidden relative">
              <div
                className="h-full bg-wsj-blue transition-all rounded-full"
                style={{ width: `${gini * 100}%` }}
              />
            </div>
          </div>

          {/* Category Average */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-ink">
                {tokenCategory === "metadao"
                  ? "MetaDAO"
                  : tokenCategory === "vc-backed"
                  ? "VC-Backed"
                  : "Community"}{" "}
                Average
              </span>
              <span className="data-number text-sm">{categoryAvgGini.toFixed(3)}</span>
            </div>
            <div className="h-4 bg-cream-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-series-2 transition-all rounded-full"
                style={{ width: `${categoryAvgGini * 100}%` }}
              />
            </div>
          </div>

          {/* Overall Average */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-ink">Overall Average</span>
              <span className="data-number text-sm">{overallAvgGini.toFixed(3)}</span>
            </div>
            <div className="h-4 bg-cream-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-ink-muted transition-all rounded-full"
                style={{ width: `${overallAvgGini * 100}%` }}
              />
            </div>
          </div>

          {/* Verdict */}
          <div className="mt-6 pt-4 border-t border-rule-light">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isBetterThanCategory ? "bg-positive" : "bg-negative"
                }`}
              />
              <span className="text-sm text-ink">
                {isBetterThanCategory
                  ? `More equitable than ${tokenCategory} category average`
                  : `Less equitable than ${tokenCategory} category average`}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isBetterThanOverall ? "bg-positive" : "bg-negative"
                }`}
              />
              <span className="text-sm text-ink">
                {isBetterThanOverall
                  ? "More equitable than overall market average"
                  : "Less equitable than overall market average"}
              </span>
            </div>
            <p className="text-xs text-ink-faint mt-3">
              Lower Gini coefficient indicates more equal token distribution
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
