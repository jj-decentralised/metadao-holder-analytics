import type { HolderBehavior } from "@/types";

interface SnapshotEntry {
  address: string;
  balance: number;
  timestamp: number;
}

/**
 * Classify holder behavior based on snapshots over time.
 * Requires at least 2 snapshots.
 */
export function classifyHolderBehavior(
  snapshots: SnapshotEntry[][]
): Map<string, HolderBehavior> {
  if (snapshots.length < 2) return new Map();

  const first = new Map(snapshots[0].map((e) => [e.address, e]));
  const last = new Map(
    snapshots[snapshots.length - 1].map((e) => [e.address, e])
  );

  const allAddresses = new Set([...first.keys(), ...last.keys()]);
  const result = new Map<string, HolderBehavior>();

  const daysBetween =
    snapshots.length > 1
      ? (snapshots[snapshots.length - 1][0]?.timestamp -
          snapshots[0][0]?.timestamp) /
        86400000
      : 0;

  for (const addr of allAddresses) {
    const wasIn = first.has(addr);
    const isIn = last.has(addr);

    if (!wasIn && isIn) {
      result.set(addr, "new_entrant");
      continue;
    }
    if (wasIn && !isIn) {
      result.set(addr, "exited");
      continue;
    }

    const oldBal = first.get(addr)!.balance;
    const newBal = last.get(addr)!.balance;
    const changePct = oldBal > 0 ? (newBal - oldBal) / oldBal : 0;

    if (daysBetween < 7) {
      result.set(addr, "flipper");
    } else if (daysBetween >= 180 && Math.abs(changePct) < 0.1) {
      result.set(addr, "diamond_hands");
    } else if (changePct > 0.2) {
      result.set(addr, "accumulator");
    } else if (changePct < -0.2) {
      result.set(addr, "distributor");
    } else {
      result.set(addr, "diamond_hands");
    }
  }

  return result;
}

/**
 * Calculate holding duration statistics.
 */
export function holdingDuration(
  entries: Array<{ address: string; firstSeen: number; lastSeen: number }>
): { avg: number; median: number; p90: number; min: number; max: number } {
  if (entries.length === 0)
    return { avg: 0, median: 0, p90: 0, min: 0, max: 0 };

  const durations = entries
    .map((e) => (e.lastSeen - e.firstSeen) / 86400000)
    .sort((a, b) => a - b);

  const sum = durations.reduce((s, d) => s + d, 0);

  return {
    avg: sum / durations.length,
    median: durations[Math.floor(durations.length / 2)],
    p90: durations[Math.floor(durations.length * 0.9)],
    min: durations[0],
    max: durations[durations.length - 1],
  };
}

/**
 * Calculate turnover rate between two snapshots.
 */
export function turnoverRate(
  snap1: Map<string, number>,
  snap2: Map<string, number>
): { entered: number; exited: number; turnoverPct: number } {
  let entered = 0;
  let exited = 0;

  for (const addr of snap2.keys()) {
    if (!snap1.has(addr)) entered++;
  }
  for (const addr of snap1.keys()) {
    if (!snap2.has(addr)) exited++;
  }

  const total = new Set([...snap1.keys(), ...snap2.keys()]).size;
  return {
    entered,
    exited,
    turnoverPct: total > 0 ? (entered + exited) / total : 0,
  };
}
