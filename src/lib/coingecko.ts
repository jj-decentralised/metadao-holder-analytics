const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export type MarketPoint = {
  t: number; // ms epoch
  price: number;
  volume?: number;
  marketCap?: number;
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson<T>(url: string, tries = 3, delayMs = 400): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        // CoinGecko occasionally 429s without UA
        headers: { "User-Agent": "metadao-analytics/0.2" },
        // Edge runtime friendly
        cache: "no-store",
      } as RequestInit);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr;
}

export async function fetchMarketChart(
  coinId: string,
  days: number | "max" = 90,
  vsCurrency = "usd",
): Promise<{ prices: MarketPoint[] } & Record<string, unknown>> {
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(
    coinId,
  )}/market_chart?vs_currency=${vsCurrency}&days=${days}&interval=auto`;
  const json = await getJson<any>(url);
  const points: MarketPoint[] = (json?.prices || []).map((p: [number, number]) => ({
    t: p[0],
    price: Number(p[1] ?? 0),
  }));
  if (Array.isArray(json?.total_volumes)) {
    const volumes = json.total_volumes as [number, number][];
    for (let i = 0; i < Math.min(points.length, volumes.length); i++) {
      points[i].volume = Number(volumes[i][1] ?? 0);
    }
  }
  if (Array.isArray(json?.market_caps)) {
    const mcs = json.market_caps as [number, number][];
    for (let i = 0; i < Math.min(points.length, mcs.length); i++) {
      points[i].marketCap = Number(mcs[i][1] ?? 0);
    }
  }
  return { prices: points, raw: json } as any;
}
