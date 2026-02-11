import { Codex } from '@codex-data/sdk';
import { Pool } from 'pg';

const TOKEN_IDS = (process.env.TOKEN_IDS || 'METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr:1399811149').split(',');
const CODEX_API_KEY = process.env.CODEX_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const HOLDER_FETCH_LIMIT = Number(process.env.HOLDER_FETCH_LIMIT || '500');

if (!CODEX_API_KEY) throw new Error('CODEX_API_KEY is required');
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const codex = new Codex(CODEX_API_KEY);
const pool = new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false });

async function ensureSchema() {
  await pool.query(`
    create table if not exists holder_snapshots (
      token_id text not null,
      as_of timestamptz not null,
      holder_count int,
      top10_pct double precision,
      top50_pct double precision,
      primary key(token_id, as_of)
    );
  `);
  await pool.query(`
    create table if not exists holder_balances (
      token_id text not null,
      as_of timestamptz not null,
      wallet_address text not null,
      balance double precision not null,
      balance_usd double precision,
      primary key(token_id, as_of, wallet_address)
    );
  `);
  await pool.query(`
    create index if not exists idx_holder_balances_wallet
      on holder_balances(wallet_address, token_id, as_of);
  `);
}

async function snapshotOne(tokenId) {
  const now = new Date();
  const asOf = now.toISOString();

  // Fetch holders with full details for per-holder balances
  const res = await codex.queries.holders({ input: { tokenId, limit: HOLDER_FETCH_LIMIT } });
  const count = res?.holders?.count ?? null;
  const top10 = res?.holders?.top10HoldersPercent ?? null;
  const holders = res?.holders?.items ?? [];

  // Calculate top50_pct from fetched holders
  let top50Pct = null;
  if (holders.length > 0) {
    const totalBalance = holders.reduce((sum, h) => sum + parseFloat(h.balance || '0'), 0);
    if (totalBalance > 0) {
      const sortedHolders = [...holders].sort((a, b) => parseFloat(b.balance || '0') - parseFloat(a.balance || '0'));
      const top50Balance = sortedHolders.slice(0, 50).reduce((sum, h) => sum + parseFloat(h.balance || '0'), 0);
      top50Pct = (top50Balance / totalBalance) * 100;
    }
  }

  // Insert aggregate snapshot
  await pool.query(
    `insert into holder_snapshots(token_id, as_of, holder_count, top10_pct, top50_pct)
     values($1, $2, $3, $4, $5)
     on conflict (token_id, as_of) do nothing`,
    [tokenId, asOf, count, top10, top50Pct]
  );

  // Insert per-holder balances in batches
  if (holders.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < holders.length; i += BATCH_SIZE) {
      const batch = holders.slice(i, i + BATCH_SIZE);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const holder of batch) {
        const wallet = holder.walletAddress;
        const balance = parseFloat(holder.balance || '0');
        const balanceUsd = holder.balanceUsd ?? null;
        if (wallet && balance > 0) {
          values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
          params.push(tokenId, asOf, wallet, balance, balanceUsd);
        }
      }

      if (values.length > 0) {
        await pool.query(
          `insert into holder_balances(token_id, as_of, wallet_address, balance, balance_usd)
           values ${values.join(', ')}
           on conflict (token_id, as_of, wallet_address) do nothing`,
          params
        );
      }
    }
  }

  console.log(`snapshotted ${tokenId} at ${asOf}: count=${count} top10=${top10?.toFixed(2)}% top50=${top50Pct?.toFixed(2)}% holders_stored=${holders.length}`);
}

(async () => {
  await ensureSchema();
  for (const tid of TOKEN_IDS) {
    await snapshotOne(tid.trim());
  }
  await pool.end();
})();
