import { Pool } from "pg";

let pool: Pool | null = null;

export function getDb(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url, ssl: getSsl(url) });
  }
  return pool;
}

function getSsl(url: string): boolean | { rejectUnauthorized: boolean } {
  // Railway Postgres uses sslmode=require
  if (url.includes("sslmode=require")) return { rejectUnauthorized: false };
  return false;
}

export async function ensureSchema() {
  const db = getDb();
  if (!db) return;
  await db.query(`
    create table if not exists holder_snapshots (
      token_id text not null,
      as_of timestamptz not null,
      holder_count int,
      top10_pct double precision,
      top50_pct double precision,
      primary key(token_id, as_of)
    );
  `);
  await db.query(`
    create table if not exists holder_balances (
      token_id text not null,
      as_of timestamptz not null,
      wallet_address text not null,
      balance double precision not null,
      balance_usd double precision,
      primary key(token_id, as_of, wallet_address)
    );
  `);
  await db.query(`
    create index if not exists idx_holder_balances_wallet
      on holder_balances(wallet_address, token_id, as_of);
  `);
}
