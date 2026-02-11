/**
 * Zod-free runtime validators for API responses.
 * All validators return { valid: true, data: T } | { valid: false, errors: string[] }
 */

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: string[] };

// ============================================================================
// Utility validators
// ============================================================================

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val);
}

function isString(val: unknown): val is string {
  return typeof val === "string";
}

function isNumber(val: unknown): val is number {
  return typeof val === "number" && !Number.isNaN(val);
}

function isFiniteNumber(val: unknown): val is number {
  return isNumber(val) && Number.isFinite(val);
}

// ============================================================================
// Holder Data Validators
// ============================================================================

export interface HolderData {
  address: string;
  balance: string;
  balanceUsd: number;
  percentage: number;
}

export interface HolderStats {
  totalHolders: number;
  top10Percentage: number;
  top50Percentage: number;
  medianBalance: number;
  holders: HolderData[];
}

export function validateHolderData(data: unknown): ValidationResult<HolderData> {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ["HolderData must be an object"] };
  }

  if (!isString(data.address)) {
    errors.push("address must be a string");
  }
  if (!isString(data.balance)) {
    errors.push("balance must be a string");
  }
  if (!isFiniteNumber(data.balanceUsd)) {
    errors.push("balanceUsd must be a finite number");
  }
  if (!isFiniteNumber(data.percentage)) {
    errors.push("percentage must be a finite number");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      address: data.address as string,
      balance: data.balance as string,
      balanceUsd: data.balanceUsd as number,
      percentage: data.percentage as number,
    },
  };
}

export function validateHolderStats(data: unknown): ValidationResult<HolderStats> {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ["HolderStats must be an object"] };
  }

  if (!isFiniteNumber(data.totalHolders)) {
    errors.push("totalHolders must be a finite number");
  }
  if (!isFiniteNumber(data.top10Percentage)) {
    errors.push("top10Percentage must be a finite number");
  }
  if (!isFiniteNumber(data.top50Percentage)) {
    errors.push("top50Percentage must be a finite number");
  }
  if (!isFiniteNumber(data.medianBalance)) {
    errors.push("medianBalance must be a finite number");
  }
  if (!isArray(data.holders)) {
    errors.push("holders must be an array");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate each holder
  const holders: HolderData[] = [];
  const holdersArray = data.holders as unknown[];
  for (let i = 0; i < holdersArray.length; i++) {
    const result = validateHolderData(holdersArray[i]);
    if (!result.valid) {
      errors.push(`holders[${i}]: ${result.errors.join(", ")}`);
    } else {
      holders.push(result.data);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      totalHolders: data.totalHolders as number,
      top10Percentage: data.top10Percentage as number,
      top50Percentage: data.top50Percentage as number,
      medianBalance: data.medianBalance as number,
      holders,
    },
  };
}

// ============================================================================
// Codex API Response Validators
// ============================================================================

export interface CodexHolderItem {
  walletAddress?: string;
  balance?: string;
  balanceUsd?: number;
}

export interface CodexHoldersResponse {
  holders?: {
    items?: CodexHolderItem[];
    count?: number;
    top10HoldersPercent?: number;
  };
}

export function validateCodexHoldersResponse(
  data: unknown
): ValidationResult<CodexHoldersResponse> {
  // Codex response can be partially populated, so we do lenient validation
  if (!isObject(data)) {
    return { valid: false, errors: ["Codex response must be an object"] };
  }

  const response: CodexHoldersResponse = {};

  if (data.holders !== undefined) {
    if (!isObject(data.holders)) {
      return { valid: false, errors: ["holders must be an object if present"] };
    }

    const holders = data.holders as Record<string, unknown>;
    response.holders = {};

    if (holders.items !== undefined) {
      if (!isArray(holders.items)) {
        return { valid: false, errors: ["holders.items must be an array if present"] };
      }
      response.holders.items = (holders.items as unknown[]).map((item) => {
        if (!isObject(item)) return {};
        return {
          walletAddress: isString(item.walletAddress) ? item.walletAddress : undefined,
          balance: isString(item.balance) ? item.balance : undefined,
          balanceUsd: isFiniteNumber(item.balanceUsd) ? item.balanceUsd : undefined,
        };
      });
    }

    if (holders.count !== undefined) {
      response.holders.count = isFiniteNumber(holders.count) ? holders.count : undefined;
    }

    if (holders.top10HoldersPercent !== undefined) {
      response.holders.top10HoldersPercent = isFiniteNumber(holders.top10HoldersPercent)
        ? holders.top10HoldersPercent
        : undefined;
    }
  }

  return { valid: true, data: response };
}

// ============================================================================
// CoinGecko Response Validators
// ============================================================================

export interface CoinGeckoMarketChartResponse {
  prices: [number, number][];
  total_volumes?: [number, number][];
  market_caps?: [number, number][];
}

export function validateCoinGeckoMarketChart(
  data: unknown
): ValidationResult<CoinGeckoMarketChartResponse> {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ["CoinGecko response must be an object"] };
  }

  if (!isArray(data.prices)) {
    return { valid: false, errors: ["prices must be an array"] };
  }

  // Validate prices array structure
  const prices: [number, number][] = [];
  for (let i = 0; i < (data.prices as unknown[]).length; i++) {
    const point = (data.prices as unknown[])[i];
    if (!isArray(point) || point.length < 2) {
      errors.push(`prices[${i}] must be a [timestamp, value] tuple`);
      continue;
    }
    const timestamp = point[0];
    const value = point[1];
    if (!isFiniteNumber(timestamp) || !isFiniteNumber(value)) {
      errors.push(`prices[${i}] contains invalid numbers`);
      continue;
    }
    prices.push([timestamp, value]);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const result: CoinGeckoMarketChartResponse = { prices };

  // Optionally validate volumes
  if (data.total_volumes !== undefined && isArray(data.total_volumes)) {
    result.total_volumes = [];
    for (const point of data.total_volumes as unknown[]) {
      if (isArray(point) && point.length >= 2 && isFiniteNumber(point[0]) && isFiniteNumber(point[1])) {
        result.total_volumes.push([point[0], point[1]]);
      }
    }
  }

  // Optionally validate market caps
  if (data.market_caps !== undefined && isArray(data.market_caps)) {
    result.market_caps = [];
    for (const point of data.market_caps as unknown[]) {
      if (isArray(point) && point.length >= 2 && isFiniteNumber(point[0]) && isFiniteNumber(point[1])) {
        result.market_caps.push([point[0], point[1]]);
      }
    }
  }

  return { valid: true, data: result };
}

export interface CoinGeckoSimplePriceResponse {
  [coinId: string]: {
    usd?: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
  };
}

export function validateCoinGeckoSimplePrice(
  data: unknown,
  expectedCoinId: string
): ValidationResult<CoinGeckoSimplePriceResponse> {
  if (!isObject(data)) {
    return { valid: false, errors: ["CoinGecko simple price response must be an object"] };
  }

  const coinData = data[expectedCoinId];
  if (!isObject(coinData)) {
    return { valid: false, errors: [`Token '${expectedCoinId}' not found in response`] };
  }

  // Build validated response
  const result: CoinGeckoSimplePriceResponse = {
    [expectedCoinId]: {
      usd: isFiniteNumber(coinData.usd) ? coinData.usd : undefined,
      usd_24h_change: isFiniteNumber(coinData.usd_24h_change) ? coinData.usd_24h_change : undefined,
      usd_market_cap: isFiniteNumber(coinData.usd_market_cap) ? coinData.usd_market_cap : undefined,
      usd_24h_vol: isFiniteNumber(coinData.usd_24h_vol) ? coinData.usd_24h_vol : undefined,
    },
  };

  return { valid: true, data: result };
}

// ============================================================================
// Market Data Point Validator
// ============================================================================

export interface MarketPoint {
  t: number;
  price: number;
  volume?: number;
  marketCap?: number;
}

export function validateMarketPoint(data: unknown): ValidationResult<MarketPoint> {
  if (!isObject(data)) {
    return { valid: false, errors: ["MarketPoint must be an object"] };
  }

  const errors: string[] = [];

  if (!isFiniteNumber(data.t)) {
    errors.push("t (timestamp) must be a finite number");
  }
  if (!isFiniteNumber(data.price)) {
    errors.push("price must be a finite number");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      t: data.t as number,
      price: data.price as number,
      volume: isFiniteNumber(data.volume) ? data.volume : undefined,
      marketCap: isFiniteNumber(data.marketCap) ? data.marketCap : undefined,
    },
  };
}

// ============================================================================
// Error Helpers
// ============================================================================

export class ValidationError extends Error {
  constructor(
    public readonly errors: string[],
    public readonly source: string
  ) {
    super(`Validation failed for ${source}: ${errors.join("; ")}`);
    this.name = "ValidationError";
  }
}

/**
 * Assert that validation passed, throwing ValidationError if not
 */
export function assertValid<T>(
  result: ValidationResult<T>,
  source: string
): asserts result is { valid: true; data: T } {
  if (!result.valid) {
    throw new ValidationError(result.errors, source);
  }
}
