import { getAllCacheStats, CacheStats } from "@/lib/cache";
import { getApiMetrics } from "@/lib/coingecko";
import { jsonWithCache } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

// Track server uptime
const startTime = Date.now();

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: {
    seconds: number;
    formatted: string;
  };
  cache: {
    overall: {
      totalHits: number;
      totalMisses: number;
      hitRate: number;
    };
    byType: Record<string, CacheStats>;
  };
  api: {
    coingecko: {
      lastLatencyMs: number;
      totalCalls: number;
      totalErrors: number;
      errorRate: number;
    };
  };
  timestamp: string;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export async function GET() {
  const uptimeMs = Date.now() - startTime;
  const cacheStats = getAllCacheStats();
  const apiMetrics = getApiMetrics();

  // Aggregate cache stats
  const totalHits = Object.values(cacheStats).reduce((sum, s) => sum + s.hits, 0);
  const totalMisses = Object.values(cacheStats).reduce((sum, s) => sum + s.misses, 0);
  const totalRequests = totalHits + totalMisses;
  const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

  // Determine health status
  let status: HealthResponse["status"] = "healthy";
  if (apiMetrics.errorRate > 0.5) {
    status = "unhealthy";
  } else if (apiMetrics.errorRate > 0.1 || apiMetrics.lastLatencyMs > 5000) {
    status = "degraded";
  }

  const response: HealthResponse = {
    status,
    uptime: {
      seconds: Math.floor(uptimeMs / 1000),
      formatted: formatUptime(uptimeMs),
    },
    cache: {
      overall: {
        totalHits,
        totalMisses,
        hitRate: overallHitRate,
      },
      byType: cacheStats,
    },
    api: {
      coingecko: apiMetrics,
    },
    timestamp: new Date().toISOString(),
  };

  return jsonWithCache(response, "health");
}
