import { NextResponse } from "next/server";
import { getCodexClient, SOLANA_NETWORK_ID } from "@/lib/api/codex";
import { getTokenTerminalClient } from "@/lib/api/tokenterminal";
import { getDefillamaClient } from "@/lib/api/defillama";

export async function GET() {
  const env = {
    codex: Boolean(process.env.CODEX_API_KEY),
    tokenterminal: Boolean(process.env.TOKENTERMINAL_API_KEY),
    coingecko: Boolean(process.env.COINGECKO_API_KEY),
    allow_mocks: process.env.ALLOW_MOCKS === "true",
    next_public_allow_mocks: process.env.NEXT_PUBLIC_ALLOW_MOCKS === "true",
  } as const;

  const checks: Record<string, { ok: boolean; error?: string }> = {
    codex: { ok: false },
    tokenterminal: { ok: false },
    defillama: { ok: false },
  };

  // Minimal external checks (non-destructive)
  try {
    // Codex: fetch token info for JUP
    const codex = getCodexClient();
    const jup = await codex.getTokenInfo(
      "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      SOLANA_NETWORK_ID
    );
    checks.codex.ok = Boolean(jup?.address);
    if (!checks.codex.ok) checks.codex.error = "No data returned";
  } catch (err) {
    checks.codex.ok = false;
    checks.codex.error = (err as Error).message || String(err);
  }

  try {
    const tt = getTokenTerminalClient();
    const list = await tt.listProtocols();
    checks.tokenterminal.ok = Array.isArray(list) && list.length > 0;
    if (!checks.tokenterminal.ok) checks.tokenterminal.error = "Empty response";
  } catch (err) {
    checks.tokenterminal.ok = false;
    checks.tokenterminal.error = (err as Error).message || String(err);
  }

  try {
    const llama = getDefillamaClient();
    const price = await llama.getTokenPrice(
      "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
    );
    checks.defillama.ok = Boolean(price?.price);
    if (!checks.defillama.ok) checks.defillama.error = "No price returned";
  } catch (err) {
    checks.defillama.ok = false;
    checks.defillama.error = (err as Error).message || String(err);
  }

  return NextResponse.json({ env, checks, timestamp: new Date().toISOString() });
}