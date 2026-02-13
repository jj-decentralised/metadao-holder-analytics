/**
 * Simple in-memory cache with TTL support.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup of expired entries (every 60 seconds)
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    }
  }

  /**
   * Get a cached value by key.
   * @returns The cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a cached value with TTL.
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time-to-live in milliseconds
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a cached value.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cached values.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Remove all expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get current cache size.
   */
  get size(): number {
    return this.store.size;
  }
}

// Singleton instance
export const cache = new MemoryCache();

// TTL constants (in milliseconds)
export const TTL = {
  PRICE: 60_000, // 1 minute for prices
  PRICE_HISTORY: 5 * 60_000, // 5 minutes for price history
  HOLDERS: 5 * 60_000, // 5 minutes for holder data
  METRICS: 5 * 60_000, // 5 minutes for metrics
  TOKEN_INFO: 60 * 60_000, // 1 hour for static token info
  PROTOCOL: 10 * 60_000, // 10 minutes for protocol data
} as const;
