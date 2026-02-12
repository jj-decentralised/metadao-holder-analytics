"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { CHART_COLORS, CHART_STYLE, formatNumber, formatDate } from "./theme";
import { ChartContainer } from "./ChartContainer";

interface PriceChartProps {
  data: Array<{ timestamp: number; price: number }>;
  comparisonData?: Array<{ timestamp: number; price: number }>;
  tokenName: string;
  comparisonName?: string;
  source?: string;
}

export function PriceChart({
  data,
  comparisonData,
  tokenName,
  comparisonName,
  source = "CoinGecko",
}: PriceChartProps) {
  // Merge data for comparison view
  const merged = data.map((d) => {
    const comp = comparisonData?.find(
      (c) => Math.abs(c.timestamp - d.timestamp) < 86400000
    );
    return {
      timestamp: d.timestamp,
      [tokenName]: d.price,
      ...(comp ? { [comparisonName || "Comparison"]: comp.price } : {}),
    };
  });

  return (
    <ChartContainer
      title={`${tokenName} Price`}
      subtitle={comparisonName ? `vs ${comparisonName}` : "USD"}
      source={source}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={merged} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid
            stroke={CHART_COLORS.grid}
            strokeDasharray="none"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => formatDate(ts)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatNumber(v)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            labelFormatter={(ts) => formatDate(ts as number)}
            formatter={(value: number | undefined) => [formatNumber(value ?? 0), ""]}
          />
          <Line
            type="monotone"
            dataKey={tokenName}
            stroke={CHART_COLORS.series[0]}
            strokeWidth={1.5}
            dot={false}
          />
          {comparisonName && (
            <Line
              type="monotone"
              dataKey={comparisonName}
              stroke={CHART_COLORS.series[1]}
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
