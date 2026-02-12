"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { CHART_COLORS, CHART_STYLE, formatNumber, formatDate } from "./theme";

interface VolumeData {
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
}

interface VolumeChartProps {
  data: VolumeData[];
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

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  const buyVolume = payload.find((p) => p.dataKey === "buyVolume")?.value ?? 0;
  const sellVolume = payload.find((p) => p.dataKey === "sellVolume")?.value ?? 0;
  const totalVolume = buyVolume + sellVolume;
  const buyPercent = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;

  return (
    <div style={CHART_STYLE.tooltipStyle}>
      <div className="font-medium mb-2">{formatDate(label)}</div>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-ink-muted">Total:</span>
          <span className="font-medium">{formatNumber(totalVolume, 0)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.positive }} />
            <span className="text-ink-muted">Buy:</span>
          </div>
          <span style={{ color: CHART_COLORS.positive }}>
            {formatNumber(buyVolume, 0)} ({buyPercent.toFixed(1)}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.negative }} />
            <span className="text-ink-muted">Sell:</span>
          </div>
          <span style={{ color: CHART_COLORS.negative }}>
            {formatNumber(sellVolume, 0)} ({(100 - buyPercent).toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

function calculateMovingAverage(data: VolumeData[], period: number): (number | null)[] {
  return data.map((_, index) => {
    if (index < period - 1) return null;
    const slice = data.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, d) => acc + d.buyVolume + d.sellVolume, 0);
    return sum / period;
  });
}

export function VolumeChart({ data, tokenName, source }: VolumeChartProps) {
  const maPeriod = Math.min(7, Math.floor(data.length / 3));
  const movingAverage = calculateMovingAverage(data, maPeriod);

  const chartData = data.map((d, i) => ({
    ...d,
    ma: movingAverage[i],
  }));

  const maxVolume = Math.max(...data.map((d) => d.buyVolume + d.sellVolume));

  return (
    <ChartContainer
      title={`${tokenName} Trading Volume`}
      subtitle="Daily buy and sell volume breakdown"
      source={source}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatDate(ts)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, maxVolume * 1.1]}
              tickFormatter={(v) => formatNumber(v, 0)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span className="text-xs text-ink-muted">
                  {value === "buyVolume" ? "Buy" : value === "sellVolume" ? "Sell" : `${maPeriod}-day MA`}
                </span>
              )}
            />

            <Bar
              dataKey="buyVolume"
              stackId="volume"
              fill={CHART_COLORS.positive}
              name="buyVolume"
            />
            <Bar
              dataKey="sellVolume"
              stackId="volume"
              fill={CHART_COLORS.negative}
              name="sellVolume"
            />

            <Line
              type="monotone"
              dataKey="ma"
              stroke={CHART_COLORS.series[0]}
              strokeWidth={2}
              dot={false}
              name="ma"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
