import type { HolderBuckets } from "@/types";

/**
 * Compute the Gini coefficient from an array of balances.
 * Returns 0 for perfect equality, approaches 1 for maximum inequality.
 */
export function giniCoefficient(balances: number[]): number {
  const n = balances.length;
  if (n === 0) return 0;
  if (n === 1) return 0;

  const sorted = [...balances].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;

  let sumDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiff += Math.abs(sorted[i] - sorted[j]);
    }
  }

  return sumDiff / (2 * n * n * mean);
}

/**
 * Optimized Gini using sorted-order formula: G = (2 * Σ(i * x_i)) / (n * Σx_i) - (n+1)/n
 */
export function giniCoefficientFast(balances: number[]): number {
  const n = balances.length;
  if (n <= 1) return 0;

  const sorted = [...balances].sort((a, b) => a - b);
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += (i + 1) * sorted[i];
  }

  return (2 * weightedSum) / (n * total) - (n + 1) / n;
}

/**
 * Herfindahl-Hirschman Index: sum of squared market shares.
 * Range: 1/n (equal) to 1 (monopoly). Multiply by 10000 for standard HHI.
 */
export function herfindahlIndex(balances: number[]): number {
  if (balances.length === 0) return 0;

  const total = balances.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  return balances.reduce((hhi, b) => {
    const share = b / total;
    return hhi + share * share;
  }, 0);
}

/** HHI on the standard 0-10000 scale */
export function hhi10000(balances: number[]): number {
  return herfindahlIndex(balances) * 10000;
}

/**
 * Nakamoto coefficient: minimum number of entities controlling >= threshold% of supply.
 * Default threshold is 51%.
 */
export function nakamotoCoefficient(
  balances: number[],
  threshold = 0.51
): number {
  if (balances.length === 0) return 0;

  const total = balances.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  const sorted = [...balances].sort((a, b) => b - a);
  let cumulative = 0;

  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i];
    if (cumulative / total >= threshold) {
      return i + 1;
    }
  }

  return sorted.length;
}

/**
 * Palma ratio: share of top 10% divided by share of bottom 40%.
 * Higher = more inequality.
 */
export function palmaRatio(balances: number[]): number {
  const n = balances.length;
  if (n === 0) return 0;

  const sorted = [...balances].sort((a, b) => a - b);
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  const bottom40Count = Math.ceil(n * 0.4);
  const top10Count = Math.ceil(n * 0.1);

  const bottom40Sum = sorted.slice(0, bottom40Count).reduce((s, v) => s + v, 0);
  const top10Sum = sorted.slice(-top10Count).reduce((s, v) => s + v, 0);

  if (bottom40Sum === 0) return Infinity;
  return top10Sum / bottom40Sum;
}

/**
 * Generate Lorenz curve points for visualization.
 * Returns array of {x, y} where x = cumulative % of holders, y = cumulative % of wealth.
 * Perfect equality line would be y = x.
 */
export function lorenzCurve(
  balances: number[]
): { x: number; y: number }[] {
  const n = balances.length;
  if (n === 0) return [{ x: 0, y: 0 }, { x: 1, y: 1 }];

  const sorted = [...balances].sort((a, b) => a - b);
  const total = sorted.reduce((s, v) => s + v, 0);

  const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let cumWealth = 0;

  for (let i = 0; i < n; i++) {
    cumWealth += sorted[i];
    points.push({
      x: (i + 1) / n,
      y: total === 0 ? (i + 1) / n : cumWealth / total,
    });
  }

  return points;
}

/**
 * Shannon entropy of the distribution.
 * Higher = more decentralized. Max = log2(n).
 */
export function shannonEntropy(balances: number[]): number {
  if (balances.length === 0) return 0;

  const total = balances.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  let entropy = 0;
  for (const b of balances) {
    if (b > 0) {
      const p = b / total;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/** Normalized Shannon entropy (0-1 scale) */
export function normalizedEntropy(balances: number[]): number {
  const n = balances.length;
  if (n <= 1) return 0;

  const maxEntropy = Math.log2(n);
  if (maxEntropy === 0) return 0;

  return shannonEntropy(balances) / maxEntropy;
}

/**
 * Percentage of total supply held by top N holders.
 */
export function topNConcentration(balances: number[], n: number): number {
  if (balances.length === 0) return 0;

  const total = balances.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  const sorted = [...balances].sort((a, b) => b - a);
  const topN = sorted.slice(0, Math.min(n, sorted.length));
  const topSum = topN.reduce((s, v) => s + v, 0);

  return topSum / total;
}

/**
 * Categorize holders into whale/shark/dolphin/fish buckets.
 * Thresholds based on % of supply:
 *   whale: >= 1%, shark: >= 0.1%, dolphin: >= 0.01%, fish: < 0.01%
 */
export function holderBuckets(balances: number[]): HolderBuckets {
  const total = balances.reduce((s, v) => s + v, 0);
  if (total === 0) return { whale: 0, shark: 0, dolphin: 0, fish: 0 };

  const buckets: HolderBuckets = { whale: 0, shark: 0, dolphin: 0, fish: 0 };

  for (const b of balances) {
    const pct = b / total;
    if (pct >= 0.01) buckets.whale++;
    else if (pct >= 0.001) buckets.shark++;
    else if (pct >= 0.0001) buckets.dolphin++;
    else buckets.fish++;
  }

  return buckets;
}
