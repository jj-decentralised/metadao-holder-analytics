/**
 * Token-bucket rate limiter with queue support.
 * Ensures API clients respect rate limits.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(
    private maxTokens: number,
    private refillRatePerSecond: number
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRatePerSecond
    );
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until a token is available
    const waitTime = ((1 - this.tokens) / this.refillRatePerSecond) * 1000;
    return new Promise((resolve) => {
      setTimeout(() => {
        this.refill();
        this.tokens -= 1;
        resolve();
        // Process queued requests
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          next?.();
        }
      }, waitTime);
    });
  }
}

/**
 * Retry with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; on429?: boolean } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, on429 = true } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isLast = attempt === maxRetries;
      const is429 =
        err instanceof Error &&
        "status" in err &&
        (err as { status: number }).status === 429;

      if (isLast || (!on429 && !is429)) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("Unreachable");
}
