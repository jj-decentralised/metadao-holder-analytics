"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ZAxis,
} from "recharts";
import { CHART_COLORS, CHART_STYLE } from "./theme";
import { ChartContainer } from "./ChartContainer";

export interface ScatterDataPoint {
  x: number;
  y: number;
  label: string;
  category?: string;
}

interface ScatterPlotProps {
  data: ScatterDataPoint[];
  xLabel: string;
  yLabel: string;
  title: string;
  subtitle?: string;
  showTrendLine?: boolean;
  xFormatter?: (value: number) => string;
  yFormatter?: (value: number) => string;
  xScale?: "auto" | "log";
  yScale?: "auto" | "log";
  source?: string;
}

/** Compute linear regression (y = mx + b) and return slope, intercept, r² */
function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0,
    sumYY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const yMean = sumY / n;
  let ssTotal = 0,
    ssResidual = 0;
  for (const p of points) {
    ssTotal += (p.y - yMean) ** 2;
    ssResidual += (p.y - (slope * p.x + intercept)) ** 2;
  }
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, rSquared };
}

function defaultFormatter(value: number): string {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(2);
}

export function ScatterPlot({
  data,
  xLabel,
  yLabel,
  title,
  subtitle,
  showTrendLine = false,
  xFormatter = defaultFormatter,
  yFormatter = defaultFormatter,
  xScale = "auto",
  yScale = "auto",
  source,
}: ScatterPlotProps) {
  // Group data by category
  const categories = Array.from(new Set(data.map((d) => d.category || "default")));
  const groupedData: Record<string, ScatterDataPoint[]> = {};
  for (const cat of categories) {
    groupedData[cat] = data.filter((d) => (d.category || "default") === cat);
  }

  // Calculate trend line if enabled
  const regression = showTrendLine ? linearRegression(data) : null;
  const xValues = data.map((d) => d.x);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);

  const trendLineData = regression
    ? [
        { x: xMin, y: regression.slope * xMin + regression.intercept },
        { x: xMax, y: regression.slope * xMax + regression.intercept },
      ]
    : [];

  const getCategoryColor = (category: string, idx: number): string => {
    const categoryColors: Record<string, string> = {
      metadao: CHART_COLORS.series[0], // black
      vc: CHART_COLORS.series[1], // gray
      community: CHART_COLORS.series[2], // green
    };
    return categoryColors[category.toLowerCase()] || CHART_COLORS.series[idx % CHART_COLORS.series.length];
  };

  return (
    <ChartContainer title={title} subtitle={subtitle} source={source}>
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            name={xLabel}
            scale={xScale}
            domain={xScale === "log" ? ["auto", "auto"] : undefined}
            tickFormatter={xFormatter}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
            label={{
              value: xLabel,
              position: "bottom",
              offset: 20,
              fontSize: CHART_STYLE.labelSize,
              fill: CHART_COLORS.axis,
            }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name={yLabel}
            scale={yScale}
            domain={yScale === "log" ? ["auto", "auto"] : undefined}
            tickFormatter={yFormatter}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={60}
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              offset: 0,
              fontSize: CHART_STYLE.labelSize,
              fill: CHART_COLORS.axis,
            }}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const point = payload[0].payload as ScatterDataPoint;
              return (
                <div style={CHART_STYLE.tooltipStyle}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{point.label}</p>
                  <p style={{ margin: 0 }}>
                    {xLabel}: {xFormatter(point.x)}
                  </p>
                  <p style={{ margin: 0 }}>
                    {yLabel}: {yFormatter(point.y)}
                  </p>
                  {point.category && (
                    <p style={{ margin: 0, color: CHART_COLORS.axis }}>
                      Category: {point.category}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: CHART_STYLE.axisTickSize }}
            iconType="circle"
            iconSize={8}
          />

          {/* Render scatter for each category */}
          {categories.map((cat, idx) => (
            <Scatter
              key={cat}
              name={cat === "default" ? "Data" : cat}
              data={groupedData[cat]}
              fill={getCategoryColor(cat, idx)}
              fillOpacity={0.7}
              stroke={getCategoryColor(cat, idx)}
              strokeWidth={1}
            />
          ))}

          {/* Trend line */}
          {showTrendLine && regression && (
            <ReferenceLine
              segment={[
                { x: trendLineData[0].x, y: trendLineData[0].y },
                { x: trendLineData[1].x, y: trendLineData[1].y },
              ]}
              stroke={CHART_COLORS.neutral}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              label={{
                value: `R² = ${regression.rSquared.toFixed(3)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: CHART_COLORS.neutral,
              }}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
