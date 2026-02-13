"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { CHART_COLORS, CHART_STYLE, formatDate, formatNumber } from "./theme";
import type { RevenueDataPoint } from "@/types";

interface RevenueChartProps {
  data: RevenueDataPoint[];
  tokenName: string;
  source?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: number;
}

const REVENUE_COLORS = {
  revenue: CHART_COLORS.series[0], // black
  fees: CHART_COLORS.series[1], // gray
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div style={CHART_STYLE.tooltipStyle}>
      <div className="font-medium mb-2">{formatDate(label)}</div>
      {payload.map((entry, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-ink-muted capitalize">
              {entry.dataKey}:
            </span>
          </div>
          <span className="font-medium">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ data, tokenName, source }: RevenueChartProps) {
  return (
    <ChartContainer
      title={`${tokenName} Revenue`}
      subtitle="Daily revenue and protocol fees over time"
      source={source}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <CartesianGrid
              stroke={CHART_COLORS.grid}
              strokeDasharray="none"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatDate(ts)}
              tick={{
                fontSize: CHART_STYLE.axisTickSize,
                fill: CHART_COLORS.axis,
              }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => formatNumber(v)}
              tick={{
                fontSize: CHART_STYLE.axisTickSize,
                fill: CHART_COLORS.axis,
              }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-xs text-ink-muted capitalize">
                  {value}
                </span>
              )}
            />

            <Area
              type="monotone"
              dataKey="revenue"
              stackId="1"
              stroke={REVENUE_COLORS.revenue}
              fill={REVENUE_COLORS.revenue}
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="fees"
              stackId="1"
              stroke={REVENUE_COLORS.fees}
              fill={REVENUE_COLORS.fees}
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
