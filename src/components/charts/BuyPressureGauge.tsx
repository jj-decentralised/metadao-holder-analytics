"use client";

import { CHART_COLORS } from "./theme";

interface BuyPressureGaugeProps {
  value: number; // 0-1 scale
  label?: string;
}

function getGaugeColor(value: number): string {
  if (value > 0.55) return CHART_COLORS.positive;
  if (value < 0.45) return CHART_COLORS.negative;
  return CHART_COLORS.neutral;
}

function getGaugeLabel(value: number): string {
  if (value > 0.55) return "Accumulation";
  if (value < 0.45) return "Distribution";
  return "Neutral";
}

export function BuyPressureGauge({ value, label }: BuyPressureGaugeProps) {
  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, value));

  // SVG dimensions
  const width = 200;
  const height = 120;
  const cx = width / 2;
  const cy = height - 10;
  const radius = 80;
  const strokeWidth = 12;

  // Arc calculations (180 degrees, from left to right)
  const startAngle = Math.PI; // 180 degrees (left)
  const endAngle = 0; // 0 degrees (right)
  const valueAngle = startAngle - clampedValue * Math.PI;

  // Convert polar to cartesian
  const polarToCartesian = (angle: number, r: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  });

  // Background arc path
  const bgStart = polarToCartesian(startAngle, radius);
  const bgEnd = polarToCartesian(endAngle, radius);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;

  // Value arc path
  const valueEnd = polarToCartesian(valueAngle, radius);
  const largeArcFlag = clampedValue > 0.5 ? 1 : 0;
  const valuePath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${valueEnd.x} ${valueEnd.y}`;

  // Needle position
  const needleLength = radius - 15;
  const needleEnd = polarToCartesian(valueAngle, needleLength);

  const gaugeColor = getGaugeColor(clampedValue);
  const gaugeLabel = getGaugeLabel(clampedValue);

  // Tick marks
  const ticks = [0, 0.25, 0.45, 0.55, 0.75, 1];
  const tickLabels = ["0", "", "Sell", "Buy", "", "1"];

  return (
    <div className="bg-surface border border-rule-light p-4">
      {label && (
        <h3 className="font-serif text-lg font-semibold text-ink text-center mb-2">
          {label}
        </h3>
      )}

      <div className="flex justify-center">
        <svg width={width} height={height} className="overflow-visible">
          {/* Gradient zones */}
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={CHART_COLORS.negative} stopOpacity={0.2} />
              <stop offset="45%" stopColor={CHART_COLORS.neutral} stopOpacity={0.2} />
              <stop offset="55%" stopColor={CHART_COLORS.neutral} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART_COLORS.positive} stopOpacity={0.2} />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d={bgPath}
            fill="none"
            stroke={CHART_COLORS.grid}
            strokeWidth={strokeWidth + 8}
            strokeLinecap="round"
          />

          {/* Zone indicators */}
          {/* Distribution zone (0 - 0.45) */}
          <path
            d={`M ${polarToCartesian(startAngle, radius).x} ${polarToCartesian(startAngle, radius).y} A ${radius} ${radius} 0 0 1 ${polarToCartesian(startAngle - 0.45 * Math.PI, radius).x} ${polarToCartesian(startAngle - 0.45 * Math.PI, radius).y}`}
            fill="none"
            stroke={CHART_COLORS.negative}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.2}
          />

          {/* Neutral zone (0.45 - 0.55) */}
          <path
            d={`M ${polarToCartesian(startAngle - 0.45 * Math.PI, radius).x} ${polarToCartesian(startAngle - 0.45 * Math.PI, radius).y} A ${radius} ${radius} 0 0 1 ${polarToCartesian(startAngle - 0.55 * Math.PI, radius).x} ${polarToCartesian(startAngle - 0.55 * Math.PI, radius).y}`}
            fill="none"
            stroke={CHART_COLORS.neutral}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.2}
          />

          {/* Accumulation zone (0.55 - 1) */}
          <path
            d={`M ${polarToCartesian(startAngle - 0.55 * Math.PI, radius).x} ${polarToCartesian(startAngle - 0.55 * Math.PI, radius).y} A ${radius} ${radius} 0 0 1 ${polarToCartesian(endAngle, radius).x} ${polarToCartesian(endAngle, radius).y}`}
            fill="none"
            stroke={CHART_COLORS.positive}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.2}
          />

          {/* Value arc */}
          {clampedValue > 0 && (
            <path
              d={valuePath}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          )}

          {/* Tick marks */}
          {ticks.map((tick, i) => {
            const tickAngle = startAngle - tick * Math.PI;
            const innerPos = polarToCartesian(tickAngle, radius - strokeWidth / 2 - 4);
            const outerPos = polarToCartesian(tickAngle, radius + strokeWidth / 2 + 4);
            const labelPos = polarToCartesian(tickAngle, radius + strokeWidth / 2 + 16);

            return (
              <g key={tick}>
                <line
                  x1={innerPos.x}
                  y1={innerPos.y}
                  x2={outerPos.x}
                  y2={outerPos.y}
                  stroke={CHART_COLORS.axis}
                  strokeWidth={1.5}
                />
                {tickLabels[i] && (
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={10}
                    fill={CHART_COLORS.axis}
                  >
                    {tickLabels[i]}
                  </text>
                )}
              </g>
            );
          })}

          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke={gaugeColor}
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* Center circle */}
          <circle cx={cx} cy={cy} r={8} fill={gaugeColor} />
          <circle cx={cx} cy={cy} r={4} fill="white" />
        </svg>
      </div>

      {/* Value display */}
      <div className="text-center mt-2">
        <div className="text-2xl font-semibold" style={{ color: gaugeColor }}>
          {(clampedValue * 100).toFixed(1)}%
        </div>
        <div className="text-sm text-ink-muted" style={{ color: gaugeColor }}>
          {gaugeLabel}
        </div>
      </div>
    </div>
  );
}
