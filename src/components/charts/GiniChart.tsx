"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { CHART_COLORS, CHART_STYLE, formatDate } from "./theme";
import { ChartContainer } from "./ChartContainer";

interface GiniChartProps {
  data: Array<{ timestamp: number; gini: number }>;
  comparisonData?: Array<{ timestamp: number; gini: number }>;
  tokenName: string;
  comparisonName?: string;
}

export function GiniChart({
  data,
  comparisonData,
  tokenName,
  comparisonName,
}: GiniChartProps) {
  const merged = data.map((d) => {
    const comp = comparisonData?.find(
      (c) => Math.abs(c.timestamp - d.timestamp) < 86400000
    );
    return {
      timestamp: d.timestamp,
      [tokenName]: d.gini,
      ...(comp ? { [comparisonName || "Comparison"]: comp.gini } : {}),
    };
  });

  return (
    <ChartContainer
      title="Gini Coefficient Over Time"
      subtitle="Lower is more decentralized"
      source="Codex.io"
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={merged} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="giniGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.series[0]} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART_COLORS.series[0]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => formatDate(ts)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            labelFormatter={(ts) => formatDate(ts as number)}
            formatter={(value: number | undefined) => [(value ?? 0).toFixed(3), ""]}
          />
          <ReferenceLine y={0.4} stroke={CHART_COLORS.positive} strokeDasharray="3 3" label={{ value: "Low", fontSize: 10, fill: CHART_COLORS.positive }} />
          <ReferenceLine y={0.7} stroke="#F5A623" strokeDasharray="3 3" label={{ value: "Moderate", fontSize: 10, fill: "#F5A623" }} />
          <ReferenceLine y={0.85} stroke={CHART_COLORS.negative} strokeDasharray="3 3" label={{ value: "High", fontSize: 10, fill: CHART_COLORS.negative }} />
          <Area
            type="monotone"
            dataKey={tokenName}
            stroke={CHART_COLORS.series[0]}
            fill="url(#giniGradient)"
            strokeWidth={2}
            dot={false}
          />
          {comparisonName && (
            <Area
              type="monotone"
              dataKey={comparisonName}
              stroke={CHART_COLORS.series[1]}
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
