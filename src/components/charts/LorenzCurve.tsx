"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
} from "recharts";
import { CHART_COLORS, CHART_STYLE, formatPercent } from "./theme";
import { ChartContainer } from "./ChartContainer";

interface LorenzCurveProps {
  /** Array of {x, y} points from lorenzCurve() */
  data: Array<{ x: number; y: number }>;
  /** Optional second curve for comparison */
  comparisonData?: Array<{ x: number; y: number }>;
  tokenName: string;
  comparisonName?: string;
  gini?: number;
}

export function LorenzCurveChart({
  data,
  comparisonData,
  tokenName,
  comparisonName,
  gini,
}: LorenzCurveProps) {
  const merged = data.map((d) => {
    const comp = comparisonData?.find((c) => Math.abs(c.x - d.x) < 0.01);
    return {
      x: d.x,
      equality: d.x,
      [tokenName]: d.y,
      ...(comp ? { [comparisonName || "Comparison"]: comp.y } : {}),
    };
  });

  return (
    <ChartContainer
      title="Lorenz Curve"
      subtitle={
        gini !== undefined
          ? `${tokenName} — Gini: ${gini.toFixed(3)}`
          : tokenName
      }
      source="Codex.io holder data"
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={merged} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="x"
            tickFormatter={(v) => formatPercent(v, 0)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
            label={{ value: "% of holders", position: "bottom", fontSize: 11, fill: CHART_COLORS.axis }}
          />
          <YAxis
            tickFormatter={(v) => formatPercent(v, 0)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={50}
            label={{ value: "% of supply", angle: -90, position: "insideLeft", fontSize: 11, fill: CHART_COLORS.axis }}
          />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            formatter={(value: number | undefined) => [formatPercent(value ?? 0), ""]}
            labelFormatter={(x) => `${formatPercent(x as number, 0)} of holders`}
          />
          {/* Equality line (45 degree) */}
          <Line
            type="monotone"
            dataKey="equality"
            stroke={CHART_COLORS.equality}
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            name="Perfect Equality"
          />
          {/* Actual distribution */}
          <Area
            type="monotone"
            dataKey={tokenName}
            stroke={CHART_COLORS.series[0]}
            fill={CHART_COLORS.series[0]}
            fillOpacity={0.1}
            strokeWidth={2}
            dot={false}
          />
          {comparisonName && (
            <Line
              type="monotone"
              dataKey={comparisonName}
              stroke={CHART_COLORS.series[1]}
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="6 3"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
