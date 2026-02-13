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
import { CHART_COLORS, CHART_STYLE } from "./theme";
import { ChartContainer } from "./ChartContainer";

export interface GiniHolderDataPoint {
  holderCount: number;
  gini: number;
  label: string;
  category: "metadao" | "vc" | "community";
}

interface GiniVsHoldersScatterProps {
  data: GiniHolderDataPoint[];
  showTrendLine?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  metadao: CHART_COLORS.series[0], // black
  vc: CHART_COLORS.series[1], // gray
  community: CHART_COLORS.series[2], // green
};

function formatHolderCount(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toString();
}

/** Compute linear regression for log-transformed x values */
function logLinearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;

  // Use log of x for regression
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

  // R² calculation
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

export function GiniVsHoldersScatter({
  data,
  showTrendLine = true,
}: GiniVsHoldersScatterProps) {
  // Group data by category
  const categories = ["metadao", "vc", "community"] as const;
  const groupedData: Record<string, Array<{ x: number; y: number; label: string; category: string }>> = {};

  for (const cat of categories) {
    groupedData[cat] = data
      .filter((d) => d.category === cat)
      .map((d) => ({
        x: d.holderCount,
        y: d.gini,
        label: d.label,
        category: d.category,
      }));
  }

  // Calculate regression for trend line
  const allPoints = data.map((d) => ({ x: d.holderCount, y: d.gini }));
  const regression = showTrendLine ? logLinearRegression(allPoints) : null;

  // Determine correlation direction for subtitle
  const correlationText = regression
    ? regression.slope < 0
      ? "Negative correlation: more holders tends to mean lower Gini"
      : "Positive correlation: more holders tends to mean higher Gini"
    : "";

  return (
    <ChartContainer
      title="Gini Coefficient vs Holder Count"
      subtitle={`Does decentralization increase with more holders? ${correlationText}`}
      source="Codex.io"
    >
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            scale="log"
            domain={["auto", "auto"]}
            tickFormatter={formatHolderCount}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
            label={{
              value: "Holder Count (log scale)",
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
            tickFormatter={(v) => v.toFixed(2)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={50}
            label={{
              value: "Gini Coefficient",
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
                  <p style={{ margin: 0 }}>Holders: {formatHolderCount(point.x)}</p>
                  <p style={{ margin: 0 }}>Gini: {point.y.toFixed(3)}</p>
                  <p style={{ margin: 0, color: CHART_COLORS.axis, textTransform: "capitalize" }}>
                    {point.category}
                  </p>
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: CHART_STYLE.axisTickSize }}
            iconType="circle"
            iconSize={8}
          />

          {/* Reference lines for Gini interpretation */}
          <ReferenceLine
            y={0.4}
            stroke={CHART_COLORS.positive}
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={0.7}
            stroke={CHART_COLORS.negative}
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />

          {/* Scatter plots by category */}
          {categories.map((cat) =>
            groupedData[cat]?.length > 0 ? (
              <Scatter
                key={cat}
                name={cat.charAt(0).toUpperCase() + cat.slice(1)}
                data={groupedData[cat]}
                fill={CATEGORY_COLORS[cat]}
                fillOpacity={0.7}
                stroke={CATEGORY_COLORS[cat]}
                strokeWidth={1}
              />
            ) : null
          )}
        </ScatterChart>
      </ResponsiveContainer>

      {/* R² annotation */}
      {regression && (
        <p className="mt-2 text-xs text-ink-faint text-right">
          R² = {regression.rSquared.toFixed(3)} (log-linear fit)
        </p>
      )}
    </ChartContainer>
  );
}
