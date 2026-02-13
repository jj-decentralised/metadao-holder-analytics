"use client";

const ALLOW_MOCKS = process.env.NEXT_PUBLIC_ALLOW_MOCKS === "true";

import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { CHART_COLORS, CHART_STYLE } from "@/components/charts/theme";
import {
  getScatterData,
  getCategoryStats,
  type ScatterPlotData,
  type ScatterPoint,
  type ScatterCategory,
} from "./scatter-data";

// Category colors: black=metadao, gray=vc, green=community
const CATEGORY_COLORS: Record<ScatterCategory, string> = {
  metadao: CHART_COLORS.series[0], // black
  vc: CHART_COLORS.series[1], // gray
  community: CHART_COLORS.positive, // green
};

const CATEGORY_LABELS: Record<ScatterCategory, string> = {
  metadao: "MetaDAO/Futarchy",
  vc: "VC-Backed",
  community: "Community",
};

interface ScatterPlotProps {
  data: ScatterPlotData;
  title: string;
  subtitle?: string;
}

function ScatterPlot({ data, title, subtitle }: ScatterPlotProps) {
  // Separate points by category
  const metadaoPoints = data.points.filter((p) => p.category === "metadao");
  const vcPoints = data.points.filter((p) => p.category === "vc");
  const communityPoints = data.points.filter((p) => p.category === "community");

  // Calculate trend line endpoints
  const xValues = data.points.map((p) => p.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const { slope, intercept, rSquared } = data.trendLine;

  // Generate trend line segment (exactly 2 points)
  const trendLineSegment: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ScatterPoint }[] }) => {
    if (active && payload && payload.length > 0) {
      const point = payload[0].payload;
      return (
        <div style={CHART_STYLE.tooltipStyle}>
          <p className="font-semibold text-ink">{point.symbol}</p>
          <p className="text-sm text-ink-muted">
            {data.xLabel}: {point.x.toFixed(2)}
          </p>
          <p className="text-sm text-ink-muted">
            {data.yLabel}: {point.y.toFixed(3)}
          </p>
          <p className="text-xs mt-1" style={{ color: CATEGORY_COLORS[point.category] }}>
            {CATEGORY_LABELS[point.category]}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      source={`R² = ${rSquared.toFixed(3)}`}
    >
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={data.xLabel}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              tickLine={{ stroke: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.axis }}
              label={{
                value: data.xLabel,
                position: "bottom",
                offset: 0,
                fontSize: CHART_STYLE.labelSize,
                fill: CHART_COLORS.axis,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={data.yLabel}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              tickLine={{ stroke: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.axis }}
              label={{
                value: data.yLabel,
                angle: -90,
                position: "insideLeft",
                fontSize: CHART_STYLE.labelSize,
                fill: CHART_COLORS.axis,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Trend line */}
            <ReferenceLine
              segment={trendLineSegment}
              stroke={CHART_COLORS.neutral}
              strokeDasharray="5 5"
              strokeWidth={2}
            />

            {/* Data points by category */}
            <Scatter
              name={CATEGORY_LABELS.metadao}
              data={metadaoPoints}
              fill={CATEGORY_COLORS.metadao}
            />
            <Scatter
              name={CATEGORY_LABELS.vc}
              data={vcPoints}
              fill={CATEGORY_COLORS.vc}
            />
            <Scatter
              name={CATEGORY_LABELS.community}
              data={communityPoints}
              fill={CATEGORY_COLORS.community}
            />
            
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: "12px" }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}

export default function AnalyticsPage() {
  if (!ALLOW_MOCKS) {
    return <div className="p-8 text-ink">Analytics scatter plots are gated until real data is wired.</div>;
  }
  const scatterData = useMemo(() => getScatterData(), []);
  const categoryStats = useMemo(() => getCategoryStats(), []);

  return (
    <div>
      <h2 className="font-serif text-3xl font-bold text-ink mb-2">
        Cross-Token Econometric Analysis
      </h2>
      <p className="text-sm text-ink-muted mb-8">
        Scatter plots and statistical tests comparing distribution metrics across all 
        tracked Solana tokens. Points are colored by category: black (MetaDAO/Futarchy), 
        gray (VC-Backed), green (Community). Dashed lines show linear regression trends.
      </p>

      {/* Scatter Plots Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        <ScatterPlot
          data={scatterData.giniVsHolders}
          title="Gini vs Holder Count"
          subtitle="Does decentralization improve with more holders?"
        />
        <ScatterPlot
          data={scatterData.marketCapVsNakamoto}
          title="Market Cap vs Nakamoto Coefficient"
          subtitle="Larger tokens tend to have more concentrated ownership"
        />
        <ScatterPlot
          data={scatterData.ageVsGini}
          title="Token Age vs Gini"
          subtitle="How does distribution evolve over time?"
        />
        <ScatterPlot
          data={scatterData.volumeLiquidityVsTurnover}
          title="Volume/Liquidity vs Holder Turnover"
          subtitle="Trading activity relative to holder base"
        />
        <ScatterPlot
          data={scatterData.buyPressureVsPrice}
          title="Buy Pressure vs 24h Price Change"
          subtitle="Does buying activity predict short-term price movement?"
        />
        <ScatterPlot
          data={scatterData.communityAllocationVsGini}
          title="Community Allocation vs Gini"
          subtitle="Higher community allocation correlates with better distribution"
        />
      </div>

      {/* Summary Statistics Table */}
      <div className="bg-surface border border-rule-light p-6">
        <h3 className="font-serif text-xl font-semibold text-ink mb-4">
          Category Averages
        </h3>
        <p className="text-sm text-ink-muted mb-4">
          Summary statistics by token category across all metrics
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="py-3 pr-4 text-left font-semibold text-ink-muted text-xs uppercase tracking-wider">
                  Category
                </th>
                <th className="py-3 pr-4 text-right font-semibold text-ink-muted text-xs uppercase tracking-wider">
                  Count
                </th>
                <th className="py-3 pr-4 text-right font-semibold text-ink-muted text-xs uppercase tracking-wider">
                  Avg Gini
                </th>
                <th className="py-3 pr-4 text-right font-semibold text-ink-muted text-xs uppercase tracking-wider">
                  Avg Nakamoto
                </th>
                <th className="py-3 pr-4 text-right font-semibold text-ink-muted text-xs uppercase tracking-wider">
                  Avg Holders
                </th>
                <th className="py-3 pr-4 text-right font-semibold text-ink-muted text-xs uppercase tracking-wider">
                  Avg Buy Pressure
                </th>
                <th className="py-3 text-right font-semibold text-ink-muted text-xs uppercase tracking-wider">
                  Avg Market Cap
                </th>
              </tr>
            </thead>
            <tbody>
              {categoryStats.map((stat, i) => (
                <tr
                  key={stat.category}
                  className={`border-b border-rule-light ${
                    i % 2 === 0 ? "bg-surface" : "bg-cream"
                  }`}
                >
                  <td className="py-3 pr-4">
                    <span
                      className="inline-flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[stat.category] }}
                      />
                      <span className="font-medium text-ink">{stat.label}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right data-number">{stat.count}</td>
                  <td className="py-3 pr-4 text-right data-number">
                    <span
                      className={
                        stat.avgGini < 0.65
                          ? "text-positive"
                          : stat.avgGini > 0.75
                          ? "text-negative"
                          : "text-ink"
                      }
                    >
                      {stat.avgGini.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right data-number">
                    {stat.avgNakamoto.toFixed(1)}
                  </td>
                  <td className="py-3 pr-4 text-right data-number">
                    {Math.round(stat.avgHolders).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-right data-number">
                    <span
                      className={
                        stat.avgBuyPressure > 55
                          ? "text-positive"
                          : stat.avgBuyPressure < 45
                          ? "text-negative"
                          : "text-ink"
                      }
                    >
                      {stat.avgBuyPressure.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 text-right data-number">
                    ${stat.avgMarketCap.toFixed(1)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Key Insights */}
        <div className="mt-6 pt-4 border-t border-rule-light">
          <h4 className="font-semibold text-ink text-sm mb-2">Key Insights</h4>
          <ul className="text-sm text-ink-muted space-y-1">
            <li>
              • MetaDAO/Futarchy tokens show the lowest average Gini coefficient, 
              indicating more equitable distribution.
            </li>
            <li>
              • VC-backed tokens tend to have higher Nakamoto coefficients but also 
              higher concentration overall.
            </li>
            <li>
              • Community tokens show the highest variance in metrics, reflecting 
              diverse launch mechanisms.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
