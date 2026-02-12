import type { DistributionMetrics, DecentralizationScore } from "@/types";
import {
  giniCoefficientFast,
  hhi10000,
  nakamotoCoefficient,
  shannonEntropy,
  palmaRatio,
} from "./distribution";

/**
 * Compare distribution metrics between two sets of balances.
 */
export function compareDistributions(
  metadaoBalances: number[],
  vcBalances: number[]
): Record<string, { metadao: number; vc: number; delta: number }> {
  const mGini = giniCoefficientFast(metadaoBalances);
  const vGini = giniCoefficientFast(vcBalances);

  const mHhi = hhi10000(metadaoBalances);
  const vHhi = hhi10000(vcBalances);

  const mNak = nakamotoCoefficient(metadaoBalances);
  const vNak = nakamotoCoefficient(vcBalances);

  const mEnt = shannonEntropy(metadaoBalances);
  const vEnt = shannonEntropy(vcBalances);

  const mPalma = palmaRatio(metadaoBalances);
  const vPalma = palmaRatio(vcBalances);

  return {
    gini: { metadao: mGini, vc: vGini, delta: vGini - mGini },
    hhi: { metadao: mHhi, vc: vHhi, delta: vHhi - mHhi },
    nakamoto: { metadao: mNak, vc: vNak, delta: mNak - vNak },
    entropy: { metadao: mEnt, vc: vEnt, delta: mEnt - vEnt },
    palma: { metadao: mPalma, vc: vPalma, delta: vPalma - mPalma },
  };
}

/**
 * Compute a composite decentralization score from 0-100.
 * Weights: Nakamoto(25%), inverted Gini(20%), Entropy(20%), inverted HHI(15%),
 *          HolderGrowth(10%), Stability(10%)
 */
export function decentralizationScore(
  metrics: DistributionMetrics,
  opts?: { holderGrowth?: number; stability?: number }
): DecentralizationScore {
  const holderGrowth = opts?.holderGrowth ?? 50;
  const stability = opts?.stability ?? 50;

  // Normalize each component to 0-100
  // Nakamoto: higher is better. Cap at 50 for max score.
  const nakScore = Math.min(100, (metrics.nakamotoCoefficient / 50) * 100);

  // Gini: lower is better (invert)
  const giniScore = (1 - metrics.giniCoefficient) * 100;

  // Entropy: higher is better. Normalize assuming max ~10 bits.
  const entropyScore = Math.min(100, (metrics.shannonEntropy / 10) * 100);

  // HHI: lower is better (invert). HHI ranges 0-10000.
  const hhiScore = Math.max(0, (1 - metrics.hhi / 10000) * 100);

  const overall =
    nakScore * 0.25 +
    giniScore * 0.2 +
    entropyScore * 0.2 +
    hhiScore * 0.15 +
    holderGrowth * 0.1 +
    stability * 0.1;

  const grade: DecentralizationScore["grade"] =
    overall >= 80
      ? "A"
      : overall >= 60
        ? "B"
        : overall >= 40
          ? "C"
          : overall >= 20
            ? "D"
            : "F";

  return {
    overall: Math.round(overall * 10) / 10,
    grade,
    components: {
      nakamoto: Math.round(nakScore * 10) / 10,
      gini: Math.round(giniScore * 10) / 10,
      entropy: Math.round(entropyScore * 10) / 10,
      hhi: Math.round(hhiScore * 10) / 10,
      holderGrowth: Math.round(holderGrowth * 10) / 10,
      stability: Math.round(stability * 10) / 10,
    },
  };
}
