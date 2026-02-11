import { Codex } from '@codex-data/sdk';
import { Pool } from 'pg';

const TOKEN_IDS = (process.env.TOKEN_IDS || 'METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr:1399811149').split(',');
const CODEX_API_KEY = process.env.CODEX_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

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
}

async function snapshotOne(tokenId) {
  const res = await codex.queries.holders({ input: { tokenId, limit: 1 } });
  const count = res?.holders?.count ?? null;
  const top10 = res?.holders?.top10HoldersPercent ?? null;
  const now = new Date();
  await pool.query(
    `insert into holder_snapshots(token_id, as_of, holder_count, top10_pct)
     values($1, $2, $3, $4)
     on conflict (token_id, as_of) do nothing`,
    [tokenId, now.toISOString(), count, top10]
  );
  console.log(`snapshotted ${tokenId} at ${now.toISOString()} count=${count} top10=${top10}`);
}

(async () => {
  await ensureSchema();
  for (const tid of TOKEN_IDS) {
    await snapshotOne(tid.trim());
  }
  await pool.end();
})();
