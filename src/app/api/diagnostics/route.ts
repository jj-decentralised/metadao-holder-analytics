import { NextResponse } from "next/server";
import { testConnection as testCoinGecko, getApiMetrics } from "@/lib/coingecko";
import { getCodexClient, METADAO_TOKEN, SOLANA_NETWORK_ID } from "@/lib/codex";
import { withRetrySafe } from "@/lib/retry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ServiceStatus {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface DiagnosticsResponse {
  timestamp: string;
  overall: "healthy" | "degraded" | "unhealthy";
  services: ServiceStatus[];
  metrics: {
    coingecko: {
      lastLatencyMs: number;
      totalCalls: number;
      totalErrors: number;
      errorRate: number;
    };
  };
}

/**
 * Test Codex API connectivity
 */
async function testCodex(): Promise<ServiceStatus> {
  const start = Date.now();

  try {
    const apiKey = process.env.CODEX_API_KEY;
    if (!apiKey) {
      return {
        name: "codex",
        status: "down",
        error: "CODEX_API_KEY not configured",
      };
    }

    const codex = getCodexClient();
    const tokenId = `${METADAO_TOKEN}:${SOLANA_NETWORK_ID}`;

    // Use safe retry wrapper to test API without throwing
    const result = await withRetrySafe(
      async () => {
        const res = await codex.queries.holders({
          input: {
            tokenId,
            limit: 1, // Minimal query for health check
          },
        });
        return res;
      },
      {
        maxAttempts: 1, // Single attempt for health check
        initialDelayMs: 0,
      }
    );

    const latencyMs = Date.now() - start;

    if (!result.success) {
      return {
        name: "codex",
        status: "down",
        latencyMs,
        error: result.error instanceof Error ? result.error.message : "Unknown error",
      };
    }

    const hasData = result.data?.holders?.items?.length ?? 0;
    return {
      name: "codex",
      status: hasData > 0 ? "ok" : "degraded",
      latencyMs,
      details: {
        hasHolderData: hasData > 0,
      },
    };
  } catch (error) {
    return {
      name: "codex",
      status: "down",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test CoinGecko API connectivity
 */
async function testCoinGeckoService(): Promise<ServiceStatus> {
  const result = await testCoinGecko();

  return {
    name: "coingecko",
    status: result.ok ? "ok" : "down",
    latencyMs: result.latencyMs,
    error: result.error,
  };
}

/**
 * Test database connectivity (if configured)
 */
async function testDatabase(): Promise<ServiceStatus> {
  const start = Date.now();

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return {
        name: "database",
        status: "degraded",
        error: "DATABASE_URL not configured (optional)",
      };
    }

    // Dynamic import to avoid issues if pg is not available
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: dbUrl, max: 1 });

    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      await pool.end();

      return {
        name: "database",
        status: "ok",
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      await pool.end().catch(() => {});
      throw error;
    }
  } catch (error) {
    return {
      name: "database",
      status: "down",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Determine overall health status
 */
function getOverallStatus(
  services: ServiceStatus[]
): "healthy" | "degraded" | "unhealthy" {
  const downCount = services.filter((s) => s.status === "down").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;

  // If any critical service is down (codex or coingecko), unhealthy
  const criticalDown = services.some(
    (s) => s.status === "down" && (s.name === "codex" || s.name === "coingecko")
  );

  if (criticalDown || downCount >= 2) {
    return "unhealthy";
  }

  if (downCount > 0 || degradedCount > 0) {
    return "degraded";
  }

  return "healthy";
}

/**
 * GET /api/diagnostics
 *
 * Returns health status of all upstream APIs and services.
 * Use for monitoring and alerting.
 */
export async function GET() {
  try {
    // Run all health checks in parallel
    const [codexStatus, coingeckoStatus, dbStatus] = await Promise.all([
      testCodex(),
      testCoinGeckoService(),
      testDatabase(),
    ]);

    const services = [codexStatus, coingeckoStatus, dbStatus];
    const overall = getOverallStatus(services);
    const cgMetrics = getApiMetrics();

    const response: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      overall,
      services,
      metrics: {
        coingecko: cgMetrics,
      },
    };

    // Return appropriate HTTP status based on health
    const httpStatus = overall === "unhealthy" ? 503 : overall === "degraded" ? 200 : 200;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
    console.error("[Diagnostics] Unexpected error:", error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        overall: "unhealthy",
        services: [],
        error: "Diagnostics check failed",
      },
      { status: 500 }
    );
  }
}
