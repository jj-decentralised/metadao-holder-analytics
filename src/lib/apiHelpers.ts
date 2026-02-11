import { NextResponse } from "next/server";

/**
 * Cache configuration options for API responses.
 */
export interface CacheOptions {
  /** Time in seconds that the response is fresh (max-age) */
  maxAge?: number;
  /** Time in seconds to serve stale while revalidating */
  staleWhileRevalidate?: number;
  /** Whether the response can be cached by shared caches (public) */
  isPublic?: boolean;
}

/**
 * Default cache presets for different data types.
 */
export const CACHE_PRESETS = {
  /** Price chart data - moderate caching */
  priceChart: {
    maxAge: 60,
    staleWhileRevalidate: 300,
    isPublic: true,
  },
  /** Simple/current price - shorter cache */
  simplePrice: {
    maxAge: 30,
    staleWhileRevalidate: 60,
    isPublic: true,
  },
  /** Holder data - moderate caching */
  holders: {
    maxAge: 60,
    staleWhileRevalidate: 120,
    isPublic: true,
  },
  /** Metrics/computed data - longer cache */
  metrics: {
    maxAge: 120,
    staleWhileRevalidate: 300,
    isPublic: true,
  },
  /** Health check - no caching */
  health: {
    maxAge: 0,
    staleWhileRevalidate: 0,
    isPublic: false,
  },
} as const satisfies Record<string, CacheOptions>;

/**
 * Build Cache-Control header value from options.
 */
export function buildCacheControlHeader(options: CacheOptions): string {
  const parts: string[] = [];

  if (options.isPublic) {
    parts.push("public");
  } else {
    parts.push("private");
  }

  parts.push(`max-age=${options.maxAge ?? 0}`);

  if (options.staleWhileRevalidate && options.staleWhileRevalidate > 0) {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  return parts.join(", ");
}

/**
 * Create a JSON response with cache headers applied.
 */
export function jsonWithCache<T>(
  data: T,
  options: CacheOptions | keyof typeof CACHE_PRESETS,
  status = 200
): NextResponse<T> {
  const cacheOpts =
    typeof options === "string" ? CACHE_PRESETS[options] : options;

  const headers: HeadersInit = {
    "Cache-Control": buildCacheControlHeader(cacheOpts),
  };

  // Add Vary header for proper CDN caching
  if (cacheOpts.isPublic) {
    headers["Vary"] = "Accept-Encoding";
  }

  return NextResponse.json(data, { status, headers });
}

/**
 * Create an error response (no caching).
 */
export function jsonError(
  error: string | Error,
  status = 500
): NextResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : error;
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
