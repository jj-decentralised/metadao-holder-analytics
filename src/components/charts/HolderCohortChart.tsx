"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { CHART_COLORS, CHART_STYLE, formatDate, formatPercent } from "./theme";

interface CohortData {
  timestamp: number;
  whales: number;
  sharks: number;
  dolphins: number;
  fish: number;
}

interface HolderCohortChartProps {
  data: CohortData[];
  tokenName: string;
  source?: string;
}

const COHORT_COLORS = {
  whales: "#1E3A5F",    // Deep navy
  sharks: "#3D6B99",    // Medium blue
  dolphins: "#7BA3CC",  // Light blue
  fish: "#B8D4E8",      // Pale blue
};

const COHORT_LABELS = {
  whales: "Whales (>1%)",
  sharks: "Sharks (0.1-1%)",
  dolphins: "Dolphins (0.01-0.1%)",
  fish: "Fish (<0.01%)",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: keyof typeof COHORT_COLORS;
    value: number;
    color: string;
  }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div style={CHART_STYLE.tooltipStyle}>
      <div className="font-medium mb-2">{formatDate(label)}</div>
      {payload.reverse().map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-ink-muted">
              {COHORT_LABELS[entry.dataKey as keyof typeof COHORT_LABELS]}:
            </span>
          </div>
          <span className="font-medium">{formatPercent(entry.value / 100)}</span>
        </div>
      ))}
    </div>
  );
}

export function HolderCohortChart({ data, tokenName, source }: HolderCohortChartProps) {
  // Normalize data to percentages
  const chartData = data.map((d) => {
    const total = d.whales + d.sharks + d.dolphins + d.fish;
    return {
      timestamp: d.timestamp,
      whales: total > 0 ? (d.whales / total) * 100 : 0,
      sharks: total > 0 ? (d.sharks / total) * 100 : 0,
      dolphins: total > 0 ? (d.dolphins / total) * 100 : 0,
      fish: total > 0 ? (d.fish / total) * 100 : 0,
    };
  });

  return (
    <ChartContainer
      title={`${tokenName} Holder Distribution`}
      subtitle="Token distribution by holder size over time"
      source={source}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatDate(ts)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: keyof typeof COHORT_LABELS) => (
                <span className="text-xs text-ink-muted">
                  {COHORT_LABELS[value]}
                </span>
              )}
            />

            <Area
              type="monotone"
              dataKey="fish"
              stackId="1"
              stroke={COHORT_COLORS.fish}
              fill={COHORT_COLORS.fish}
            />
            <Area
              type="monotone"
              dataKey="dolphins"
              stackId="1"
              stroke={COHORT_COLORS.dolphins}
              fill={COHORT_COLORS.dolphins}
            />
            <Area
              type="monotone"
              dataKey="sharks"
              stackId="1"
              stroke={COHORT_COLORS.sharks}
              fill={COHORT_COLORS.sharks}
            />
            <Area
              type="monotone"
              dataKey="whales"
              stackId="1"
              stroke={COHORT_COLORS.whales}
              fill={COHORT_COLORS.whales}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
