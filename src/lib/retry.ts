/**
 * Generic retry-with-backoff wrapper for async operations.
 * Supports exponential backoff, jitter, and custom retry conditions.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 500) */
  initialDelayMs?: number;
  /** Maximum delay in ms between retries (default: 10000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number;
  /** Add random jitter to delay (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback when a retry is about to happen */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: () => true,
  onRetry: () => {},
};

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for given attempt with optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * multiplier^attempt
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  if (!jitter) {
    return cappedDelay;
  }

  // Add jitter: random value between 0 and 50% of the delay
  const jitterAmount = Math.random() * cappedDelay * 0.5;
  return Math.floor(cappedDelay + jitterAmount);
}

/**
 * Retry wrapper with exponential backoff
 *
 * @example
 * const data = await withRetry(
 *   () => fetchData(),
 *   { maxAttempts: 5, initialDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === opts.maxAttempts - 1;
      const shouldRetry = !isLastAttempt && opts.isRetryable(error);

      if (!shouldRetry) {
        throw error;
      }

      const delayMs = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitter
      );

      opts.onRetry(error, attempt + 1, delayMs);
      await sleep(delayMs);
    }
  }

  // This should not be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Check if an HTTP error is retryable (5xx or network errors, not 4xx)
 */
export function isHttpRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors are retryable
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("enotfound") ||
      message.includes("fetch failed")
    ) {
      return true;
    }

    // HTTP status codes
    const statusMatch = message.match(/http\s*(\d{3})/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      // 5xx errors are retryable, 429 (rate limit) is retryable
      return status >= 500 || status === 429;
    }

    // Generic error messages that might indicate transient issues
    if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
      return true;
    }
  }

  return true; // Default to retryable for unknown errors
}

/**
 * Create a retry wrapper with preset options
 */
export function createRetrier(defaultOptions: RetryOptions) {
  return <T>(fn: () => Promise<T>, overrideOptions?: RetryOptions) =>
    withRetry(fn, { ...defaultOptions, ...overrideOptions });
}

/**
 * HTTP-specific retry wrapper with sensible defaults
 */
export const httpRetry = createRetrier({
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: isHttpRetryable,
});

/**
 * Retry result wrapper that never throws, returning error state instead
 */
export type RetryResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: unknown;
      attempts: number;
    };

export async function withRetrySafe<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let attempts = 0;

  try {
    const data = await withRetry(fn, {
      ...opts,
      onRetry: (error, attempt, delayMs) => {
        attempts = attempt;
        opts.onRetry?.(error, attempt, delayMs);
      },
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error, attempts: attempts + 1 };
  }
}
