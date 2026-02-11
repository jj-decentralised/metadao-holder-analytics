export type SeriesPoint = { t: number; v: number };

export function toSeries(points: { t: number; price: number }[]): SeriesPoint[] {
  return points.map((p) => ({ t: p.t, v: p.price }));
}

export function simpleReturns(s: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let i = 1; i < s.length; i++) {
    const r = s[i - 1].v === 0 ? 0 : (s[i].v - s[i - 1].v) / s[i - 1].v;
    out.push({ t: s[i].t, v: r });
  }
  return out;
}

export function rollingStd(
  s: SeriesPoint[],
  window: number,
  annualizeFactor = Math.sqrt(365),
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let sum = 0,
    sumSq = 0;
  const q: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const v = s[i].v;
    q.push(v);
    sum += v;
    sumSq += v * v;
    if (q.length > window) {
      const old = q.shift()!;
      sum -= old;
      sumSq -= old * old;
    }
    if (q.length === window) {
      const mean = sum / window;
      const variance = Math.max(sumSq / window - mean * mean, 0);
      out.push({ t: s[i].t, v: Math.sqrt(variance) * annualizeFactor });
    }
  }
  return out;
}

export function sharpe(
  returns: SeriesPoint[],
  window: number,
  rfDaily = 0,
  annualizeFactor = Math.sqrt(365),
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let sum = 0,
    sumSq = 0;
  const q: number[] = [];
  for (let i = 0; i < returns.length; i++) {
    const v = returns[i].v - rfDaily;
    q.push(v);
    sum += v;
    sumSq += v * v;
    if (q.length > window) {
      const old = q.shift()!;
      sum -= old;
      sumSq -= old * old;
    }
    if (q.length === window) {
      const mean = sum / window;
      const variance = Math.max(sumSq / window - mean * mean, 0);
      const sd = Math.sqrt(variance) * annualizeFactor;
      const meanAnnual = mean * 365;
      out.push({ t: returns[i].t, v: sd === 0 ? 0 : meanAnnual / sd });
    }
  }
  return out;
}

export function maxDrawdown(s: SeriesPoint[]): { mdd: number; t: number } {
  let peak = -Infinity;
  let mdd = 0;
  let t = s.length ? s[0].t : 0;
  for (const p of s) {
    peak = Math.max(peak, p.v);
    const dd = peak === 0 ? 0 : (peak - p.v) / peak;
    if (dd > mdd) {
      mdd = dd;
      t = p.t;
    }
  }
  return { mdd, t };
}
