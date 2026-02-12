"use client";

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { ChartContainer } from "./ChartContainer";
import { CHART_COLORS, CHART_STYLE, formatNumber, formatDate } from "./theme";

interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  data: OHLCVData[];
  tokenName: string;
  source?: string;
}

interface CandleShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload?: OHLCVData;
}

function CandleShape({ x, y, width, height, payload }: CandleShapeProps) {
  if (!payload) return null;
  const { open, high, low, close } = payload;
  const isUp = close >= open;
  const color = isUp ? CHART_COLORS.positive : CHART_COLORS.negative;

  const candleWidth = Math.max(width * 0.6, 2);
  const candleX = x + (width - candleWidth) / 2;

  // Scale calculations based on the bar's coordinate system
  const priceRange = high - low;
  if (priceRange === 0) return null;

  const bodyTop = Math.max(open, close);
  const bodyBottom = Math.min(open, close);

  // The bar is positioned with y at the top (high) and height spanning to low
  const pixelsPerUnit = height / priceRange;

  const wickX = x + width / 2;
  const bodyY = y + (high - bodyTop) * pixelsPerUnit;
  const bodyHeight = Math.max((bodyTop - bodyBottom) * pixelsPerUnit, 1);

  return (
    <g>
      {/* Upper wick */}
      <line
        x1={wickX}
        y1={y}
        x2={wickX}
        y2={bodyY}
        stroke={color}
        strokeWidth={1}
      />
      {/* Lower wick */}
      <line
        x1={wickX}
        y1={bodyY + bodyHeight}
        x2={wickX}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
      {/* Candle body */}
      <rect
        x={candleX}
        y={bodyY}
        width={candleWidth}
        height={bodyHeight}
        fill={isUp ? color : color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: OHLCVData }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  const isUp = data.close >= data.open;

  return (
    <div style={CHART_STYLE.tooltipStyle}>
      <div className="font-medium mb-1">{formatDate(data.timestamp)}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-muted">Open:</span>
        <span>{formatNumber(data.open, 4)}</span>
        <span className="text-ink-muted">High:</span>
        <span>{formatNumber(data.high, 4)}</span>
        <span className="text-ink-muted">Low:</span>
        <span>{formatNumber(data.low, 4)}</span>
        <span className="text-ink-muted">Close:</span>
        <span style={{ color: isUp ? CHART_COLORS.positive : CHART_COLORS.negative }}>
          {formatNumber(data.close, 4)}
        </span>
        <span className="text-ink-muted">Volume:</span>
        <span>{formatNumber(data.volume, 0)}</span>
      </div>
    </div>
  );
}

export function CandlestickChart({ data, tokenName, source }: CandlestickChartProps) {
  // Transform data for the composed chart
  const chartData = data.map((d) => ({
    ...d,
    // For the candlestick bar shape
    candleRange: [d.low, d.high],
  }));

  const minPrice = Math.min(...data.map((d) => d.low)) * 0.995;
  const maxPrice = Math.max(...data.map((d) => d.high)) * 1.005;
  const maxVolume = Math.max(...data.map((d) => d.volume));

  return (
    <ChartContainer
      title={`${tokenName} Price`}
      subtitle="OHLCV Candlestick Chart"
      source={source}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => formatDate(ts)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="price"
              domain={[minPrice, maxPrice]}
              tickFormatter={(v) => formatNumber(v, 2)}
              tick={{ fontSize: CHART_STYLE.axisTickSize, fill: CHART_COLORS.axis }}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickLine={{ stroke: CHART_COLORS.grid }}
              orientation="right"
            />
            <YAxis
              yAxisId="volume"
              domain={[0, maxVolume * 4]}
              hide
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine yAxisId="price" y={0} stroke={CHART_COLORS.grid} />

            {/* Volume bars at bottom */}
            <Bar
              yAxisId="volume"
              dataKey="volume"
              opacity={0.3}
              isAnimationActive={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`volume-${index}`}
                  fill={entry.close >= entry.open ? CHART_COLORS.positive : CHART_COLORS.negative}
                />
              ))}
            </Bar>

            {/* Candlestick shapes */}
            <Bar
              yAxisId="price"
              dataKey="candleRange"
              shape={(props: CandleShapeProps) => <CandleShape {...props} />}
              isAnimationActive={false}
            >
              {chartData.map((_, index) => (
                <Cell key={`candle-${index}`} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
