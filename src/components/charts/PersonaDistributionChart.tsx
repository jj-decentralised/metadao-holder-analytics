"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { CHART_COLORS, CHART_STYLE } from "./theme";
import type { HolderPersona } from "@/types";

interface PersonaDistributionChartProps {
  personas: Record<HolderPersona, number>;
  tokenName: string;
  source?: string;
}

const PERSONA_LABELS: Record<HolderPersona, string> = {
  diamond_hands: "Diamond Hands",
  accumulator: "Accumulators",
  trader: "Active Traders",
  yield_farmer: "Yield Farmers",
  governance_active: "Governance Active",
  dormant: "Dormant Holders",
  new_holder: "New Holders",
};

const PERSONA_COLORS: Record<HolderPersona, string> = {
  diamond_hands: CHART_COLORS.series[0], // black
  accumulator: CHART_COLORS.positive, // green
  trader: CHART_COLORS.series[4], // blue
  yield_farmer: CHART_COLORS.series[5], // purple
  governance_active: CHART_COLORS.series[6], // cyan
  dormant: CHART_COLORS.series[1], // gray
  new_holder: CHART_COLORS.series[7], // amber
};

interface ChartDataItem {
  persona: HolderPersona;
  label: string;
  count: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartDataItem;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div style={CHART_STYLE.tooltipStyle}>
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: data.color }}
        />
        <span className="font-medium">{data.label}</span>
      </div>
      <div className="text-sm text-ink-muted mt-1">
        {data.count.toLocaleString()} holders
      </div>
    </div>
  );
}

export function PersonaDistributionChart({
  personas,
  tokenName,
  source,
}: PersonaDistributionChartProps) {
  // Transform personas record to array for chart
  const chartData: ChartDataItem[] = (
    Object.entries(personas) as [HolderPersona, number][]
  )
    .map(([persona, count]) => ({
      persona,
      label: PERSONA_LABELS[persona],
      count,
      color: PERSONA_COLORS[persona],
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...chartData.map((d) => d.count));

  return (
    <ChartContainer
      title={`${tokenName} Holder Personas`}
      subtitle="Distribution of holders by behavioral classification"
      source={source}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
          >
            <XAxis
              type="number"
              domain={[0, maxCount * 1.1]}
              tickFormatter={(v) => v.toLocaleString()}
              tick={{
                fontSize: CHART_STYLE.axisTickSize,
                fill: CHART_COLORS.axis,
              }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{
                fontSize: CHART_STYLE.axisTickSize,
                fill: CHART_COLORS.axis,
              }}
              axisLine={false}
              tickLine={false}
              width={95}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f5f5f5" }} />
            <Bar dataKey="count" radius={[0, 2, 2, 0]} maxBarSize={28}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
