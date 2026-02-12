"use client";

import { ChartContainer } from "./ChartContainer";

interface TokenConcentration {
  name: string;
  top1: number;
  top10: number;
  top50: number;
  rest: number;
}

interface ConcentrationBarProps {
  tokens: TokenConcentration[];
}

const COLORS = ["#CC0000", "#E6553A", "#F5A623", "#26A65B"];
const LABELS = ["Top 1%", "Top 10%", "Top 50%", "Rest"];

export function ConcentrationBar({ tokens }: ConcentrationBarProps) {
  return (
    <ChartContainer
      title="Holder Concentration"
      subtitle="Share of supply held by top holders"
      source="Codex.io"
    >
      <div className="space-y-3">
        {tokens.map((token) => {
          const segments = [token.top1, token.top10 - token.top1, token.top50 - token.top10, token.rest];
          return (
            <div key={token.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-ink">{token.name}</span>
              </div>
              <div className="flex h-6 w-full overflow-hidden rounded-sm">
                {segments.map((pct, i) => (
                  <div
                    key={i}
                    style={{ width: `${pct * 100}%`, backgroundColor: COLORS[i] }}
                    className="flex items-center justify-center text-[9px] text-white font-medium"
                  >
                    {pct > 0.08 ? `${(pct * 100).toFixed(0)}%` : ""}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex gap-4 mt-2">
          {LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-xs text-ink-faint">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartContainer>
  );
}
