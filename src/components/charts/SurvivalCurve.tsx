"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { CHART_COLORS, CHART_STYLE, formatPercent } from "./theme";
import { ChartContainer } from "./ChartContainer";

export interface SurvivalDataPoint {
  daysHeld: number;
  percentStillHolding: number;
}

export interface CategorySurvivalData {
  category: string;
  data: SurvivalDataPoint[];
  medianDays?: number;
}

interface SurvivalCurveProps {
  categories: CategorySurvivalData[];
  title?: string;
  subtitle?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  metadao: CHART_COLORS.series[0], // black
  vc: CHART_COLORS.series[1], // gray
  community: CHART_COLORS.series[2], // green
  all: CHART_COLORS.neutral,
};

function formatDays(days: number): string {
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  if (days >= 30) return `${Math.round(days / 30)}mo`;
  return `${days}d`;
}

/**
 * Convert survival data to step-function format for Kaplan-Meier style
 * Each point creates a horizontal line until the next point
 */
function toStepData(
  data: SurvivalDataPoint[]
): Array<{ daysHeld: number; percentStillHolding: number }> {
  if (data.length === 0) return [];

  const result: Array<{ daysHeld: number; percentStillHolding: number }> = [];

  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    result.push(current);

    // Add a point just before the next step to create horizontal line
    if (i < data.length - 1) {
      const next = data[i + 1];
      result.push({
        daysHeld: next.daysHeld - 0.01,
        percentStillHolding: current.percentStillHolding,
      });
    }
  }

  return result;
}

export function SurvivalCurve({
  categories,
  title = "Holder Retention Survival Curves",
  subtitle = "Kaplan-Meier analysis of how long holders retain their positions",
}: SurvivalCurveProps) {
  // Merge all category data into a single dataset with category-specific keys
  const allDays = new Set<number>();
  for (const cat of categories) {
    for (const point of cat.data) {
      allDays.add(point.daysHeld);
    }
  }
  const sortedDays = Array.from(allDays).sort((a, b) => a - b);

  // Build merged data with step function interpolation
  const mergedData = sortedDays.map((day) => {
    const point: Record<string, number> = { daysHeld: day };

    for (const cat of categories) {
      // Find the most recent data point for this category at or before this day
      const relevantPoints = cat.data.filter((p) => p.daysHeld <= day);
      if (relevantPoints.length > 0) {
        const lastPoint = relevantPoints[relevantPoints.length - 1];
        point[cat.category] = lastPoint.percentStillHolding;
      } else if (cat.data.length > 0 && cat.data[0].daysHeld > day) {
        // Before first data point, assume 100%
        point[cat.category] = 1;
      }
    }

    return point;
  });

  // Calculate median survival times (50% retention)
  const medianSurvival: Record<string, number | null> = {};
  for (const cat of categories) {
    if (cat.medianDays !== undefined) {
      medianSurvival[cat.category] = cat.medianDays;
    } else {
      // Calculate from data
      const crossPoint = cat.data.find((p) => p.percentStillHolding <= 0.5);
      medianSurvival[cat.category] = crossPoint?.daysHeld ?? null;
    }
  }

  const getCategoryColor = (category: string, idx: number): string => {
    return (
      CATEGORY_COLORS[category.toLowerCase()] ||
      CHART_COLORS.series[idx % CHART_COLORS.series.length]
    );
  };

  return (
    <ChartContainer title={title} subtitle={subtitle} source="Codex.io">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={mergedData} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="daysHeld"
            type="number"
            domain={[0, "auto"]}
            tickFormatter={formatDays}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
            label={{
              value: "Days Held",
              position: "bottom",
              offset: 20,
              fontSize: CHART_STYLE.labelSize,
              fill: CHART_COLORS.axis,
            }}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => formatPercent(v, 0)}
            tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={50}
            label={{
              value: "% Still Holding",
              angle: -90,
              position: "insideLeft",
              offset: 0,
              fontSize: CHART_STYLE.labelSize,
              fill: CHART_COLORS.axis,
            }}
          />
          <Tooltip
            contentStyle={CHART_STYLE.tooltipStyle}
            labelFormatter={(days) => `${formatDays(days as number)} held`}
            formatter={(value, name) => {
              const nameStr = String(name ?? "");
              return [
                formatPercent((value as number) ?? 0),
                nameStr ? nameStr.charAt(0).toUpperCase() + nameStr.slice(1) : "",
              ];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: CHART_STYLE.axisTickSize }}
            iconType="plainline"
            formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          />

          {/* 50% reference line */}
          <ReferenceLine
            y={0.5}
            stroke={CHART_COLORS.neutral}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{
              value: "Median",
              position: "right",
              fontSize: 10,
              fill: CHART_COLORS.neutral,
            }}
          />

          {/* Survival curves for each category - step function style */}
          {categories.map((cat, idx) => (
            <Line
              key={cat.category}
              type="stepAfter"
              dataKey={cat.category}
              stroke={getCategoryColor(cat.category, idx)}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Median survival statistics */}
      <div className="mt-4 flex flex-wrap gap-4">
        {categories.map((cat, idx) => (
          <div key={cat.category} className="flex items-center gap-2">
            <div
              className="w-4 h-0.5"
              style={{ backgroundColor: getCategoryColor(cat.category, idx) }}
            />
            <span className="text-xs text-ink-muted capitalize">
              {cat.category}:{" "}
              {medianSurvival[cat.category] !== null
                ? `${formatDays(medianSurvival[cat.category]!)} median`
                : "—"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-ink-faint">
        Survival curves show the probability that a holder will still hold their position after N
        days. Steeper drops indicate faster churn.
      </p>
    </ChartContainer>
  );
}
