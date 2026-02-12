"use client";

import { CHART_COLORS } from "./theme";

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function SparklineChart({
  data,
  width = 80,
  height = 24,
  color,
}: SparklineChartProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const trend = data[data.length - 1] - data[0];
  const strokeColor =
    color ?? (trend >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative);

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        points={points}
      />
    </svg>
  );
}
