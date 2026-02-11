/**
 * Server-Sent Events (SSE) utility for streaming real-time updates.
 *
 * Provides helpers for:
 * - Encoding SSE events
 * - Creating streaming responses
 * - Managing event types and data formatting
 */

/** SSE event data structure */
export interface SSEEvent<T = unknown> {
  /** Event type (optional, defaults to "message") */
  event?: string;
  /** Event payload */
  data: T;
  /** Optional event ID for resumption */
  id?: string;
  /** Optional retry interval in ms */
  retry?: number;
}

/** Holder stats delta event */
export interface HolderDelta {
  totalHolders: number;
  top10Percentage: number;
  top50Percentage: number;
  medianBalance: number;
  timestamp: number;
  /** Change from previous value */
  delta?: {
    totalHolders: number;
    top10Percentage: number;
    top50Percentage: number;
  };
}

/** Heartbeat event to keep connection alive */
export interface HeartbeatEvent {
  type: "heartbeat";
  timestamp: number;
}

const encoder = new TextEncoder();

/**
 * Formats an SSE event into the wire format.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
 */
export function formatSSEEvent<T>(event: SSEEvent<T>): string {
  const lines: string[] = [];

  if (event.id !== undefined) {
    lines.push(`id: ${event.id}`);
  }

  if (event.event) {
    lines.push(`event: ${event.event}`);
  }

  if (event.retry !== undefined) {
    lines.push(`retry: ${event.retry}`);
  }

  // Data can be multi-line; each line needs "data: " prefix
  const dataStr =
    typeof event.data === "string" ? event.data : JSON.stringify(event.data);
  for (const line of dataStr.split("\n")) {
    lines.push(`data: ${line}`);
  }

  // SSE requires double newline to terminate event
  return lines.join("\n") + "\n\n";
}

/**
 * Encodes an SSE event to Uint8Array for streaming.
 */
export function encodeSSEEvent<T>(event: SSEEvent<T>): Uint8Array {
  return encoder.encode(formatSSEEvent(event));
}

/**
 * Creates SSE response headers.
 */
export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  };
}

/**
 * Creates an SSE streaming response using a polling function.
 *
 * @param pollFn - Async function that returns data to stream
 * @param intervalMs - Polling interval in milliseconds (default: 30000)
 * @param heartbeatMs - Heartbeat interval to keep connection alive (default: 15000)
 */
export function createSSEStream<T>(
  pollFn: () => Promise<T>,
  options: {
    intervalMs?: number;
    heartbeatMs?: number;
    onError?: (error: unknown) => void;
  } = {}
): ReadableStream<Uint8Array> {
  const { intervalMs = 30000, heartbeatMs = 15000, onError } = options;

  let eventId = 0;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let isActive = true;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // Send initial data immediately
      try {
        const data = await pollFn();
        controller.enqueue(
          encodeSSEEvent({
            event: "update",
            data,
            id: String(++eventId),
          })
        );
      } catch (error) {
        onError?.(error);
        controller.enqueue(
          encodeSSEEvent({
            event: "error",
            data: { message: "Failed to fetch initial data" },
          })
        );
      }

      // Set up polling
      pollInterval = setInterval(async () => {
        if (!isActive) return;
        try {
          const data = await pollFn();
          controller.enqueue(
            encodeSSEEvent({
              event: "update",
              data,
              id: String(++eventId),
            })
          );
        } catch (error) {
          onError?.(error);
          controller.enqueue(
            encodeSSEEvent({
              event: "error",
              data: { message: "Failed to fetch update" },
            })
          );
        }
      }, intervalMs);

      // Set up heartbeat to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (!isActive) return;
        controller.enqueue(
          encodeSSEEvent({
            event: "heartbeat",
            data: { timestamp: Date.now() },
          })
        );
      }, heartbeatMs);
    },

    cancel() {
      isActive = false;
      if (pollInterval) clearInterval(pollInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });
}

/**
 * Type guard to check if a value is a HolderDelta event.
 */
export function isHolderDelta(value: unknown): value is HolderDelta {
  return (
    typeof value === "object" &&
    value !== null &&
    "totalHolders" in value &&
    "timestamp" in value
  );
}

/**
 * Computes delta between two holder stats snapshots.
 */
export function computeDelta(
  current: Omit<HolderDelta, "timestamp" | "delta">,
  previous: Omit<HolderDelta, "timestamp" | "delta"> | null
): HolderDelta {
  const delta = previous
    ? {
        totalHolders: current.totalHolders - previous.totalHolders,
        top10Percentage: current.top10Percentage - previous.top10Percentage,
        top50Percentage: current.top50Percentage - previous.top50Percentage,
      }
    : undefined;

  return {
    ...current,
    timestamp: Date.now(),
    delta,
  };
}
