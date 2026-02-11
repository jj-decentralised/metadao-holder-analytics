import { getMetaDAOHolders } from "@/lib/codex";
import { holdersCache } from "@/lib/cache";
import { jsonWithCache, jsonError } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

const CACHE_KEY = "metadao-holders";

export async function GET() {
  try {
    const data = await holdersCache.getOrSet(
      CACHE_KEY,
      () => getMetaDAOHolders(),
    );
    return jsonWithCache(data, "holders");
  } catch (error) {
    console.error("API Error:", error);
    return jsonError("Failed to fetch holder data");
  }
}
