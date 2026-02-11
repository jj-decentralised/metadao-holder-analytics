/**
 * In-memory LRU cache with TTL support.
 * Pure TypeScript, no external dependencies.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

export class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(options: { maxSize?: number; defaultTtlMs?: number } = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.defaultTtlMs = options.defaultTtlMs ?? 60_000; // 1 minute default
    this.cache = new Map();
  }

  /**
   * Get a value from the cache.
   * Returns undefined if not found or expired.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache with optional TTL override.
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a key from the cache.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Remove expired entries (optional cleanup).
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Get or set pattern: fetch from cache or compute and cache.
   */
  async getOrSet(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }
}

// Singleton caches for different data types
export const priceCache = new LRUCache<unknown>({
  maxSize: 50,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes for price chart data
});

export const simplePriceCache = new LRUCache<unknown>({
  maxSize: 100,
  defaultTtlMs: 60 * 1000, // 1 minute for simple price
});

export const holdersCache = new LRUCache<unknown>({
  maxSize: 20,
  defaultTtlMs: 2 * 60 * 1000, // 2 minutes for holder data
});

// Aggregate stats across all caches
export function getAllCacheStats(): Record<string, CacheStats> {
  return {
    priceCache: priceCache.getStats(),
    simplePriceCache: simplePriceCache.getStats(),
    holdersCache: holdersCache.getStats(),
  };
}
