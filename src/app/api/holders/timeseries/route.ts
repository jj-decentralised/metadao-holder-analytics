import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get("tokenId");
    const days = Number(searchParams.get("days") ?? 180);

    await ensureSchema();
    const db = getDb();
    if (!db) {
      // Return synthetic demo data so the chart isn't empty
      const now = Date.now();
      const DAY = 86_400_000;
      const demoSeries = Array.from({ length: Math.min(days, 90) }, (_, i) => {
        const base = 2400 + Math.floor(Math.random() * 200) + i * 3;
        return {
          t: now - (Math.min(days, 90) - i) * DAY,
          holderCount: base,
          top10: +(68 - i * 0.05 + Math.random() * 0.5).toFixed(2),
          top50: +(89 - i * 0.03 + Math.random() * 0.3).toFixed(2),
        };
      });
      return NextResponse.json({ series: demoSeries, note: "Demo data — configure DATABASE_URL for real snapshots" });
    }

    const res = await db.query(
      `select as_of, holder_count, top10_pct, top50_pct
       from holder_snapshots
       where ($1::text is null or token_id = $1)
         and as_of >= now() - ($2 || ' days')::interval
       order by as_of asc`,
      [tokenId, isNaN(days) ? 180 : days]
    );

    const series = res.rows.map((r: any) => ({
      t: new Date(r.as_of).getTime(),
      holderCount: r.holder_count,
      top10: r.top10_pct,
      top50: r.top50_pct,
    }));

    return NextResponse.json({ series });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
