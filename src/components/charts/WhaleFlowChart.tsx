"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ZAxis,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { CHART_COLORS, CHART_STYLE, formatNumber, formatDate, formatPercent } from "./theme";

interface WhaleEvent {
  timestamp: number;
  type: "accumulate" | "distribute";
  amount: number;
  percentOfSupply: number;
}

interface WhaleFlowChartProps {
  events: WhaleEvent[];
  tokenName: string;
  source?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: WhaleEvent;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;

  const event = payload[0].payload;
  const isAccumulate = event.type === "accumulate";

  return (
    <div style={CHART_STYLE.tooltipStyle}>
      <div className="font-medium mb-2">{formatDate(event.timestamp)}</div>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isAccumulate ? CHART_COLORS.positive : CHART_COLORS.negative }}
          />
          <span
            className="font-medium"
            style={{ color: isAccumulate ? CHART_COLORS.positive : CHART_COLORS.negative }}
          >
            {isAccumulate ? "Accumulation" : "Distribution"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-ink-muted">Amount:</span>
          <span className="font-medium">{formatNumber(event.amount, 0)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-ink-muted">% of Supply:</span>
          <span className="font-medium">{formatPercent(event.percentOfSupply)}</span>
        </div>
      </div>
    </div>
  );
}

export function WhaleFlowChart({ events, tokenName, source }: WhaleFlowChartProps) {
  // Transform events for scatter chart
  // Y-axis: positive for accumulation, negative for distribution
  const chartData = events.map((e) => ({
    ...e,
    yValue: e.type === "accumulate" ? e.percentOfSupply : -e.percentOfSupply,
    size: Math.sqrt(e.percentOfSupply) * 500, // Scale for visibility
  }));

  const maxPercent = Math.max(...events.map((e) => e.percentOfSupply));
  const yDomain = [-maxPercent * 1.2, maxPercent * 1.2];

  // Calculate net flow
  const netFlow = events.reduce(
    (acc, e) => acc + (e.type === "accumulate" ? e.percentOfSupply : -e.percentOfSupply),
    0
  );
  const isNetPositive = netFlow >= 0;

  return (
    <ChartContainer
      title={`${tokenName} Whale Flow`}
      subtitle={`Large holder accumulation & distribution (Net: ${isNetPositive ? "+" : ""}${formatPercent(netFlow)})`}
      source={source}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis
              type="number"
              dataKey="timestamp"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ts) => formatDate(ts)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
            />
            <YAxis
              type="number"
              dataKey="yValue"
              domain={yDomain}
              tickFormatter={(v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
            />
            <ZAxis type="number" dataKey="size" range={[50, 400]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke={CHART_COLORS.grid} strokeWidth={2} />

            <Scatter data={chartData} isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.type === "accumulate" ? CHART_COLORS.positive : CHART_COLORS.negative}
                  fillOpacity={0.7}
                  stroke={entry.type === "accumulate" ? CHART_COLORS.positive : CHART_COLORS.negative}
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-sm text-ink-muted">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: CHART_COLORS.positive }}
          />
          <span>Accumulation</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: CHART_COLORS.negative }}
          />
          <span>Distribution</span>
        </div>
      </div>
    </ChartContainer>
  );
}
