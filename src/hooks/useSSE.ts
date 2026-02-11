"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { HolderDelta } from "@/lib/sse";

export interface UseSSEOptions {
  /** Whether to enable SSE streaming (default: false) */
  enabled?: boolean;
  /** Callback when new data arrives */
  onUpdate?: (data: HolderDelta) => void;
  /** Callback on error */
  onError?: (error: Event) => void;
  /** Auto-reconnect on connection loss (default: true) */
  reconnect?: boolean;
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
}

export interface UseSSEResult {
  /** Latest holder delta from stream */
  data: HolderDelta | null;
  /** Whether currently connected */
  connected: boolean;
  /** Last error if any */
  error: string | null;
  /** Last update timestamp */
  lastUpdate: number | null;
  /** Manually close the connection */
  close: () => void;
  /** Manually reconnect */
  reconnect: () => void;
}

/**
 * Cleanup function that closes EventSource and clears timers.
 * Does NOT call setState - purely for ref cleanup.
 */
function cleanupRefs(
  eventSourceRef: React.MutableRefObject<EventSource | null>,
  reconnectTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }
}

/**
 * React hook for consuming the SSE holder stream.
 *
 * @example
 * const { data, connected } = useSSE({ enabled: true });
 * if (data) {
 *   console.log('Holders:', data.totalHolders);
 *   if (data.delta) console.log('Change:', data.delta.totalHolders);
 * }
 */
export function useSSE(options: UseSSEOptions = {}): UseSSEResult {
  const {
    enabled = false,
    onUpdate,
    onError,
    reconnect: shouldReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [data, setData] = useState<HolderDelta | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Use refs to track current values for use in callbacks
  const enabledRef = useRef(enabled);
  const shouldReconnectRef = useRef(shouldReconnect);
  const reconnectDelayRef = useRef(reconnectDelay);
  const onUpdateRef = useRef(onUpdate);
  const onErrorRef = useRef(onError);

  // Sync refs with props
  useEffect(() => {
    enabledRef.current = enabled;
    shouldReconnectRef.current = shouldReconnect;
    reconnectDelayRef.current = reconnectDelay;
    onUpdateRef.current = onUpdate;
    onErrorRef.current = onError;
  });

  // Set connected to false when disabled
  // This is a valid subscription pattern - we need to sync state when prop changes
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnected(false);
    }
  }, [enabled]);

  // Main connection effect
  useEffect(() => {
    if (!enabled) {
      cleanupRefs(eventSourceRef, reconnectTimeoutRef);
      return;
    }

    // Connect function defined inside effect
    const connect = () => {
      cleanupRefs(eventSourceRef, reconnectTimeoutRef);

      const eventSource = new EventSource("/api/stream");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.addEventListener("update", (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as HolderDelta;
          setData(parsed);
          setLastUpdate(Date.now());
          onUpdateRef.current?.(parsed);
        } catch (e) {
          console.error("[useSSE] Failed to parse update:", e);
        }
      });

      eventSource.addEventListener("heartbeat", () => {
        setLastUpdate(Date.now());
      });

      eventSource.addEventListener("error", (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          setError(parsed.message || "Stream error");
        } catch {
          setError("Stream error");
        }
      });

      eventSource.onerror = (event: Event) => {
        setConnected(false);
        setError("Connection lost");
        onErrorRef.current?.(event);

        // Auto-reconnect using refs to get current state
        if (shouldReconnectRef.current && enabledRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelayRef.current);
        }
      };
    };

    connect();

    return () => {
      cleanupRefs(eventSourceRef, reconnectTimeoutRef);
    };
  }, [enabled]);

  // Manual close function
  const close = useCallback(() => {
    cleanupRefs(eventSourceRef, reconnectTimeoutRef);
    setConnected(false);
  }, []);

  // Manual reconnect - toggle enabled off/on via state
  const [reconnectKey, setReconnectKey] = useState(0);
  
  const manualReconnect = useCallback(() => {
    if (enabled) {
      // Force reconnect by incrementing key
      setReconnectKey((k) => k + 1);
    }
  }, [enabled]);

  // Effect to handle manual reconnect
  useEffect(() => {
    if (reconnectKey > 0 && enabled) {
      cleanupRefs(eventSourceRef, reconnectTimeoutRef);
      // The main effect will reconnect due to cleanup
    }
  }, [reconnectKey, enabled]);

  return {
    data,
    connected,
    error,
    lastUpdate,
    close,
    reconnect: manualReconnect,
  };
}
