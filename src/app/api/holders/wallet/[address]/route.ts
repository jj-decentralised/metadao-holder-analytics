import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

interface BalancePoint {
  t: number;
  balance: number;
  balanceUsd: number | null;
}

interface WalletHistoryResponse {
  wallet: string;
  tokenId: string | null;
  series: BalancePoint[];
  note?: string;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  try {
    const params = await context.params;
    const walletAddress = params.address;
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get("tokenId");
    const days = Number(searchParams.get("days") ?? 180);

    if (!walletAddress || walletAddress.length < 32) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    await ensureSchema();
    const db = getDb();

    if (!db) {
      // Return synthetic demo data when no database is configured
      const now = Date.now();
      const DAY = 86_400_000;
      const demoSeries: BalancePoint[] = Array.from(
        { length: Math.min(days, 90) },
        (_, i) => ({
          t: now - (Math.min(days, 90) - i) * DAY,
          balance: 10000 + Math.floor(Math.random() * 500) + i * 10,
          balanceUsd: 5000 + Math.floor(Math.random() * 250) + i * 5,
        })
      );
      return NextResponse.json({
        wallet: walletAddress,
        tokenId,
        series: demoSeries,
        note: "Demo data — configure DATABASE_URL for real snapshots",
      } satisfies WalletHistoryResponse);
    }

    const res = await db.query(
      `SELECT as_of, balance, balance_usd
       FROM holder_balances
       WHERE wallet_address = $1
         AND ($2::text IS NULL OR token_id = $2)
         AND as_of >= NOW() - ($3 || ' days')::interval
       ORDER BY as_of ASC`,
      [walletAddress, tokenId, isNaN(days) ? 180 : days]
    );

    const series: BalancePoint[] = res.rows.map((r: any) => ({
      t: new Date(r.as_of).getTime(),
      balance: r.balance,
      balanceUsd: r.balance_usd,
    }));

    return NextResponse.json({
      wallet: walletAddress,
      tokenId,
      series,
    } satisfies WalletHistoryResponse);
  } catch (e: any) {
    console.error("Wallet history error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch wallet history" },
      { status: 500 }
    );
  }
}
