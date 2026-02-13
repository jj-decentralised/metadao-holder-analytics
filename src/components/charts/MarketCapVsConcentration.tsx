"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ZAxis,
} from "recharts";
import { CHART_COLORS, CHART_STYLE, formatNumber, formatPercent } from "./theme";
import { ChartContainer } from "./ChartContainer";

export interface MarketCapConcentrationDataPoint {
  marketCap: number;
  top10Percent: number;
  label: string;
  category?: string;
}

interface MarketCapVsConcentrationProps {
  data: MarketCapConcentrationDataPoint[];
  showTrendLine?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  metadao: CHART_COLORS.series[0],
  vc: CHART_COLORS.series[1],
  community: CHART_COLORS.series[2],
  default: CHART_COLORS.series[0],
};

/** Compute linear regression for log-transformed x values */
function logLinearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;

  const transformed = points.map((p) => ({
    x: Math.log10(Math.max(p.x, 1)),
    y: p.y,
  }));

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (const p of transformed) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  let ssTotal = 0,
    ssResidual = 0;
  for (const p of transformed) {
    ssTotal += (p.y - yMean) ** 2;
    ssResidual += (p.y - (slope * p.x + intercept)) ** 2;
  }
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, rSquared };
}

export function MarketCapVsConcentration({
  data,
  showTrendLine = true,
}: MarketCapVsConcentrationProps) {
  // Group data by category
  const categories = Array.from(new Set(data.map((d) => d.category || "default")));
  const groupedData: Record<string, Array<{ x: number; y: number; label: string; category: string }>> = {};

  for (const cat of categories) {
    groupedData[cat] = data
      .filter((d) => (d.category || "default") === cat)
      .map((d) => ({
        x: d.marketCap,
        y: d.top10Percent,
        label: d.label,
        category: d.category || "default",
      }));
  }

  // Calculate regression
  const allPoints = data.map((d) => ({ x: d.marketCap, y: d.top10Percent }));
  const regression = showTrendLine ? logLinearRegression(allPoints) : null;

  const correlationText = regression
    ? regression.slope < 0
      ? "Larger tokens tend to be less concentrated"
      : "Larger tokens tend to be more concentrated"
    : "";

  return (
    <ChartContainer
      title="Market Cap vs Top-10 Holder Concentration"
      subtitle={`Are larger tokens more or less concentrated? ${correlationText}`}
      source="CoinGecko, Codex.io"
    >
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            scale="log"
            domain={["auto", "auto"]}
            tickFormatter={(v) => formatNumber(v, 0)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
            label={{
              value: "Market Cap (log scale)",
              position: "bottom",
              offset: 20,
              fontSize: CHART_STYLE.labelSize,
              fill: CHART_COLORS.axis,
            }}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[0, 1]}
            tickFormatter={(v) => formatPercent(v, 0)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={55}
            label={{
              value: "Top 10% Holdings",
              angle: -90,
              position: "insideLeft",
              offset: 0,
              fontSize: CHART_STYLE.labelSize,
              fill: CHART_COLORS.axis,
            }}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const point = payload[0].payload as {
                x: number;
                y: number;
                label: string;
                category: string;
              };
              return (
                <div style={CHART_STYLE.tooltipStyle}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{point.label}</p>
                  <p style={{ margin: 0 }}>Market Cap: {formatNumber(point.x)}</p>
                  <p style={{ margin: 0 }}>Top 10%: {formatPercent(point.y)}</p>
                  {point.category !== "default" && (
                    <p style={{ margin: 0, color: CHART_COLORS.axis, textTransform: "capitalize" }}>
                      {point.category}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: CHART_STYLE.axisTickSize }}
            iconType="circle"
            iconSize={8}
          />

          {/* Reference line at 50% concentration */}
          <ReferenceLine
            y={0.5}
            stroke={CHART_COLORS.neutral}
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            label={{
              value: "50%",
              position: "right",
              fontSize: 10,
              fill: CHART_COLORS.neutral,
            }}
          />

          {/* Scatter plots by category */}
          {categories.map((cat, idx) =>
            groupedData[cat]?.length > 0 ? (
              <Scatter
                key={cat}
                name={cat === "default" ? "Tokens" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                data={groupedData[cat]}
                fill={CATEGORY_COLORS[cat] || CHART_COLORS.series[idx % CHART_COLORS.series.length]}
                fillOpacity={0.7}
                stroke={CATEGORY_COLORS[cat] || CHART_COLORS.series[idx % CHART_COLORS.series.length]}
                strokeWidth={1}
              />
            ) : null
          )}
        </ScatterChart>
      </ResponsiveContainer>

      {regression && (
        <p className="mt-2 text-xs text-ink-faint text-right">
          R² = {regression.rSquared.toFixed(3)} (log-linear fit)
        </p>
      )}
    </ChartContainer>
  );
}
