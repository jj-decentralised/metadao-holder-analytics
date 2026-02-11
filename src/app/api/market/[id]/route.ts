import { NextRequest } from "next/server";
import { fetchSimplePrice } from "@/lib/coingecko";
import { jsonWithCache, jsonError } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: any) {
  try {
    const params = (await context?.params) ?? context?.params;
    const id: string = params?.id;

    const data = await fetchSimplePrice(id);
    return jsonWithCache(data, "simplePrice");
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to fetch market data");
  }
}
