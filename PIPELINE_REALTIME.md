# Real-Time Data Pipeline

This document describes the Server-Sent Events (SSE) implementation for streaming live holder statistics updates.

## Overview

The real-time pipeline uses SSE to push holder count updates from the server to connected clients. This approach was chosen over WebSockets because:

1. **Simpler protocol** - SSE is built on HTTP, works with existing infrastructure
2. **Automatic reconnection** - Browsers handle reconnection natively
3. **One-way data flow** - Our use case is server→client updates only
4. **Better for Next.js** - Works seamlessly with Next.js API routes and Edge runtime

## Architecture

```
┌─────────────┐     poll (30s)      ┌─────────────┐
│  Codex API  │ ◄────────────────── │  SSE Route  │
└─────────────┘                     └──────┬──────┘
                                           │
                                    stream │ events
                                           ▼
                                    ┌─────────────┐
                                    │   Browser   │
                                    │  useSSE()   │
                                    └─────────────┘
```

## Components

### Server Side

#### `src/lib/sse.ts`

Core SSE utilities:

- `formatSSEEvent<T>()` - Formats event data into SSE wire format
- `encodeSSEEvent<T>()` - Encodes event as `Uint8Array` for streaming
- `sseHeaders()` - Returns proper HTTP headers for SSE responses
- `createSSEStream<T>()` - Creates a `ReadableStream` with polling and heartbeat
- `computeDelta()` - Computes changes between snapshots

#### `src/app/api/stream/route.ts`

SSE endpoint that:

1. Polls Codex API every 30 seconds
2. Computes deltas from previous snapshot
3. Streams `HolderDelta` events to clients
4. Sends heartbeats every 15 seconds to keep connections alive

### Client Side

#### `src/hooks/useSSE.ts`

React hook for consuming the SSE stream:

```typescript
const { data, connected, lastUpdate } = useSSE({
  enabled: true,           // Toggle streaming on/off
  reconnect: true,         // Auto-reconnect on disconnect
  reconnectDelay: 3000,    // Wait 3s before reconnecting
  onUpdate: (delta) => {}, // Callback for each update
});
```

Returns:
- `data: HolderDelta | null` - Latest update with delta changes
- `connected: boolean` - Connection status
- `error: string | null` - Last error message
- `lastUpdate: number | null` - Timestamp of last event
- `close()` / `reconnect()` - Manual control methods

## Event Types

### `update`

Emitted every 30 seconds with current holder statistics:

```json
{
  "totalHolders": 2847,
  "top10Percentage": 68.5,
  "top50Percentage": 89.2,
  "medianBalance": 1250,
  "timestamp": 1707660000000,
  "delta": {
    "totalHolders": 3,
    "top10Percentage": -0.1,
    "top50Percentage": -0.05
  }
}
```

### `heartbeat`

Keep-alive signal every 15 seconds:

```json
{
  "timestamp": 1707660015000
}
```

### `error`

Emitted when polling fails:

```json
{
  "message": "Failed to fetch update"
}
```

## Usage in UI

The main page (`src/app/page.tsx`) integrates SSE with:

1. **Live toggle button** - Users can enable/disable streaming
2. **Connection indicator** - Shows connected/connecting state
3. **Delta display** - StatCards show +/- changes when live
4. **Pulse animation** - Visual indicator on live cards
5. **Last update timestamp** - Shows when data was last received

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `intervalMs` | 30000 | How often to poll Codex API |
| `heartbeatMs` | 15000 | How often to send keepalives |
| `reconnectDelay` | 3000 | Client reconnect delay on disconnect |

## Limitations

1. **Polling-based** - The server polls Codex; true push would require Codex webhooks
2. **Memory** - Each client connection maintains server-side state
3. **No resumption** - Missed events during disconnect are not replayed

## Future Improvements

- Add `Last-Event-ID` support for resumption
- Implement connection pooling for high-traffic scenarios
- Add rate limiting per client
- Consider Redis pub/sub for multi-instance deployments
- Implement backpressure handling for slow clients
