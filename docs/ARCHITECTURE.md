# RSQL Architecture

This document describes the runtime shape of RSQL after WASM-support phases P1–P6. For the original design rationale, see [`superpowers/specs/2026-05-16-wasm-support-design.md`](./superpowers/specs/2026-05-16-wasm-support-design.md).

## Build targets

RSQL ships in two build targets that share one React frontend and one Rust core:

| Target           | Backend                          | Bundle                | IPC                                 |
|------------------|----------------------------------|-----------------------|-------------------------------------|
| Desktop (Tauri)  | `crates/rsql-tauri` (bin `rsql`) | Vite, target=`tauri`  | Tauri `invoke` + `listen`           |
| Web (Docker)     | `crates/rsql-proxy`              | Vite, target=`web`    | WebSocket + JSON / binary frames    |

Both targets call into the same `crates/rsql-core` library. No code is duplicated between the two binaries.

## Cargo workspace

```
crates/
  rsql-core/         # pure-Rust business logic (no Tauri, no axum)
  rsql-tauri/        # desktop binary (package name: rsql)
  rsql-proxy/        # web binary (Axum + WS bridge)
  rsql-bench/        # Criterion benchmarks (dev-only)
```

- `rsql-core` is the **only** crate allowed to grow new feature code. New PG commands, terminal logic, SSH tunnels — all land here as `pub async fn`s with no transport knowledge.
- `rsql-tauri` and `rsql-proxy` are **thin transports**. They translate Tauri/WS messages into rsql-core function calls and back. Per `scripts/check-rsql-core-purity.sh`, `rsql-core` may not import Tauri or axum.

## Frontend Transport layer

`src/lib/transport/` abstracts the two IPC mechanisms behind a single `Transport` interface:

```ts
interface Transport {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn>;
}
```

Two implementations:
- `TauriTransport` (`tauri-transport.ts`) wraps `@tauri-apps/api/core::invoke` and `/event::listen`.
- `WebSocketTransport` (`websocket-transport.ts`) speaks the proxy's WS protocol (see below). It exposes the same `Transport` surface and manages reconnect, pending-request maps, and the JSON ⇄ binary frame split.

A `runtime.ts` helper detects the build target via `isTauriRuntime()` (Tauri global) + `__RSQL_BUILD_TARGET__` define-injected by Vite, and `index.ts` picks the right Transport at module load.

Every callsite in the frontend uses `transport.invoke(...)` / `transport.listen(...)`. There are zero direct `@tauri-apps/api` imports outside `src/lib/platform/` (which holds the platform adapter layer — dialogs, updater).

## WebSocket protocol (rsql-proxy)

Endpoint: `GET /ws` on the same port as the static SPA (`127.0.0.1:8080` by default).

### Inbound (client → proxy)

JSON-tagged with `type` discriminator (lowercase):

```jsonc
{ "type": "request", "id": "<uuid v7>", "cmd": "<command>", "payload": { ... } }
{ "type": "cancel",  "id": "<uuid>" }
```

### Outbound (proxy → client)

JSON-tagged text frames:
```jsonc
{ "type": "response", "id": "<uuid>", "payload": ..., "end": true }
{ "type": "error",    "id": "<uuid>", "message": "...", "code": 0 }
{ "type": "event",    "event": "terminal-data", "payload": ... }
```

Binary frames carry packed query results to keep the perf-critical path zero-copy:
```
[16 bytes UUID][\x1F-cell-sep \x1E-row-sep packed UTF-8 payload]
```

The frontend's `parseBinaryFrame` strips the UUID and dispatches the bytes to the original `invoke` promise's `Vec<u8>` resolver, which the existing `unpackRows()` helper in `src/lib/pgsql.ts` consumes — identical handling to the Tauri `tauri::ipc::Response` zero-copy path.

## Dispatch flow

```
Browser  ──invoke("pgsql_run_query", args)─→  WebSocketTransport.dispatch
                                                  │ assigns request UUID
                                                  ▼
                          Axum /ws  ──Inbound::Request─→  ws.rs main loop
                                                              │ spawn handler
                                                              ▼
                                              dispatch/<module>::handle
                                                              │
                                                              ▼
                                              rsql_core::drivers::pgsql::commands::query::pgsql_run_query
                                                              │
                                                              ▼
                                              Outbound::binary(uuid, packed)
                                                              │
                                                              ▼
                          Axum /ws  ──Message::Binary─────  ws.rs writer task
                                                              │
                                                              ▼
WebSocketTransport.handleMessage  ──resolves Promise<Vec<u8>>─→  pgsql.ts unpackRows
```

Streaming responses (`pgsql_run_query_streamed`) use the same channel: the dispatched handler holds a `ProxyEventSink` and emits multiple `Outbound::Text({type:"event"})` frames before the final `Outbound::Text({type:"response", end:true})`.

The desktop path is the same after the first hop: Tauri `invoke` ↔ `rsql-tauri`'s command wrappers ↔ `rsql-core`. Both transports converge in `rsql-core`, by design.

## Event sink abstraction

`rsql_core::events::EventSink` is a generic trait (non-object-safe, sync) that lets PG streaming + terminal + LISTEN/NOTIFY emit events without knowing whether they're flowing to a Tauri `AppHandle` or a WS `mpsc::UnboundedSender<Outbound>`. Implementations:
- `TauriEventSink` in `crates/rsql-tauri/src/event_sink.rs`
- `ProxyEventSink` in `crates/rsql-proxy/src/event_sink.rs`

The pull-up to `rsql-core` of `terminal.rs` and `pgsql/streaming.rs` (P3) eliminated the need for either binary to hold transport-specific code.

## State

All user state — saved connections, query history, workspaces, SSH configs — lives in libsql. The schema is bootstrapped in `rsql_core::state::bootstrap(db_path)` (5 tables + 6 ALTER TABLEs for SSH columns). Both binaries call this on startup.

The desktop build stores the DB in the Tauri `app_data_dir`; the proxy stores it at `RSQL_STATE_PATH` (default `/data/rsql.db` in the Docker image, persisted via `VOLUME /data`).

## Performance hot paths

See [`../BENCHMARKS.md`](../BENCHMARKS.md). The three Criterion-covered paths are:
- `pack_rows_vec` (rsql-core)
- `Outbound::into_ws_message` / `parse_text` (rsql-proxy)
- `process_simple_messages` followed by `pack_rows_vec` (the full pack pipeline)

The 10% scroll-FPS gate (web vs desktop on 1M rows) is the spec exit criterion for Phase 7.

## Security boundaries

- The proxy binds to `127.0.0.1:8080` by default (`RSQL_BIND` override). The Docker image keeps this default; users who expose `0.0.0.0` accept the risk explicitly.
- `RSQL_DISABLE_TERMINAL=1` removes the PTY commands from the dispatch table (returns `Err` for every `terminal_*` request).
- The web build's `Transport.invoke` is identical to the desktop's; there is no privileged path that's available only to one side.
