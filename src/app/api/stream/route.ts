import { getMetaDAOHolders, type HolderStats } from "@/lib/codex";
import {
  createSSEStream,
  sseHeaders,
  computeDelta,
  type HolderDelta,
} from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Required for streaming

// Store previous snapshot for delta computation
let previousSnapshot: Omit<HolderDelta, "timestamp" | "delta"> | null = null;

/**
 * GET /api/stream
 *
 * Server-Sent Events endpoint that streams holder statistics updates.
 * Polls the Codex API every 30 seconds and emits deltas.
 *
 * Events:
 * - "update": HolderDelta with current stats and changes from previous
 * - "heartbeat": Keep-alive signal every 15 seconds
 * - "error": Error message if fetch fails
 *
 * @example
 * const evtSource = new EventSource('/api/stream');
 * evtSource.addEventListener('update', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Holders:', data.totalHolders);
 * });
 */
export async function GET(): Promise<Response> {
  const pollFn = async (): Promise<HolderDelta> => {
    const stats: HolderStats = await getMetaDAOHolders();

    const current = {
      totalHolders: stats.totalHolders,
      top10Percentage: stats.top10Percentage,
      top50Percentage: stats.top50Percentage,
      medianBalance: stats.medianBalance,
    };

    const delta = computeDelta(current, previousSnapshot);
    previousSnapshot = current;

    return delta;
  };

  const stream = createSSEStream(pollFn, {
    intervalMs: 30_000, // Poll every 30 seconds
    heartbeatMs: 15_000, // Heartbeat every 15 seconds
    onError: (error) => {
      console.error("[SSE Stream] Error:", error);
    },
  });

  return new Response(stream, {
    headers: sseHeaders(),
  });
}
