"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { CHART_COLORS, CHART_STYLE, formatDate } from "./theme";

interface HolderData {
  timestamp: number;
  totalHolders: number;
}

interface HolderTrendChartProps {
  data: HolderData[];
  tokenName: string;
  comparisonData?: HolderData[];
  comparisonName?: string;
  source?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div style={CHART_STYLE.tooltipStyle}>
      <div className="font-medium mb-1">{formatDate(label)}</div>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-ink-muted">{entry.dataKey === "totalHolders" ? "Holders" : entry.dataKey}:</span>
          <span className="font-medium">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function HolderTrendChart({
  data,
  tokenName,
  comparisonData,
  comparisonName,
  source,
}: HolderTrendChartProps) {
  // Calculate growth percentage
  const firstValue = data[0]?.totalHolders ?? 0;
  const lastValue = data[data.length - 1]?.totalHolders ?? 0;
  const growthPercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  const isPositiveGrowth = growthPercent >= 0;

  // Merge data if comparison exists
  const chartData = data.map((d, i) => ({
    timestamp: d.timestamp,
    totalHolders: d.totalHolders,
    ...(comparisonData?.[i] && { comparison: comparisonData[i].totalHolders }),
  }));

  const allValues = [
    ...data.map((d) => d.totalHolders),
    ...(comparisonData?.map((d) => d.totalHolders) ?? []),
  ];
  const minValue = Math.min(...allValues) * 0.95;
  const maxValue = Math.max(...allValues) * 1.05;

  return (
    <ChartContainer
      title={`${tokenName} Holder Growth`}
      subtitle={`Total holders over time (${isPositiveGrowth ? "+" : ""}${growthPercent.toFixed(1)}%)`}
      source={source}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatDate(ts)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minValue, maxValue]}
              tickFormatter={(v) => v.toLocaleString()}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
            />
            <Tooltip content={<CustomTooltip />} />
            {comparisonData && (
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-ink-muted">
                    {value === "totalHolders" ? tokenName : comparisonName}
                  </span>
                )}
              />
            )}
            <ReferenceLine y={firstValue} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />

            <Line
              type="monotone"
              dataKey="totalHolders"
              stroke={CHART_COLORS.series[0]}
              strokeWidth={2}
              dot={false}
              name={tokenName}
            />

            {comparisonData && (
              <Line
                type="monotone"
                dataKey="comparison"
                stroke={CHART_COLORS.series[1]}
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
                name={comparisonName}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
