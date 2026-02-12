"use client";

import { PriceChart } from "@/components/charts/PriceChart";
import { LorenzCurveChart } from "@/components/charts/LorenzCurve";
import type { PricePoint } from "@/types";

interface TokenDetailChartsProps {
  tokenName: string;
  priceHistory: PricePoint[];
  lorenzPoints: { x: number; y: number }[];
  gini: number;
}

export function TokenDetailCharts({
  tokenName,
  priceHistory,
  lorenzPoints,
  gini,
}: TokenDetailChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <PriceChart
        data={priceHistory.map((p) => ({ timestamp: p.timestamp, price: p.price }))}
        tokenName={tokenName}
      />
      <LorenzCurveChart
        data={lorenzPoints}
        tokenName={tokenName}
        gini={gini}
      />
    </div>
  );
}
