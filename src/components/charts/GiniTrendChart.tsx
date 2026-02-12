"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Legend,
  ReferenceLine,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { CHART_COLORS, CHART_STYLE, formatDate } from "./theme";

interface GiniData {
  timestamp: number;
  gini: number;
}

interface GiniTrendChartProps {
  data: GiniData[];
  tokenName: string;
  comparisonData?: GiniData[];
  comparisonName?: string;
  source?: string;
}

const GINI_ZONES = [
  { min: 0, max: 0.4, label: "Excellent", color: "#E8F5E9" },
  { min: 0.4, max: 0.6, label: "Good", color: "#FFF8E1" },
  { min: 0.6, max: 0.8, label: "Concerning", color: "#FFF3E0" },
  { min: 0.8, max: 1.0, label: "Poor", color: "#FFEBEE" },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: number;
}

function getGiniLabel(gini: number): string {
  if (gini < 0.4) return "Excellent";
  if (gini < 0.6) return "Good";
  if (gini < 0.8) return "Concerning";
  return "Poor";
}

function getGiniColor(gini: number): string {
  if (gini < 0.4) return CHART_COLORS.positive;
  if (gini < 0.6) return CHART_COLORS.series[3]; // amber
  if (gini < 0.8) return CHART_COLORS.series[1]; // warm red
  return CHART_COLORS.negative;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div style={CHART_STYLE.tooltipStyle}>
      <div className="font-medium mb-2">{formatDate(label)}</div>
      {payload.map((entry, index) => {
        const giniValue = entry.value;
        return (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-ink-muted">
                {entry.dataKey === "gini" ? "Gini" : entry.dataKey}:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{giniValue.toFixed(3)}</span>
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: getGiniColor(giniValue) + "20",
                  color: getGiniColor(giniValue),
                }}
              >
                {getGiniLabel(giniValue)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GiniTrendChart({
  data,
  tokenName,
  comparisonData,
  comparisonName,
  source,
}: GiniTrendChartProps) {
  // Merge data if comparison exists
  const chartData = data.map((d, i) => ({
    timestamp: d.timestamp,
    gini: d.gini,
    ...(comparisonData?.[i] && { comparison: comparisonData[i].gini }),
  }));

  const currentGini = data[data.length - 1]?.gini ?? 0;

  return (
    <ChartContainer
      title={`${tokenName} Distribution Equality`}
      subtitle={`Gini coefficient over time — Current: ${currentGini.toFixed(3)} (${getGiniLabel(currentGini)})`}
      source={source}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            {/* Background zones */}
            {GINI_ZONES.map((zone) => (
              <ReferenceArea
                key={zone.label}
                y1={zone.min}
                y2={zone.max}
                fill={zone.color}
                fillOpacity={0.5}
              />
            ))}

            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatDate(ts)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              tickFormatter={(v) => v.toFixed(1)}
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
                    {value === "gini" ? tokenName : comparisonName}
                  </span>
                )}
              />
            )}

            {/* Threshold lines */}
            <ReferenceLine y={0.4} stroke={CHART_COLORS.positive} strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={0.6} stroke={CHART_COLORS.series[3]} strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={0.8} stroke={CHART_COLORS.negative} strokeDasharray="3 3" strokeOpacity={0.5} />

            <Line
              type="monotone"
              dataKey="gini"
              stroke={CHART_COLORS.series[0]}
              strokeWidth={2.5}
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Zone legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-ink-muted">
        {GINI_ZONES.map((zone) => (
          <div key={zone.label} className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: zone.color }}
            />
            <span>{zone.label} (&lt;{zone.max})</span>
          </div>
        ))}
      </div>
    </ChartContainer>
  );
}
