import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

interface HolderChange {
  wallet: string;
  balance: number;
  balanceUsd: number | null;
}

interface ChangesResponse {
  tokenId: string | null;
  fromSnapshot: string;
  toSnapshot: string;
  newHolders: HolderChange[];
  lostHolders: HolderChange[];
  newCount: number;
  lostCount: number;
  note?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get("tokenId");
    const from = searchParams.get("from"); // ISO timestamp or "latest-N"
    const to = searchParams.get("to"); // ISO timestamp or "latest"
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);

    await ensureSchema();
    const db = getDb();

    if (!db) {
      // Return synthetic demo data when no database is configured
      const demoNew: HolderChange[] = Array.from({ length: 5 }, (_, i) => ({
        wallet: `Demo${i + 1}...New${String.fromCharCode(65 + i)}`,
        balance: 1000 + i * 500,
        balanceUsd: 500 + i * 250,
      }));
      const demoLost: HolderChange[] = Array.from({ length: 3 }, (_, i) => ({
        wallet: `Demo${i + 1}...Lost${String.fromCharCode(65 + i)}`,
        balance: 500 + i * 200,
        balanceUsd: 250 + i * 100,
      }));
      return NextResponse.json({
        tokenId,
        fromSnapshot: new Date(Date.now() - 86_400_000).toISOString(),
        toSnapshot: new Date().toISOString(),
        newHolders: demoNew,
        lostHolders: demoLost,
        newCount: demoNew.length,
        lostCount: demoLost.length,
        note: "Demo data — configure DATABASE_URL for real snapshots",
      } satisfies ChangesResponse);
    }

    // Get the two most recent distinct snapshot timestamps if from/to not specified
    let fromTs: string;
    let toTs: string;

    if (from && to) {
      fromTs = from;
      toTs = to;
    } else {
      // Get the latest N snapshots
      const snapshotsRes = await db.query(
        `SELECT DISTINCT as_of 
         FROM holder_balances 
         WHERE ($1::text IS NULL OR token_id = $1)
         ORDER BY as_of DESC 
         LIMIT 2`,
        [tokenId]
      );

      if (snapshotsRes.rows.length < 2) {
        return NextResponse.json({
          tokenId,
          fromSnapshot: "",
          toSnapshot: "",
          newHolders: [],
          lostHolders: [],
          newCount: 0,
          lostCount: 0,
          note: "Need at least 2 snapshots to compute changes",
        } satisfies ChangesResponse);
      }

      toTs = snapshotsRes.rows[0].as_of;
      fromTs = snapshotsRes.rows[1].as_of;
    }

    // Find new holders: in "to" snapshot but not in "from" snapshot
    const newHoldersRes = await db.query(
      `SELECT hb_to.wallet_address, hb_to.balance, hb_to.balance_usd
       FROM holder_balances hb_to
       WHERE hb_to.as_of = $1
         AND ($3::text IS NULL OR hb_to.token_id = $3)
         AND NOT EXISTS (
           SELECT 1 FROM holder_balances hb_from
           WHERE hb_from.wallet_address = hb_to.wallet_address
             AND hb_from.as_of = $2
             AND ($3::text IS NULL OR hb_from.token_id = $3)
         )
       ORDER BY hb_to.balance DESC
       LIMIT $4`,
      [toTs, fromTs, tokenId, limit]
    );

    // Find lost holders: in "from" snapshot but not in "to" snapshot
    const lostHoldersRes = await db.query(
      `SELECT hb_from.wallet_address, hb_from.balance, hb_from.balance_usd
       FROM holder_balances hb_from
       WHERE hb_from.as_of = $2
         AND ($3::text IS NULL OR hb_from.token_id = $3)
         AND NOT EXISTS (
           SELECT 1 FROM holder_balances hb_to
           WHERE hb_to.wallet_address = hb_from.wallet_address
             AND hb_to.as_of = $1
             AND ($3::text IS NULL OR hb_to.token_id = $3)
         )
       ORDER BY hb_from.balance DESC
       LIMIT $4`,
      [toTs, fromTs, tokenId, limit]
    );

    // Get total counts (without limit)
    const countsRes = await db.query(
      `SELECT 
         (SELECT COUNT(*) FROM holder_balances hb_to
          WHERE hb_to.as_of = $1 AND ($3::text IS NULL OR hb_to.token_id = $3)
          AND NOT EXISTS (
            SELECT 1 FROM holder_balances hb_from
            WHERE hb_from.wallet_address = hb_to.wallet_address
              AND hb_from.as_of = $2 AND ($3::text IS NULL OR hb_from.token_id = $3)
          )) as new_count,
         (SELECT COUNT(*) FROM holder_balances hb_from
          WHERE hb_from.as_of = $2 AND ($3::text IS NULL OR hb_from.token_id = $3)
          AND NOT EXISTS (
            SELECT 1 FROM holder_balances hb_to
            WHERE hb_to.wallet_address = hb_from.wallet_address
              AND hb_to.as_of = $1 AND ($3::text IS NULL OR hb_to.token_id = $3)
          )) as lost_count`,
      [toTs, fromTs, tokenId]
    );

    const newHolders: HolderChange[] = newHoldersRes.rows.map((r: any) => ({
      wallet: r.wallet_address,
      balance: r.balance,
      balanceUsd: r.balance_usd,
    }));

    const lostHolders: HolderChange[] = lostHoldersRes.rows.map((r: any) => ({
      wallet: r.wallet_address,
      balance: r.balance,
      balanceUsd: r.balance_usd,
    }));

    return NextResponse.json({
      tokenId,
      fromSnapshot: fromTs,
      toSnapshot: toTs,
      newHolders,
      lostHolders,
      newCount: Number(countsRes.rows[0]?.new_count ?? newHolders.length),
      lostCount: Number(countsRes.rows[0]?.lost_count ?? lostHolders.length),
    } satisfies ChangesResponse);
  } catch (e: any) {
    console.error("Holder changes error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to compute holder changes" },
      { status: 500 }
    );
  }
}
