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
  ZAxis,
} from "recharts";
import { CHART_COLORS, CHART_STYLE } from "./theme";
import { ChartContainer } from "./ChartContainer";

export interface CategoryMetrics {
  label: string;
  category: "metadao" | "vc" | "community";
  gini: number;
  nakamoto: number;
  hhi: number;
  entropy: number;
}

interface CategoryComparisonScatterProps {
  data: CategoryMetrics[];
}

const CATEGORY_COLORS: Record<string, string> = {
  metadao: CHART_COLORS.series[0], // black
  vc: CHART_COLORS.series[1], // gray
  community: CHART_COLORS.series[2], // green
};

interface MiniScatterProps {
  data: CategoryMetrics[];
  xKey: keyof Omit<CategoryMetrics, "label" | "category">;
  yKey: keyof Omit<CategoryMetrics, "label" | "category">;
  xLabel: string;
  yLabel: string;
  title: string;
}

function MiniScatter({ data, xKey, yKey, xLabel, yLabel, title }: MiniScatterProps) {
  const categories = ["metadao", "vc", "community"] as const;
  const groupedData: Record<
    string,
    Array<{ x: number; y: number; label: string; category: string }>
  > = {};

  for (const cat of categories) {
    groupedData[cat] = data
      .filter((d) => d.category === cat)
      .map((d) => ({
        x: d[xKey] as number,
        y: d[yKey] as number,
        label: d.label,
        category: d.category,
      }));
  }

  const formatValue = (v: number, key: string): string => {
    if (key === "entropy") return v.toFixed(2);
    if (key === "nakamoto") return v.toFixed(0);
    if (key === "hhi") return (v * 10000).toFixed(0);
    return v.toFixed(3);
  };

  return (
    <div className="bg-surface border border-rule-light p-4">
      <h4 className="font-serif text-sm font-semibold text-ink mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={{ top: 5, right: 5, bottom: 30, left: 5 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
            tickFormatter={(v) => formatValue(v, xKey)}
            label={{
              value: xLabel,
              position: "bottom",
              offset: 15,
              fontSize: 10,
              fill: CHART_COLORS.axis,
            }}
          />
          <YAxis
            dataKey="y"
            type="number"
            tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
            axisLine={false}
            tickLine={false}
            width={35}
            tickFormatter={(v) => formatValue(v, yKey)}
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              offset: 5,
              fontSize: 10,
              fill: CHART_COLORS.axis,
            }}
          />
          <ZAxis range={[40, 40]} />
          <Tooltip
            contentStyle={{ ...CHART_STYLE.tooltipStyle, fontSize: "11px" }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const point = payload[0].payload as {
                x: number;
                y: number;
                label: string;
                category: string;
              };
              return (
                <div style={{ ...CHART_STYLE.tooltipStyle, fontSize: "11px" }}>
                  <p style={{ fontWeight: 600, marginBottom: 2 }}>{point.label}</p>
                  <p style={{ margin: 0 }}>
                    {xLabel}: {formatValue(point.x, xKey)}
                  </p>
                  <p style={{ margin: 0 }}>
                    {yLabel}: {formatValue(point.y, yKey)}
                  </p>
                </div>
              );
            }}
          />

          {categories.map((cat) =>
            groupedData[cat]?.length > 0 ? (
              <Scatter
                key={cat}
                data={groupedData[cat]}
                fill={CATEGORY_COLORS[cat]}
                fillOpacity={0.7}
                stroke={CATEGORY_COLORS[cat]}
                strokeWidth={1}
              />
            ) : null
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryComparisonScatter({ data }: CategoryComparisonScatterProps) {
  return (
    <ChartContainer
      title="Cross-Metric Category Comparison"
      subtitle="Comparing decentralization metrics across token categories"
      source="Codex.io"
    >
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {(["metadao", "vc", "community"] as const).map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            <span className="text-xs text-ink-muted capitalize">{cat}</span>
          </div>
        ))}
      </div>

      {/* 2x2 Grid of scatter plots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MiniScatter
          data={data}
          xKey="gini"
          yKey="nakamoto"
          xLabel="Gini"
          yLabel="Nakamoto"
          title="Gini vs Nakamoto Coefficient"
        />
        <MiniScatter
          data={data}
          xKey="hhi"
          yKey="entropy"
          xLabel="HHI (×10⁴)"
          yLabel="Entropy"
          title="HHI vs Shannon Entropy"
        />
        <MiniScatter
          data={data}
          xKey="gini"
          yKey="entropy"
          xLabel="Gini"
          yLabel="Entropy"
          title="Gini vs Entropy"
        />
        <MiniScatter
          data={data}
          xKey="nakamoto"
          yKey="hhi"
          xLabel="Nakamoto"
          yLabel="HHI (×10⁴)"
          title="Nakamoto vs HHI"
        />
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Gini: 0 = perfect equality, 1 = maximum inequality | Nakamoto: min holders for 51% control |
        HHI: concentration index (higher = more concentrated) | Entropy: diversity measure (higher = more distributed)
      </p>
    </ChartContainer>
  );
}
